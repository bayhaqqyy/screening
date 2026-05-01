import json
import time
import random
import threading
import os
import yfinance as yf
from datetime import datetime
from confluent_kafka import Producer
import sys

# Add parent directory to path to import ticker_list
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from data.ticker_list import get_ticker_codes

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_MARKET = "idx.ohlcv.raw"

# Shared memory for real prices
real_price_cache = {}

def load_all_tickers():
    try:
        tickers = get_ticker_codes()
        if tickers:
            return tickers
    except Exception as e:
        print(f"Error loading tickers from IDX: {e}")
    return ["BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM", "GOTO"]

def update_baseline_prices(all_tickers):
    """
    Runs every 60 seconds.
    Fetches the REAL current prices for a RANDOM batch of 50 tickers from the list.
    """
    while True:
        try:
            batch = random.sample(all_tickers, min(50, len(all_tickers)))
            jk_tickers = [t + ".JK" for t in batch]
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching real data for a new batch of {len(batch)} tickers (Syncing...)")
            data = yf.download(jk_tickers, period="60d", interval="1d", group_by="ticker", progress=False)
            
            new_cache = {}
            
            for t_idx, ticker in enumerate(batch):
                try:
                    if len(batch) == 1:
                        ticker_data = data
                    else:
                        ticker_data = data[jk_tickers[t_idx]]
                        
                    if ticker_data.empty:
                        continue
                    
                    # Store up to 60 days of history for indicators
                    history = []
                    for date, row in ticker_data.iterrows():
                        if str(row['Close']) == 'nan':
                            continue
                        history.append({
                            "Date": date.isoformat(),
                            "Open": float(row['Open']),
                            "High": float(row['High']),
                            "Low": float(row['Low']),
                            "Close": float(row['Close']),
                            "Volume": int(row['Volume'])
                        })
                    
                    if len(history) > 0:
                        new_cache[ticker] = history
                except Exception:
                    pass
            
            if len(new_cache) > 0:
                global real_price_cache
                real_price_cache = new_cache
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sync complete. {len(real_price_cache)} tickers rotated into live feed.")
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Sync failed (no valid data), keeping previous cache.")
                
        except Exception as e:
            print(f"Failed to sync with YFinance: {e}")
        
        time.sleep(60)

def main():
    print(f"Connecting to Kafka broker at {KAFKA_BROKER}...")
    producer = Producer({'bootstrap.servers': KAFKA_BROKER})
    print("Successfully connected to Kafka.")

    all_tickers = load_all_tickers()
    print(f"Loaded {len(all_tickers)} total tickers.")

    updater_thread = threading.Thread(target=update_baseline_prices, args=(all_tickers,), daemon=True)
    updater_thread.start()

    print("Waiting for initial data sync...")
    while len(real_price_cache) == 0:
        time.sleep(1)

    print("Starting High-Frequency Emitter...")
    try:
        while True:
            ticker = random.choice(list(real_price_cache.keys()))
            history = real_price_cache[ticker]
            base_data = history[-1]
            
            # Simulate real-time tick based on latest close
            jitter_pct = random.uniform(-0.001, 0.001)
            live_price = base_data["Close"] * (1 + jitter_pct)
            
            if live_price > 5000:
                live_price = round(live_price / 25) * 25
            elif live_price > 500:
                live_price = round(live_price / 5) * 5
            else:
                live_price = round(live_price)

            open_price = base_data["Open"]
            change_pct = 0.0
            if open_price > 0:
                change_pct = round((live_price - open_price) / open_price * 100, 2)
            
            # Update the latest day in history with live tick
            latest_tick = {
                "Date": datetime.now().isoformat(),
                "Open": open_price,
                "High": max(base_data["High"], live_price),
                "Low": min(base_data["Low"], live_price),
                "Close": live_price,
                "Volume": base_data["Volume"] + random.randint(10, 500),
            }
            
            # Copy history to avoid mutating shared state during iteration
            current_history = history[:-1] + [latest_tick]
            
            msg = {
                "ticker": ticker,
                "history": current_history
            }
            
            # Publish RAW history to Kafka
            producer.produce(TOPIC_MARKET, key=ticker.encode('utf-8'), value=json.dumps(msg).encode('utf-8'))
            producer.poll(0)
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Raw Tick: {ticker} @ {live_price} ({change_pct}%)")
            
            time.sleep(random.uniform(0.3, 0.6))
            
    except KeyboardInterrupt:
        print("\nStopping market producer...")
    except Exception as e:
        print(f"Critical error occurred: {e}")
    finally:
        producer.flush()

if __name__ == "__main__":
    main()
