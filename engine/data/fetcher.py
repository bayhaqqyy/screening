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
TOPIC_ENRICHED = "idx.ohlcv.enriched"

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
    Produce ke BOTH idx.ohlcv.raw (for indicator consumer if enabled)
    AND idx.ohlcv.enriched (direct feed into Go consumer for stock_info updates).
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
                        # 1. Produce raw for any indicator consumers
                        producer.produce(
                            TOPIC_RAW,
                            key=ticker_code,
                            value=json.dumps(message)
                        )
                        
                        # 2. Produce enriched tick directly so Go consumer
                        #    can update stock_info immediately (bypass disabled
                        #    engine-indicator).
                        latest = history[-1]
                        # Compute prev_close from second-to-last day if available
                        prev_close = history[-2].get('Close', latest.get('Close', 0)) if len(history) >= 2 else latest.get('Close', 0)
                        last_price = latest.get('Close', 0)
                        change_pct = 0.0
                        if prev_close and prev_close > 0:
                            change_pct = round(((last_price - prev_close) / prev_close) * 100, 2)
                        
                        enriched_msg = {
                            'ticker': ticker_code,
                            'last_price': last_price,
                            'open': latest.get('Open', 0),
                            'high': latest.get('High', 0),
                            'low': latest.get('Low', 0),
                            'close': last_price,
                            'volume': int(latest.get('Volume', 0)),
                            'change_pct': change_pct,
                            'prev_close': prev_close,
                        }
                        producer.produce(
                            TOPIC_ENRICHED,
                            key=ticker_code,
                            value=json.dumps(enriched_msg)
                        )
                except Exception as e:
                    print(f"Error processing {ticker}: {e}")
                    continue
            
            if producer:
                producer.flush()
                print(f"Batch {i//BATCH_SIZE + 1}: {len(batch)} tickers sent to Kafka (raw + enriched)")
            
        except Exception as e:
            print(f"Batch error: {e}")
        
        time.sleep(DELAY)  # Rate limit protection
    
    print(f"Total: {len(all_tickers)} tickers downloaded")

def fetch_ihsg_index(producer):
    """Fetch real IHSG (^JKSE) composite index from Yahoo Finance."""
    try:
        ihsg = yf.Ticker("^JKSE")
        hist = ihsg.history(period="5d")
        if hist.empty or len(hist) < 1:
            print("IHSG: No data returned from yfinance")
            return
        
        latest = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) >= 2 else latest
        
        prev_close = float(prev['Close'])
        last_close = float(latest['Close'])
        change_pct = 0.0
        if prev_close > 0:
            change_pct = round(((last_close - prev_close) / prev_close) * 100, 2)
        
        index_msg = {
            'index_value': last_close,
            'change_pct': change_pct,
            'volume': int(latest['Volume']),
        }
        
        if producer:
            producer.produce(
                'idx.index.update',
                key='IHSG',
                value=json.dumps(index_msg)
            )
            producer.flush()
            print(f"IHSG Index: {last_close:,.2f} ({change_pct:+.2f}%) Vol: {int(latest['Volume']):,}")
    except Exception as e:
        print(f"IHSG fetch error: {e}")

if __name__ == "__main__":
    import os
    interval_minutes = int(os.getenv("FETCH_INTERVAL_MINUTES", "15"))
    print(f"Starting fetcher service. Will fetch every {interval_minutes} minutes.")
    while True:
        try:
            producer = get_producer()
            # Fetch real IHSG index first
            fetch_ihsg_index(producer)
            # Then download all individual tickers
            download_all_idx()
        except Exception as e:
            print(f"Error in main loop: {e}")
        
        print(f"Sleeping for {interval_minutes} minutes...")
        time.sleep(interval_minutes * 60)
