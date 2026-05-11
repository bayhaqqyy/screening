import json
import os
import sys
import pandas as pd
from datetime import datetime, time as datetime_time
import pytz
import psycopg2
from psycopg2.extras import Json
from confluent_kafka import Consumer, Producer

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from screeners.bsjp import screen_bsjp_phase_1, screen_bsjp_phase_2

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_ENRICHED = "idx.ohlcv.enriched"
TOPIC_SCREENER_WS = "idx.screener.updates" # To be sent to WS

DB_HOST = os.environ.get("DB_HOST", "postgres")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "sahamscreen")
DB_USER = os.environ.get("DB_USER", "sahamscreen")
DB_PASS = os.environ.get("DB_PASS", "sahamscreen_dev")

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )

def is_market_open():
    tz = pytz.timezone('Asia/Jakarta')
    now = datetime.now(tz)
    # Market hours 09:00 - 16:00
    if now.weekday() >= 5: # Saturday, Sunday
        return False
    market_open = datetime_time(9, 0)
    market_close = datetime_time(16, 0)
    return market_open <= now.time() <= market_close

def is_bsjp_eval_time():
    tz = pytz.timezone('Asia/Jakarta')
    now = datetime.now(tz)
    # Evaluate at 09:10
    eval_time_start = datetime_time(9, 10)
    eval_time_end = datetime_time(9, 15)
    return eval_time_start <= now.time() <= eval_time_end

def run_scalping(df, ticker):
    latest = df.iloc[-1]
    if pd.isna(latest.get('rsi_14')) or pd.isna(latest.get('vwap')):
        return None
        
    score = 50
    signal = 'NEUTRAL'
    if latest['rsi_14'] < 30 and latest['Close'] > latest['vwap']:
        score = 80 + int(30 - latest['rsi_14'])
        signal = 'STRONG_BUY'
    elif latest['rsi_14'] > 70:
        score = max(10, int(100 - latest['rsi_14']))
        signal = 'SELL'
        
    if score < 60:
        return None

    entry_price = latest['Close']
    tp = entry_price * 1.02 # 2% TP for scalping
    sl = entry_price * 0.985 # 1.5% SL

    return {
        'ticker': ticker,
        'strategy': 'scalping',
        'signal': signal,
        'score': score,
        'payload': {
            'price': entry_price,
            'entry_price': entry_price,
            'target': tp,
            'stop_loss': sl,
            'volume': latest['Volume'],
            'rsi': latest['rsi_14']
        }
    }

def run_swing(df, ticker):
    latest = df.iloc[-1]
    if pd.isna(latest.get('macd')) or pd.isna(latest.get('ema_20')):
        return None
        
    score = 50
    signal = 'NEUTRAL'
    
    # Golden cross MACD & Price above EMA 20
    if latest['macd'] > latest.get('macd_signal', 0) and latest['Close'] > latest['ema_20']:
        score = 75 + int((latest['macd'] - latest.get('macd_signal', 0)) * 100)
        signal = 'BUY'
        
    if score < 65:
        return None

    entry_price = latest['Close']
    tp = entry_price * 1.10 # 10% TP for swing
    sl = entry_price * 0.93 # 7% SL

    return {
        'ticker': ticker,
        'strategy': 'swing',
        'signal': signal,
        'score': min(100, score),
        'payload': {
            'price': entry_price,
            'entry_price': entry_price,
            'target': tp,
            'stop_loss': sl,
            'macd': latest['macd'],
            'ema_20': latest['ema_20']
        }
    }

def freeze_entry_price(existing_payload, new_payload):
    if not existing_payload:
        return new_payload
    if 'entry_price' in existing_payload:
        new_payload['entry_price'] = existing_payload['entry_price']
    return new_payload

