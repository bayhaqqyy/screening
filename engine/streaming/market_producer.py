import json
import time
import random
import threading
import csv
import yfinance as yf
from datetime import datetime
from kafka import KafkaProducer

KAFKA_BROKER = "localhost:9092"
TOPIC_MARKET = "idx.ohlcv.enriched"
TOPIC_BANDAR = "idx.bandar.flow"
CSV_PATH = "idx_all_companies_info.csv"

# Shared memory for real prices
real_price_cache = {}

def load_all_tickers():
    tickers = []
    try:
        with open(CSV_PATH, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            next(reader) # skip header
            for row in reader:
                if row and len(row) > 0:
                    tickers.append(row[0].strip())
    except Exception as e:
        print(f"Error loading CSV: {e}")
        tickers = ["BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM", "GOTO"]
    return tickers

def update_baseline_prices(all_tickers):
    """
    Runs every 60 seconds.
    Fetches the REAL current prices for a RANDOM batch of 50 tickers from the CSV.
    This ensures all 900+ tickers eventually rotate into the live feed without hitting rate limits.
    """
    while True:
        try:
            # Randomly pick 50 tickers for this minute's live feed
            batch = random.sample(all_tickers, min(50, len(all_tickers)))
            jk_tickers = [t + ".JK" for t in batch]
            
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Fetching real data for a new batch of {len(batch)} tickers (Syncing...)")
            data = yf.download(jk_tickers, period="1d", interval="1d", group_by="ticker", progress=False)
            
            # Clear old cache to only emit the newly fetched ones, or we can accumulate
            # Accumulating is fine, but clearing keeps the dashboard focused on the "active" random batch
            new_cache = {}
            
            for t_idx, ticker in enumerate(batch):
                try:
                    ticker_data = data[jk_tickers[t_idx]]
                    if ticker_data.empty:
                        continue
                    
                    latest = ticker_data.iloc[-1]
                    if str(latest['Close']) == 'nan':
                        continue

                    new_cache[ticker] = {
                        "open": float(latest['Open']),
                        "close": float(latest['Close']),
                        "high": float(latest['High']),
                        "low": float(latest['Low']),
                        "volume": int(latest['Volume'])
                    }
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
        
        # Wait 60 seconds before rotating to the next batch
        time.sleep(60)

def generate_bandar_flow(ticker, change_pct):
    if change_pct > 0.5:
        flow_type = "Accumulation"
    elif change_pct < -0.5:
        flow_type = "Distribution"
    else:
        flow_type = random.choice(["Accumulation", "Distribution", "Neutral"])
        
    net_volume = random.randint(10000, 500000)
    if flow_type == "Distribution":
        net_volume = -net_volume
    elif flow_type == "Neutral":
        net_volume = random.randint(-10000, 10000)

    return {
        "ticker": ticker,
        "timestamp": datetime.now().isoformat(),
        "flow_type": flow_type,
        "net_volume": net_volume,
        "top_buyers": random.sample(["YP", "CC", "PD", "NI", "AZ", "MG", "DR"], 2),
        "top_sellers": random.sample(["BK", "AK", "ZP", "CS", "RX", "YU", "KZ"], 2)
    }

def main():
    print(f"Connecting to Kafka broker at {KAFKA_BROKER}...")
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    print("Successfully connected to Kafka.")

    all_tickers = load_all_tickers()
    print(f"Loaded {len(all_tickers)} total tickers from CSV.")

    # Start background updater
    updater_thread = threading.Thread(target=update_baseline_prices, args=(all_tickers,), daemon=True)
    updater_thread.start()

    # Wait for the first cache population
    print("Waiting for initial data sync...")
    while len(real_price_cache) == 0:
        time.sleep(1)

    print("Starting High-Frequency Emitter...")
    try:
        while True:
            # Pick a random ticker from our cached real data
            ticker = random.choice(list(real_price_cache.keys()))
            base_data = real_price_cache[ticker]
            
            # Simulate high-frequency trading noise (Jitter: +/- 0.1% from the real close price)
            jitter_pct = random.uniform(-0.001, 0.001)
            live_price = base_data["close"] * (1 + jitter_pct)
            
            # Round to nearest logical fraction (for IDX usually round to nearest 1, 5, or 25)
            if live_price > 5000:
                live_price = round(live_price / 25) * 25
            elif live_price > 500:
                live_price = round(live_price / 5) * 5
            else:
                live_price = round(live_price)

            open_price = base_data["open"]
            change_pct = 0.0
            if open_price > 0:
                change_pct = round((live_price - open_price) / open_price * 100, 2)

            tick = {
                "ticker": ticker,
                "timestamp": datetime.now().isoformat(),
                "last_price": live_price,
                "open": open_price,
                "high": max(base_data["high"], live_price),
                "low": min(base_data["low"], live_price),
                "volume": base_data["volume"] + random.randint(10, 500), # simulate volume increasing
                "change_pct": change_pct
            }
            
            flow = generate_bandar_flow(ticker, change_pct)
            
            # Publish to Kafka
            producer.send(TOPIC_MARKET, key=ticker.encode('utf-8'), value=tick)
            producer.send(TOPIC_BANDAR, key=ticker.encode('utf-8'), value=flow)
            
            print(f"[{tick['timestamp']}] Tick: {ticker} @ {live_price} ({change_pct}%)")
            
            # Emit incredibly fast (2-3 times per second) without hitting API limits!
            time.sleep(random.uniform(0.3, 0.6))
            
    except KeyboardInterrupt:
        print("\nStopping market producer...")
    except Exception as e:
        print(f"Critical error occurred: {e}")
    finally:
        producer.close()

if __name__ == "__main__":
    main()
