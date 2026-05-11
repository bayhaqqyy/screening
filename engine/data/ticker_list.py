import requests
from datetime import datetime, timedelta
import json
import os
import csv

TICKER_CACHE_FILE = "data/cache/idx_tickers.json"
CACHE_MAX_AGE_DAYS = 7  # Refresh setiap 7 hari

def fetch_from_csv():
    """
    Read from local idx_all_companies_info.csv
    """
    csv_path = "idx_all_companies_info.csv"
    # Adjust path if run from a different directory
    if not os.path.exists(csv_path):
        csv_path = os.path.join(os.path.dirname(__file__), "..", "idx_all_companies_info.csv")
    
    tickers = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("Ticker"):
                    tickers.append({
                        "code": row["Ticker"],
                        "name": row["Name"],
                        "listing_date": None,
                        "shares": None,
                        "board": None,
                    })
    except Exception as e:
        print(f"Error reading CSV: {e}")
        
    return tickers

def load_tickers(force_refresh=False):
    """
    Load daftar ticker IDX.
    """
    # Cek cache
    if not force_refresh and os.path.exists(TICKER_CACHE_FILE):
        try:
            with open(TICKER_CACHE_FILE) as f:
                cache = json.load(f)
                last_updated = datetime.fromisoformat(cache['last_updated'])
                if datetime.now() - last_updated < timedelta(days=CACHE_MAX_AGE_DAYS):
                    print(f"Using cached tickers ({len(cache['tickers'])} saham, "
                          f"updated {cache['last_updated']})")
                    return cache['tickers']
        except Exception as e:
            print(f"Cache read error: {e}")
    
    # Fetch fresh
    print("Fetching fresh ticker list from local CSV...")
    try:
        tickers = fetch_from_csv()
        if tickers:
            _save_cache(tickers)
            print(f"Loaded {len(tickers)} tickers from CSV")
            return tickers
        else:
            raise Exception("CSV returned 0 tickers")
    except Exception as e:
        print(f"Fetch failed: {e}")
        # Fallback ke cache lama
        if os.path.exists(TICKER_CACHE_FILE):
            with open(TICKER_CACHE_FILE) as f:
                return json.load(f)['tickers']
        # If everything fails, provide a larger fallback list
        fallback = [
            {"code": "BBCA"}, {"code": "BBRI"}, {"code": "BMRI"}, {"code": "BBNI"},
            {"code": "TLKM"}, {"code": "ASII"}, {"code": "GOTO"}, {"code": "AMMN"},
            {"code": "BREN"}, {"code": "CUAN"}, {"code": "UNVR"},
            {"code": "ICBP"}, {"code": "INDF"}, {"code": "KLBF"}, {"code": "PGAS"},
            {"code": "PTBA"}, {"code": "ADRO"}, {"code": "ITMG"}, {"code": "UNTR"},
            {"code": "AMRT"}, {"code": "MDKA"}, {"code": "ANTM"}, {"code": "TINS"},
            {"code": "INCO"}, {"code": "BRIS"}, {"code": "CPIN"}, {"code": "JPFA"},
            {"code": "SMGR"}, {"code": "INTP"}, {"code": "EXCL"}, {"code": "ISAT"},
            {"code": "TOWR"}, {"code": "TBIG"}, {"code": "MAPI"}, {"code": "ACES"},
            {"code": "INET"}, {"code": "MEDC"}, {"code": "ESSA"}, {"code": "BRPT"},
            {"code": "TPIA"}, {"code": "HRUM"}, {"code": "GGRM"}, {"code": "HMSP"},
            {"code": "SIDO"}, {"code": "MYOR"}, {"code": "NISP"}, {"code": "PNLF"}
        ]
        return fallback

def get_ticker_codes():
    """Return list of ticker codes only"""
    tickers = load_tickers()
    return [t['code'] for t in tickers]

def get_yfinance_tickers():
    """Return list formatted for yfinance"""
    codes = get_ticker_codes()
    return [f"{code}.JK" for code in codes]

def _save_cache(tickers):
    os.makedirs(os.path.dirname(TICKER_CACHE_FILE), exist_ok=True)
    with open(TICKER_CACHE_FILE, 'w') as f:
        json.dump({
            'last_updated': datetime.now().isoformat(),
            'count': len(tickers),
            'tickers': tickers
        }, f, indent=2)

if __name__ == "__main__":
    t = get_yfinance_tickers()
    print(f"Total tickers: {len(t)}")
    print(f"Sample: {t[:5]}")
