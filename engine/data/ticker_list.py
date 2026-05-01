import requests
from datetime import datetime, timedelta
import json
import os

TICKER_CACHE_FILE = "data/cache/idx_tickers.json"
CACHE_MAX_AGE_DAYS = 7  # Refresh setiap 7 hari

def fetch_from_idx_website():
    """
    Scrape dari idx.co.id
    URL: https://www.idx.co.id/primary/StockData/GetStockData
    """
    url = "https://www.idx.co.id/primary/StockData/GetStockData"
    params = {"start": 0, "length": 9999, "columnOrder": 0, "orderDir": "asc"}
    headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://www.idx.co.id"}
    
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    
    tickers = []
    for item in data.get("data", []):
        tickers.append({
            "code": item["Code"],
            "name": item["Name"],
            "listing_date": item.get("ListingDate"),
            "shares": item.get("Shares"),
            "board": item.get("ListingBoard"),  # Main/Dev/Akselerasi
        })
    
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
    print("Fetching fresh ticker list from IDX...")
    try:
        tickers = fetch_from_idx_website()
        _save_cache(tickers)
        print(f"Fetched {len(tickers)} tickers from IDX")
        return tickers
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
