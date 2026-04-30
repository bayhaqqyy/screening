import yfinance as yf
import pandas as pd
from confluent_kafka import Producer
import json
import time
import os
import sys

# Add parent directory to path to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data.ticker_list import get_yfinance_tickers

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_RAW = "idx.ohlcv.raw"

def get_producer():
    try:
        return Producer({'bootstrap.servers': KAFKA_BROKER})
    except Exception as e:
        print(f"Warning: Could not connect to Kafka broker {KAFKA_BROKER}: {e}")
        return None

def download_all_idx(period="60d"):
    """
    Download OHLCV untuk SELURUH saham IDX.
    Dibagi batch agar tidak di-rate-limit Yahoo.
    """
    all_tickers = get_yfinance_tickers()
    BATCH_SIZE = 50  # 50 saham per batch
    DELAY = 2        # 2 detik antar batch
    
    producer = get_producer()
    
    for i in range(0, len(all_tickers), BATCH_SIZE):
        batch = all_tickers[i:i + BATCH_SIZE]
        batch_str = " ".join(batch)
        
        try:
            print(f"Downloading batch {i//BATCH_SIZE + 1}...")
            data = yf.download(
                batch_str,
                period=period,
                group_by='ticker',
                threads=True,
                progress=False
            )
            
            # Produce ke Kafka per ticker
            for ticker in batch:
                ticker_code = ticker.replace('.JK', '')
                try:
                    # Handle single ticker response shape vs multi-ticker
                    if len(batch) == 1:
                        df = data.dropna()
                    else:
                        if ticker not in data:
                            continue
                        df = data[ticker].dropna()
                        
                    if df.empty:
                        continue
                    
                    # Convert index to strings for JSON serialization
                    df.index = df.index.strftime('%Y-%m-%d')
                    
                    # We can send the whole dataframe history or just the latest
                    # For screening we might need history, so we send the whole thing as a list of dicts
                    # Or we send the dataframe as a JSON string
                    
                    # Let's send the latest 60 days so consumers have enough data for indicators
                    history = df.reset_index().to_dict(orient='records')
                    
                    message = {
                        'ticker': ticker_code,
                        'history': history,
                        'latest': history[-1]
                    }
                    
                    if producer:
                        producer.produce(
                            TOPIC_RAW,
                            key=ticker_code,
                            value=json.dumps(message)
                        )
                except Exception as e:
                    print(f"Error processing {ticker}: {e}")
                    continue
            
            if producer:
                producer.flush()
                print(f"Batch {i//BATCH_SIZE + 1}: {len(batch)} tickers sent to Kafka")
            
        except Exception as e:
            print(f"Batch error: {e}")
        
        time.sleep(DELAY)  # Rate limit protection
    
    print(f"Total: {len(all_tickers)} tickers downloaded")

if __name__ == "__main__":
    import os
    interval_minutes = int(os.getenv("FETCH_INTERVAL_MINUTES", "15"))
    print(f"Starting fetcher service. Will fetch every {interval_minutes} minutes.")
    while True:
        try:
            download_all_idx()
        except Exception as e:
            print(f"Error in main loop: {e}")
        
        print(f"Sleeping for {interval_minutes} minutes...")
        time.sleep(interval_minutes * 60)
