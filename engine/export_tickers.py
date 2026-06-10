import json
import csv
import yfinance as yf
# Disable timezone and other caches to avoid SQLite database locking issues in multi-threaded environments
try:
    yf.cache._TzCacheManager._tz_cache = yf.cache._TzCacheDummy()
    yf.cache._CookieCacheManager._cookie_cache = yf.cache._CookieCacheDummy()
    yf.cache._ISINCacheManager._isin_cache = yf.cache._ISINCacheDummy()
except AttributeError:
    try:
        yf.set_tz_cache_location(None)
    except Exception:
        pass
from concurrent.futures import ThreadPoolExecutor, as_completed
import urllib.request
import time

def fetch_ticker_list():
    url = "https://raw.githubusercontent.com/hendroliem1990/repo/main/complete_idx_957_tickers.json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
    # data is a list of strings like "BBCA.JK"
    return data

def get_ticker_info(ticker_jk):
    try:
        t = yf.Ticker(ticker_jk)
        info = t.info
        return {
            "Ticker": ticker_jk.replace(".JK", ""),
            "Name": info.get("shortName", "N/A"),
            "Sector": info.get("sector", "N/A"),
            "Industry": info.get("industry", "N/A"),
            "MarketCap": info.get("marketCap", 0),
            "PreviousClose": info.get("previousClose", 0),
            "Status": "Success"
        }
    except Exception as e:
        return {
            "Ticker": ticker_jk.replace(".JK", ""),
            "Name": "N/A",
            "Sector": "N/A",
            "Industry": "N/A",
            "MarketCap": 0,
            "PreviousClose": 0,
            "Status": f"Error: {e}"
        }

def export_to_csv():
    print("Fetching list of all IDX tickers from github backup...")
    try:
        tickers = fetch_ticker_list()
    except Exception as e:
        print("Failed to fetch ticker list:", e)
        return
        
    print(f"Found {len(tickers)} tickers. Fetching company info from Yahoo Finance (this may take a few minutes)...")
    
    results = []
    # Fetch 50 as a quick sample first to test, but the user wants ALL.
    # Let's do all of them but with ThreadPool.
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_ticker = {executor.submit(get_ticker_info, t): t for t in tickers}
        
        count = 0
        for future in as_completed(future_to_ticker):
            count += 1
            res = future.result()
            results.append(res)
            if count % 50 == 0:
                print(f"Processed {count}/{len(tickers)} tickers...")
                
    elapsed = time.time() - start_time
    print(f"Finished fetching info in {elapsed:.1f} seconds.")
    
    csv_file = "idx_all_companies_info.csv"
    keys = ["Ticker", "Name", "Sector", "Industry", "MarketCap", "PreviousClose", "Status"]
    
    with open(csv_file, 'w', newline='', encoding='utf-8') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        for r in results:
            dict_writer.writerow(r)
            
    print(f"Successfully saved {len(results)} rows to {csv_file}")

if __name__ == "__main__":
    export_to_csv()