def process_message(data, conn, producer):
    # idx.ohlcv.enriched receives two message shapes:
    #   1. engine-indicator: {ticker, history: [...], latest: {...}}  <-- usable
    #   2. engine-fetcher (post-PR-#5): {ticker, last_price, open, ...} flat
    #      (this shape is intended for the Go consumer's persistMarketTick;
    #       it has no 'history' so screening cannot run on it).
    # Skip flat messages quickly instead of letting the generic except spam
    # the logs with KeyError('history') for every fetcher tick.
    if 'history' not in data:
        return

    ticker = data['ticker']
    history = data['history']
    df = pd.DataFrame(history)

    if len(df) < 20:
        return

    results = []
    
    # Run Scalping
    scalp = run_scalping(df, ticker)
    if scalp: results.append(scalp)
        
    # Run Swing
    swing = run_swing(df, ticker)
    if swing: results.append(swing)
        
    # Run BSJP
    # Normally BSJP is locked after 15:30. Let's simplify.
    # We will use Phase 2 logic here if market is close to ending (after 14:00)
    tz = pytz.timezone('Asia/Jakarta')
    now = datetime.now(tz)
    
    bsjp_res = None
    if now.time() >= datetime_time(14, 0):
        bsjp_res = screen_bsjp_phase_2(df, ticker)
    else:
        bsjp_res = screen_bsjp_phase_1(df, ticker)
        
    if bsjp_res and bsjp_res.get('bsjp_score', 0) >= 60:
        entry_price = bsjp_res['price']
        bsjp = {
            'ticker': ticker,
            'strategy': 'bsjp',
            'signal': bsjp_res.get('signal', 'WATCH'),
            'score': bsjp_res.get('bsjp_score', 50),
            'payload': {
                'price': entry_price,
                'entry_price': entry_price,
                'target': entry_price * 1.05,
                'stop_loss': entry_price * 0.97,
                'dip_pct': bsjp_res.get('daily_return', 0),
                'accum_pct': bsjp_res.get('bsjp_score', 0),
                'top_brokers': ['YP', 'CC'] # Placeholder until integrated with bandar flow
            }
        }
        results.append(bsjp)

    if not results:
        return

    # Save to DB and emit
    tz = pytz.timezone('Asia/Jakarta')
    now = datetime.now(tz)
    
    try:
        with conn.cursor() as cur:
            for r in results:
                # Issue #1: Check for locking mechanism
                cur.execute("""
                    SELECT id, is_locked, payload FROM screener_results 
                    WHERE strategy = %s AND ticker = %s 
                    ORDER BY screened_at DESC LIMIT 1
                """, (r['strategy'], r['ticker']))
                row = cur.fetchone()

                # Determine if it should be locked (BSJP after 15:30 or market closed)
                should_lock = False
                if r['strategy'] == 'bsjp':
                    market_end = datetime_time(15, 30)
                    if now.time() >= market_end or not is_market_open():
                        should_lock = True
                
                if row:
                    row_id, is_locked, existing_payload = row[0], row[1], row[2]
                    if is_locked and r['strategy'] == 'bsjp':
                        continue # Skip updating if locked
                    
                    r['payload'] = freeze_entry_price(existing_payload, r['payload'])
                    
                    cur.execute("""
                        UPDATE screener_results 
                        SET signal=%s, score=%s, payload=%s, screened_at=NOW(), is_locked=%s
                        WHERE id = %s
                    """, (r['signal'], r['score'], Json(r['payload']), should_lock, row_id))
                else:
                    cur.execute("""
                        INSERT INTO screener_results (strategy, ticker, signal, score, payload, screened_at, is_locked)
                        VALUES (%s, %s, %s, %s, %s, NOW(), %s)
                    """, (r['strategy'], r['ticker'], r['signal'], r['score'], Json(r['payload']), should_lock))
                
                # Emit to WS topic
                producer.produce(
                    TOPIC_SCREENER_WS,
                    key=r['ticker'],
                    value=json.dumps(r)
                )
        conn.commit()
    except Exception as e:
        print(f"DB Error: {e}")
        conn.rollback()

def main():
    consumer = Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': 'screener-engine',
        'auto.offset.reset': 'latest'
    })
    producer = Producer({'bootstrap.servers': KAFKA_BROKER})
    
    try:
        conn = get_db_connection()
        print("Connected to DB.")
    except Exception as e:
        print(f"Cannot connect to DB: {e}")
        return

    try:
        consumer.subscribe([TOPIC_ENRICHED])
        print(f"Screener Engine started. Listening to {TOPIC_ENRICHED}...")
        
        while True:
            msg = consumer.poll(1.0)
            if msg is None: continue
            if msg.error():
                print(f"Consumer error: {msg.error()}")
                continue
                
            try:
                data = json.loads(msg.value().decode('utf-8'))
                process_message(data, conn, producer)
                producer.poll(0)
            except Exception as e:
                print(f"Error processing message: {e}")
                
    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()
        producer.flush()
        conn.close()

if __name__ == "__main__":
    main()
