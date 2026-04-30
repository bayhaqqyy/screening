import json
import os
import sys
import pandas as pd
import ta
from confluent_kafka import Consumer, Producer

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_RAW = "idx.ohlcv.raw"
TOPIC_ENRICHED = "idx.ohlcv.enriched"

def create_consumer():
    return Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': 'indicator-enricher',
        'auto.offset.reset': 'earliest'
    })

def create_producer():
    return Producer({'bootstrap.servers': KAFKA_BROKER})

def enrich_data(history_list):
    """Calculate technical indicators using `ta` library"""
    df = pd.DataFrame(history_list)
    
    if len(df) < 20:
        return None # Not enough data for indicators
        
    try:
        # Trend Indicators
        df['ema_5'] = ta.trend.EMAIndicator(df['Close'], window=5).ema_indicator()
        df['ema_20'] = ta.trend.EMAIndicator(df['Close'], window=20).ema_indicator()
        df['ema_50'] = ta.trend.EMAIndicator(df['Close'], window=50).ema_indicator()
        
        macd = ta.trend.MACD(df['Close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_hist'] = macd.macd_diff()
        
        # Momentum Indicators
        df['rsi_14'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()
        
        # Volatility Indicators
        bb = ta.volatility.BollingerBands(df['Close'], window=20, window_dev=2)
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        
        # Volume Indicators
        df['vwap'] = ta.volume.VolumeWeightedAveragePrice(
            high=df['High'], low=df['Low'], close=df['Close'], volume=df['Volume'], window=20
        ).volume_weighted_average_price()
        
        # Fill NaN values with None for JSON serialization
        df = df.where(pd.notnull(df), None)
        
        return df.to_dict(orient='records')
    except Exception as e:
        print(f"Error enriching data: {e}")
        return None

def main():
    consumer = create_consumer()
    producer = create_producer()
    
    try:
        consumer.subscribe([TOPIC_RAW])
        print(f"Indicator Enricher started. Listening to {TOPIC_RAW}...")
        
        while True:
            msg = consumer.poll(1.0)
            
            if msg is None:
                continue
            if msg.error():
                print(f"Consumer error: {msg.error()}")
                continue
            
            try:
                data = json.loads(msg.value().decode('utf-8'))
                ticker = data['ticker']
                history = data['history']
                
                enriched_history = enrich_data(history)
                if enriched_history:
                    # Send enriched data
                    enriched_msg = {
                        'ticker': ticker,
                        'history': enriched_history,
                        'latest': enriched_history[-1]
                    }
                    producer.produce(
                        TOPIC_ENRICHED,
                        key=ticker,
                        value=json.dumps(enriched_msg)
                    )
                    producer.poll(0)
                    print(f"Enriched indicators for {ticker}")
            except Exception as e:
                print(f"Error processing message: {e}")
                
    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()
        producer.flush()

if __name__ == "__main__":
    main()
