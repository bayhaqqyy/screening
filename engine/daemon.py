import json
import os
import sys
import time
import sqlite3
import requests
import pandas as pd
import numpy as np
from datetime import datetime, time as datetime_time
import pytz
import traceback
import yfinance as yf
import ta

# Add current and parent directory to path to allow absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from screeners.bsjp import screen_bsjp_phase_1, screen_bsjp_phase_2
from screeners.bandar_analysis import analyze_accumulation
from utils.market_hours import is_market_open, get_market_status
from data.ticker_list import get_yfinance_tickers

# -----------------------------------------------------------------------------
# Configuration Loader
# -----------------------------------------------------------------------------
def load_dotenv():
    """Manually parse .env file to populate environment variables"""
    dotenv_paths = ['.env', '../.env', 'engine/.env']
    for path in dotenv_paths:
        if os.path.exists(path):
            print(f"Loading environment variables from {path}...")
            with open(path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' in line:
                        k, v = line.split('=', 1)
                        # Remove quotes if present
                        v_str = v.strip().strip("'").strip('"')
                        os.environ.setdefault(k.strip(), v_str)
            break

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", os.getenv("TELEGRAM_DEFAULT_CHAT_ID", ""))
FETCH_INTERVAL_MINUTES = int(os.getenv("FETCH_INTERVAL_MINUTES", "15"))
DATABASE_PATH = os.getenv("DATABASE_PATH", "data/engine.db")
BYPASS_MARKET_HOURS = os.getenv("BYPASS_MARKET_HOURS", "false").lower() == "true"

print(f"Configuration Loaded:")
print(f"  - TELEGRAM_BOT_TOKEN: {'Configured' if TELEGRAM_BOT_TOKEN else 'MISSING'}")
print(f"  - TELEGRAM_CHAT_ID: {TELEGRAM_CHAT_ID or 'MISSING'}")
print(f"  - FETCH_INTERVAL_MINUTES: {FETCH_INTERVAL_MINUTES}")
print(f"  - DATABASE_PATH: {DATABASE_PATH}")
print(f"  - BYPASS_MARKET_HOURS: {BYPASS_MARKET_HOURS}")

# -----------------------------------------------------------------------------
# SQLite Database Setup
# -----------------------------------------------------------------------------
def get_db_connection():
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    # Return rows as dict-like objects
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create screener_results table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS screener_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            strategy TEXT NOT NULL,
            ticker TEXT NOT NULL,
            signal TEXT,
            score INTEGER,
            payload TEXT NOT NULL,
            screened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_locked BOOLEAN DEFAULT 0
        )
    """)
    
    # Unique constraint on strategy + ticker
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_screener_strat_ticker 
        ON screener_results(strategy, ticker)
    """)
    
    # Create bandar_flow table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bandar_flow (
            ticker TEXT PRIMARY KEY,
            price REAL,
            volume INTEGER,
            vol_ratio REAL,
            obv_trend TEXT,
            ad_value REAL,
            close_position REAL,
            mfi REAL,
            net_buy_proxy INTEGER,
            accum_score REAL,
            signal TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create telegram_channels table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telegram_channels (
            chat_id TEXT PRIMARY KEY,
            name TEXT,
            is_active INTEGER DEFAULT 1
        )
    """)
    
    # Pre-seed with default channel from .env if present
    if TELEGRAM_CHAT_ID:
        cursor.execute("""
            INSERT OR IGNORE INTO telegram_channels (chat_id, name, is_active)
            VALUES (?, 'Default Channel', 1)
        """, (TELEGRAM_CHAT_ID,))
        
    conn.commit()
    conn.close()
    print("SQLite Database initialized successfully.")

# -----------------------------------------------------------------------------
# Technical Indicator Calculator
# -----------------------------------------------------------------------------
def enrich_data(df):
    """Calculate technical indicators using `ta` library"""
    df = df.copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
        
    if len(df) < 20:
        return df
        
    try:
        df['ema_5'] = ta.trend.EMAIndicator(df['Close'], window=5).ema_indicator()
        df['ema_20'] = ta.trend.EMAIndicator(df['Close'], window=20).ema_indicator()
        df['ema_50'] = ta.trend.EMAIndicator(df['Close'], window=50).ema_indicator()
        
        macd = ta.trend.MACD(df['Close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_hist'] = macd.macd_diff()
        
        df['rsi_14'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()
        
        bb = ta.volatility.BollingerBands(df['Close'], window=20, window_dev=2)
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        
        df['vwap'] = ta.volume.VolumeWeightedAveragePrice(
            high=df['High'], low=df['Low'], close=df['Close'], volume=df['Volume'], window=20
        ).volume_weighted_average_price()
    except Exception as e:
        print(f"Error calculating indicators: {e}")
        traceback.print_exc()
        
    return df

# -----------------------------------------------------------------------------
# Strategy Logics
# -----------------------------------------------------------------------------
def run_swing(df, ticker):
    latest = df.iloc[-1]
    prev = df.iloc[-2] if len(df) >= 2 else latest
    
    if pd.isna(latest.get('macd')) or pd.isna(latest.get('ema_20')) or pd.isna(latest.get('ema_50')) or pd.isna(latest.get('rsi_14')):
        return None
        
    # Standard Swing Confluence Criteria:
    # 1. Price is above EMA 20 (short-term trend is bullish)
    # 2. EMA 20 is above EMA 50 (medium-term trend is bullish)
    # 3. MACD crossed above MACD Signal (golden cross) or is positive and expanding
    # 4. RSI is in bullish zone (between 40 and 70)
    # 5. Volume is above its 20-day average (vol_ratio > 1.0)
    
    vol_ma_20 = df['Volume'].rolling(20).mean().iloc[-1]
    vol_ratio = latest['Volume'] / vol_ma_20 if vol_ma_20 > 0 else 0
    
    price_above_ema20 = latest['Close'] > latest['ema_20']
    ema20_above_ema50 = latest['ema_20'] > latest['ema_50']
    
    macd_signal_val = latest.get('macd_signal') or 0
    prev_macd_signal_val = prev.get('macd_signal') or 0
    
    macd_crossover = (latest['macd'] > macd_signal_val) and (prev['macd'] <= prev_macd_signal_val)
    macd_bullish = latest['macd'] > macd_signal_val and (latest['macd'] - macd_signal_val) > (prev['macd'] - prev_macd_signal_val)
    
    rsi_bullish = 40 < latest['rsi_14'] < 70
    volume_bullish = vol_ratio > 1.0
    
    score = 50
    signal = 'NEUTRAL'
    
    # Check trigger conditions: Crossover or positive expansion + Bullish trend
    if (macd_crossover or macd_bullish) and price_above_ema20 and ema20_above_ema50 and rsi_bullish and volume_bullish:
        # Calculate dynamic score based on trend strength
        score = 70 + int((latest['macd'] - macd_signal_val) * 100) + int((vol_ratio - 1.0) * 10)
        score = min(100, max(70, score))
        signal = 'BUY'
        
    if score < 70 or signal == 'NEUTRAL':
        return None

    entry_price = float(latest['Close'])
    tp = entry_price * 1.10 # 10% target profit
    sl = entry_price * 0.93 # 7% stop loss

    return {
        'ticker': ticker,
        'strategy': 'swing',
        'signal': signal,
        'score': score,
        'payload': {
            'price': entry_price,
            'entry_price': entry_price,
            'target': tp,
            'stop_loss': sl,
            'macd': float(latest['macd']),
            'ema_20': float(latest['ema_20']),
            'ema_50': float(latest['ema_50']),
            'rsi_14': float(latest['rsi_14']),
            'vol_ratio': float(vol_ratio)
        }
    }


# Numpy JSON encoder
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if pd.isna(obj):
            return None
        return super().default(obj)

# -----------------------------------------------------------------------------
# Telegram Formatter and Sender
# -----------------------------------------------------------------------------
def escape_md_v2(text: str) -> str:
    """Escapes special characters for Telegram MarkdownV2 parsing"""
    if not isinstance(text, str):
        text = str(text)
    # Characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
    escape_chars = r'_*[]()~`>#+-=|{}.!'
    import re
    return re.sub(r'([%s])' % re.escape(escape_chars), r'\\\1', text)

def format_alert_message(ticker, strategy, signal, score, payload, bandar_data=None):
    ticker_esc = escape_md_v2(ticker)
    strategy_esc = escape_md_v2(strategy.upper())
    signal_esc = escape_md_v2(signal)
    score_esc = escape_md_v2(str(score))
    
    price = payload.get('price') or payload.get('entry_price') or 0
    price_esc = escape_md_v2(f"{price:,.0f}")
    
    target = payload.get('target') or 0
    target_esc = escape_md_v2(f"{target:,.0f}")
    
    sl = payload.get('stop_loss') or 0
    sl_esc = escape_md_v2(f"{sl:,.0f}")
    
    # Technical metrics confluence
    metrics = []
    if 'rsi' in payload:
        val = payload['rsi']
        metrics.append(f"• 📈 RSI \\(14\\): {escape_md_v2(f'{val:.1f}')}")
    elif 'rsi_14' in payload:
        val = payload['rsi_14']
        metrics.append(f"• 📈 RSI \\(14\\): {escape_md_v2(f'{val:.1f}')}")
        
    if 'volume' in payload:
        val = payload['volume']
        metrics.append(f"• 📊 Volume: {escape_md_v2(f'{val:,}')}")
        
    if 'macd' in payload:
        val = payload['macd']
        metrics.append(f"• 📐 MACD: {escape_md_v2(f'{val:.2f}')}")
        
    if 'ema_20' in payload:
        val = payload['ema_20']
        metrics.append(f"• 📉 EMA 20: {escape_md_v2(f'{val:.1f}')}")
        
    if 'daily_return' in payload:
        val = payload['daily_return']
        metrics.append(f"• 📅 Daily Return: {escape_md_v2(f'{val:+.2f}%')}")
        
    if 'vol_ratio' in payload:
        val = payload['vol_ratio']
        metrics.append(f"• 🔊 Volume Ratio: {escape_md_v2(f'{val:.2f}x')}")

    # Bandar Flow if available
    bandar_text = ""
    if bandar_data:
        b_signal = escape_md_v2(bandar_data.get('signal', 'NEUTRAL'))
        b_score = escape_md_v2(f"{bandar_data.get('accum_score', 0):.1f}")
        b_vol_ratio = escape_md_v2(f"{bandar_data.get('vol_ratio', 0):.2f}")
        bandar_text = (
            f"\n🕵️‍♂️ *BANDAR FLOW ANALYSIS*\n"
            f"  ├ 📢 Accumulation: *{b_signal}*\n"
            f"  ├ 📊 Score: {b_score}/100\n"
            f"  └ 🔊 Vol Ratio: {b_vol_ratio}x\n"
        )
        
    tz = pytz.timezone('Asia/Jakarta')
    wib_now = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    wib_now_esc = escape_md_v2(wib_now)
    
    # Emojis for status
    emoji = "🚨"
    if signal in ("STRONG_BUY", "BUY"):
        emoji = "🚀"
    elif signal == "SELL":
        emoji = "⚠️"
    elif signal == "WATCHING":
        emoji = "👀"
        
    metrics_text = "\n".join(metrics)
    if metrics_text:
        metrics_text = f"\n🔍 *CONFLUENCE METRICS*\n{metrics_text}\n"

    msg = (
        f"{emoji} *IDX SCREENER ALERT* {emoji}\n\n"
        f"📌 *Stock:* {ticker_esc}\n"
        f"⚙️ *Strategy:* {strategy_esc}\n"
        f"🔔 *Signal:* *{signal_esc}*\n"
        f"📊 *Strategy Score:* {score_esc}/100\n"
        f"{metrics_text}"
        f"{bandar_text}\n"
        f"⚡ *EXECUTION MATRIX*\n"
        f"  ├ 💵 Entry Price: {price_esc}\n"
        f"  ├ 🎯 Target (TP): {target_esc}\n"
        f"  └ ⛔ Stop Loss (SL): {sl_esc}\n\n"
        f"🕒 Time: {wib_now_esc} WIB\n"
        f"🤖 _Automated IDX Screener Bot_"
    )
    return msg

def send_telegram_alert(text):
    if not TELEGRAM_BOT_TOKEN:
        print("Telegram Bot Token not configured. Skipping alert.")
        return False
        
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT chat_id FROM telegram_channels WHERE is_active = 1")
        channels = [row['chat_id'] for row in cursor.fetchall()]
        conn.close()
    except Exception as e:
        print(f"Error querying active channels: {e}")
        channels = [TELEGRAM_CHAT_ID] if TELEGRAM_CHAT_ID else []
        
    if not channels:
        print("No active Telegram channels registered. Skipping alert.")
        return False
        
    success = False
    for chat_id in channels:
        actual_chat_id = chat_id
        thread_id = None
        if ":" in str(chat_id):
            parts = str(chat_id).split(":")
            actual_chat_id = parts[0]
            try:
                thread_id = int(parts[1])
            except ValueError:
                pass

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": actual_chat_id,
            "text": text,
            "parse_mode": "MarkdownV2"
        }
        if thread_id is not None:
            payload["message_thread_id"] = thread_id

        try:
            r = requests.post(url, json=payload, timeout=15)
            res_json = r.json()
            if r.status_code == 200 and res_json.get("ok"):
                print(f"Telegram alert sent successfully to channel {chat_id}.")
                success = True
            else:
                print(f"Failed to send Telegram alert to {chat_id}: {res_json.get('description')}")
        except Exception as e:
            print(f"Error sending Telegram alert to {chat_id}: {e}")
            
    return success

# -----------------------------------------------------------------------------
# Main Processing Cycle
# -----------------------------------------------------------------------------
def process_tickers():
    print(f"\n--- Starting Screening Cycle at {datetime.now().isoformat()} ---")
    
    # Load tickers
    tickers_list = get_yfinance_tickers()
    if not tickers_list:
        print("No tickers loaded. Skipping cycle.")
        return
        
    print(f"Loaded {len(tickers_list)} tickers. Preparing batch download...")
    
    # SQLite Connection
    conn = get_db_connection()
    
    # Batch download configuration
    BATCH_SIZE = 50
    DELAY_BETWEEN_BATCHES = 3
    
    # Cache for storing current cycle results to send Telegram alerts after saving state
    all_signals_to_alert = []
    
    tz = pytz.timezone('Asia/Jakarta')
    now = datetime.now(tz)
    
    for idx in range(0, len(tickers_list), BATCH_SIZE):
        batch = tickers_list[idx:idx + BATCH_SIZE]
        batch_str = " ".join(batch)
        print(f"Downloading batch {idx//BATCH_SIZE + 1} of {len(tickers_list)//BATCH_SIZE + 1}...")
        
        try:
            data = yf.download(
                batch_str,
                period="60d",
                group_by='ticker',
                threads=True,
                progress=False
            )
            
            for full_ticker in batch:
                ticker = full_ticker.replace('.JK', '')
                try:
                    # Extract dataframe for this ticker
                    if len(batch) == 1:
                        df = data.dropna()
                    else:
                        if full_ticker not in data:
                            continue
                        df = data[full_ticker].dropna()
                        
                    if df.empty or len(df) < 20:
                        continue
                        
                    # Calculate Technical Indicators
                    df = enrich_data(df)
                    
                    # 1. Evaluate Bandar Accumulation Flow
                    bandar_res = analyze_accumulation(df, ticker)
                    if bandar_res:
                        # Save bandar flow to SQLite
                        cursor = conn.cursor()
                        cursor.execute("""
                            INSERT INTO bandar_flow (
                                ticker, price, volume, vol_ratio, obv_trend, ad_value, 
                                close_position, mfi, net_buy_proxy, accum_score, signal, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(ticker) DO UPDATE SET
                                price=excluded.price,
                                volume=excluded.volume,
                                vol_ratio=excluded.vol_ratio,
                                obv_trend=excluded.obv_trend,
                                ad_value=excluded.ad_value,
                                close_position=excluded.close_position,
                                mfi=excluded.mfi,
                                net_buy_proxy=excluded.net_buy_proxy,
                                accum_score=excluded.accum_score,
                                signal=excluded.signal,
                                updated_at=CURRENT_TIMESTAMP
                        """, (
                            ticker,
                            bandar_res['price'],
                            bandar_res['volume'],
                            bandar_res['vol_ratio'],
                            bandar_res['obv_trend'],
                            bandar_res['ad_value'],
                            bandar_res['close_position'],
                            bandar_res['mfi'],
                            1 if bandar_res['net_buy_proxy'] else 0,
                            bandar_res['accum_score'],
                            bandar_res['signal']
                        ))
                    
                    # 2. Run strategies
                    strategies_results = []
                    
                    # Swing
                    swing = run_swing(df, ticker)
                    if swing:
                        strategies_results.append(swing)
                        
                    # BSJP
                    # Check if Phase 1 (WATCHING) was triggered today for this ticker
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT payload FROM screener_results 
                        WHERE strategy='bsjp' AND ticker=?
                    """, (ticker,))
                    row = cursor.fetchone()
                    
                    has_watching_today = False
                    existing_payload = {}
                    if row:
                        existing_payload = json.loads(row['payload'])
                        # Check if it was updated today and had WATCHING status
                        if existing_payload.get('status') == 'WATCHING':
                            has_watching_today = True
                            
                    bsjp_res = None
                    if now.time() >= datetime_time(14, 0):
                        bsjp_res = screen_bsjp_phase_2(df, ticker, in_watchlist=has_watching_today)
                    else:
                        bsjp_res = screen_bsjp_phase_1(df, ticker)
                        
                    if bsjp_res and bsjp_res.get('bsjp_score', 0) >= 60:
                        entry_price = float(bsjp_res['price'])
                        bsjp = {
                            'ticker': ticker,
                            'strategy': 'bsjp',
                            'signal': bsjp_res.get('signal', 'WATCH'),
                            'score': int(bsjp_res.get('bsjp_score', 50)),
                            'payload': {
                                'price': entry_price,
                                'entry_price': entry_price,
                                'target': entry_price * 1.05,
                                'stop_loss': entry_price * 0.97,
                                'daily_return': float(bsjp_res.get('daily_return', 0)),
                                'vol_ratio': float(bsjp_res.get('vol_ratio', 0)),
                                'status': bsjp_res.get('status', 'WATCH')
                            }
                        }
                        strategies_results.append(bsjp)
                        
                    # 3. Process Strategy Results
                    for r in strategies_results:
                        strat_name = r['strategy']
                        sig_val = r['signal']
                        score_val = int(r['score'])
                        payload_dict = r['payload']
                        
                        # Freeze entry price if existing signal exists
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT is_locked, signal, payload FROM screener_results 
                            WHERE strategy = ? AND ticker = ?
                        """, (strat_name, ticker))
                        existing_row = cursor.fetchone()
                        
                        should_lock = 0
                        is_currently_locked = 0
                        existing_signal = None
                        
                        if strat_name == 'bsjp':
                            market_end = datetime_time(15, 30)
                            if now.time() >= market_end or not is_market_open():
                                should_lock = 1
                                
                        if existing_row:
                            is_currently_locked = existing_row['is_locked']
                            existing_signal = existing_row['signal']
                            
                            if is_currently_locked and strat_name == 'bsjp':
                                # Locked: do not modify entry price or details
                                continue
                                
                            # Retrieve and freeze entry price
                            try:
                                old_payload = json.loads(existing_row['payload'])
                                if 'entry_price' in old_payload:
                                    payload_dict['entry_price'] = old_payload['entry_price']
                            except Exception:
                                pass
                                
                        payload_json = json.dumps(payload_dict, cls=NumpyEncoder)
                        
                        # Save result
                        cursor.execute("""
                            INSERT INTO screener_results (strategy, ticker, signal, score, payload, screened_at, is_locked)
                            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                            ON CONFLICT(strategy, ticker) DO UPDATE SET
                                signal=excluded.signal,
                                score=excluded.score,
                                payload=excluded.payload,
                                screened_at=CURRENT_TIMESTAMP,
                                is_locked=excluded.is_locked
                        """, (strat_name, ticker, sig_val, score_val, payload_json, should_lock))
                        
                        # Queue Telegram Alert if:
                        # - It's a new strategy signal (no existing row)
                        # - Or the signal value has changed
                        if not existing_row or existing_signal != sig_val:
                            # Avoid spamming neutral updates, only send actionable alerts
                            if sig_val not in ("NEUTRAL", "WATCH"):
                                all_signals_to_alert.append({
                                    'ticker': ticker,
                                    'strategy': strat_name,
                                    'signal': sig_val,
                                    'score': score_val,
                                    'payload': payload_dict,
                                    'bandar_data': bandar_res
                                })
                                
                except Exception as ticker_err:
                    print(f"Error processing ticker {full_ticker}: {ticker_err}")
                    traceback.print_exc()
                    
            conn.commit()
            
        except Exception as batch_err:
            print(f"Error processing batch starting at {batch[0]}: {batch_err}")
            traceback.print_exc()
            
        # Rate limit protection between batches
        time.sleep(DELAY_BETWEEN_BATCHES)
        
    conn.close()
    
    # 4. Dispatch Telegram Alerts
    print(f"Screening cycle completed. Dispatched {len(all_signals_to_alert)} alerts to Telegram.")
    for alert in all_signals_to_alert:
        msg = format_alert_message(
            ticker=alert['ticker'],
            strategy=alert['strategy'],
            signal=alert['signal'],
            score=alert['score'],
            payload=alert['payload'],
            bandar_data=alert['bandar_data']
        )
        send_telegram_alert(msg)
        # Small delay between telegram messages to prevent rate limits from Telegram
        time.sleep(0.5)

# -----------------------------------------------------------------------------
# Telegram Command Handler Thread
# -----------------------------------------------------------------------------
import threading

class TelegramCommandListener(threading.Thread):
    def __init__(self, token, allowed_chat_id):
        super().__init__()
        self.token = token
        self.allowed_chat_id = allowed_chat_id
        self.running = True
        self.daemon = True
        self.last_update_id = 0
        self.current_thread_id = None
        
    def run(self):
        if not self.token:
            print("Telegram command listener: token is missing. Command listener disabled.")
            return
            
        try:
            r = requests.get(
                f"https://api.telegram.org/bot{self.token}/getUpdates",
                params={"limit": 1, "offset": -1, "timeout": 0},
                timeout=5
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("ok") and data.get("result"):
                    self.last_update_id = data["result"][0]["update_id"] + 1
                    print(f"Telegram command listener initialized with offset {self.last_update_id}")
        except Exception as e:
            print(f"Telegram command listener: failed to initialize offset: {e}")
            
        print("Telegram command listener thread started.")
        
        while self.running:
            try:
                url = f"https://api.telegram.org/bot{self.token}/getUpdates"
                params = {
                    "offset": self.last_update_id,
                    "timeout": 15,
                    "allowed_updates": ["message"]
                }
                r = requests.get(url, params=params, timeout=20)
                if r.status_code != 200:
                    time.sleep(5)
                    continue
                    
                res = r.json()
                if not res.get("ok"):
                    time.sleep(5)
                    continue
                    
                updates = res.get("result", [])
                for update in updates:
                    self.last_update_id = update["update_id"] + 1
                    message = update.get("message")
                    if not message:
                        continue
                    self.process_message(message)
            except Exception as e:
                print(f"Error in Telegram command listener loop: {e}")
                time.sleep(5)
                
    def is_authorized(self, chat_id):
        if not self.allowed_chat_id:
            return False
        allowed_list = [c.strip() for c in str(self.allowed_chat_id).split(',')]
        return str(chat_id) in allowed_list
        
    def process_message(self, message):
        text = message.get("text", "").strip()
        if not text.startswith("/"):
            return
            
        chat = message.get("chat", {})
        chat_id = chat.get("id")
        
        if not self.is_authorized(chat_id):
            print(f"Unauthorized command attempt from chat_id {chat_id}: {text}")
            return
            
        parts = text.split()
        cmd = parts[0].lower()
        if "@" in cmd:
            cmd = cmd.split("@")[0]
            
        print(f"Received command: {cmd} from chat {chat_id}")
        
        self.current_thread_id = message.get("message_thread_id")
        try:
            if cmd in ("/start", "/help"):
                self.handle_help(chat_id)
            elif cmd == "/health":
                self.handle_health(chat_id)
            elif cmd == "/status":
                self.handle_status(chat_id)
            elif cmd == "/signals":
                self.handle_signals(chat_id)
            elif cmd == "/swing":
                self.handle_swing(chat_id)
            elif cmd == "/bsjp":
                self.handle_bsjp(chat_id)
            elif cmd == "/bandar":
                ticker = parts[1].upper() if len(parts) > 1 else None
                self.handle_bandar(chat_id, ticker)
            elif cmd in ("/channels", "/channel"):
                self.handle_channels(chat_id)
            elif cmd == "/add_channel":
                self.handle_add_channel(chat_id, text)
            elif cmd == "/remove_channel":
                self.handle_remove_channel(chat_id, text)
        except Exception as e:
            print(f"Error handling command {cmd}: {e}")
            self.send_response(chat_id, f"❌ *Error:* {escape_md_v2(str(e))}")
        finally:
            self.current_thread_id = None
            
    def handle_help(self, chat_id):
        help_text = (
            "🤖 *IDX SCREENER COMMANDS*\n\n"
            "• `/health` \\- Check screener status and database health\n"
            "• `/status` \\- Get summary of strategies and active signals count\n"
            "• `/signals` \\- Show recent strategy buy/sell alerts \\(last 24h\\)\n"
            "• `/swing` \\- List active Swing buy signals\n"
            "• `/bsjp` \\- List active BSJP buy/watchlist signals\n"
            "• `/bandar <ticker>` \\- Show Bandar Flow details for a specific stock\n"
            "• `/channels` \\- List registered Telegram alert channels\n"
            "• `/add_channel <chat_id> <name>` \\- Register new Telegram alert channel\n"
            "• `/remove_channel <chat_id>` \\- Unregister a Telegram alert channel\n"
            "• `/help` \\- Show this help message"
        )
        self.send_response(chat_id, help_text)
        
    def handle_health(self, chat_id):
        db_ok = False
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            conn.close()
            db_ok = True
        except Exception:
            pass
            
        db_status = "✅ SQLite DB: CONNECTED" if db_ok else "❌ SQLite DB: DISCONNECTED"
        
        latest_time_str = "None"
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT screened_at FROM screener_results ORDER BY screened_at DESC LIMIT 1")
            row = cursor.fetchone()
            conn.close()
            if row:
                latest_time_str = row['screened_at']
        except Exception:
            pass
            
        tz = pytz.timezone('Asia/Jakarta')
        wib_now = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
        
        response = (
            "🏥 *SCREENER HEALTH STATUS*\n\n"
            f"{db_status}\n"
            f"🕒 Last Screen Time: `{escape_md_v2(latest_time_str)}` WIB\n"
            f"🕒 Current Time: `{escape_md_v2(wib_now)}` WIB\n"
        )
        self.send_response(chat_id, response)
        
    def handle_status(self, chat_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT strategy, COUNT(*) as cnt FROM screener_results WHERE signal NOT IN ('NEUTRAL', 'WATCH') GROUP BY strategy")
            rows = cursor.fetchall()
            cursor.execute("SELECT COUNT(DISTINCT ticker) FROM bandar_flow")
            total_tickers_row = cursor.fetchone()
            total_tickers = total_tickers_row[0] if total_tickers_row else 0
            conn.close()
            
            lines = []
            for row in rows:
                strat = row['strategy'].upper()
                cnt = row['cnt']
                lines.append(f"• *{escape_md_v2(strat)}*: {cnt} active signals")
                
            stats_text = "\n".join(lines) if lines else "No active strategy signals."
            
            response = (
                "📊 *SCREENER STATUS SUMMARY*\n\n"
                f"🔢 *Total Tracked Stocks:* {total_tickers}\n\n"
                f"*Active Strategy Signals:*\n"
                f"{stats_text}"
            )
            self.send_response(chat_id, response)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")
            
    def handle_signals(self, chat_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT strategy, ticker, signal, score, screened_at 
                FROM screener_results 
                WHERE signal NOT IN ('NEUTRAL', 'WATCH') 
                ORDER BY screened_at DESC LIMIT 15
            """)
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                self.send_response(chat_id, "ℹ️ No recent alerts found in the database.")
                return
                
            items = []
            for row in rows:
                strat = escape_md_v2(row['strategy'].upper())
                ticker = escape_md_v2(row['ticker'])
                sig = escape_md_v2(row['signal'])
                score = row['score']
                screened_at = escape_md_v2(row['screened_at'][:19])
                items.append(f"• *{ticker}* \\| {strat} \\| *{sig}* \\| Score: {score} \\| `{screened_at}`")
                
            response = "📋 *RECENT SCREENER ALERTS (LAST 15)*\n\n" + "\n".join(items)
            self.send_response(chat_id, response)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")

    def handle_swing(self, chat_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ticker, score, payload, screened_at 
                FROM screener_results 
                WHERE strategy = 'swing' AND signal = 'BUY'
                ORDER BY screened_at DESC LIMIT 20
            """)
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                self.send_response(chat_id, "ℹ️ No active *SWING* buy signals found\\.")
                return
                
            items = []
            for row in rows:
                ticker = escape_md_v2(row['ticker'])
                score = row['score']
                payload = json.loads(row['payload'])
                price = escape_md_v2(f"{payload.get('price', 0):,.0f}")
                tp = escape_md_v2(f"{payload.get('target', 0):,.0f}")
                sl = escape_md_v2(f"{payload.get('stop_loss', 0):,.0f}")
                items.append(f"🚀 *{ticker}* \\| Score: {score} \\| Price: {price} \\| TP: {tp} \\| SL: {sl}")
                
            response = "📊 *ACTIVE SWING BUY SIGNALS*\n\n" + "\n".join(items)
            self.send_response(chat_id, response)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")

    def handle_bsjp(self, chat_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ticker, signal, score, payload, screened_at 
                FROM screener_results 
                WHERE strategy = 'bsjp' AND signal NOT IN ('NEUTRAL', 'WATCH')
                ORDER BY screened_at DESC LIMIT 20
            """)
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                self.send_response(chat_id, "ℹ️ No active *BSJP* signals found\\.")
                return
                
            items = []
            for row in rows:
                ticker = escape_md_v2(row['ticker'])
                sig = escape_md_v2(row['signal'])
                score = row['score']
                payload = json.loads(row['payload'])
                price = escape_md_v2(f"{payload.get('price', 0):,.0f}")
                items.append(f"👀 *{ticker}* \\| *{sig}* \\| Score: {score} \\| Price: {price}")
                
            response = "📊 *ACTIVE BSJP SIGNALS*\n\n" + "\n".join(items)
            self.send_response(chat_id, response)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")

    def handle_channels(self, chat_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT chat_id, name, is_active FROM telegram_channels")
            rows = cursor.fetchall()
            conn.close()
            
            if not rows:
                self.send_response(chat_id, "📋 No Telegram alert channels registered\\.")
                return
                
            items = []
            for idx, row in enumerate(rows, 1):
                c_id = escape_md_v2(row['chat_id'])
                name = escape_md_v2(row['name'] or 'Unnamed')
                status = "Active" if row['is_active'] == 1 else "Inactive"
                items.append(f"{idx}\\. *{name}* \\| `{c_id}` \\| Status: {status}")
                
            response = "📋 *REGISTERED TELEGRAM ALERT CHANNELS*\n\n" + "\n".join(items)
            self.send_response(chat_id, response)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")

    def handle_add_channel(self, chat_id, text):
        parts = text.split()
        if len(parts) < 3:
            self.send_response(chat_id, "⚠️ Usage: `/add_channel <chat_id> <channel_name>`\nExample: `/add_channel -100123456789 AlertChannel`")
            return
            
        target_chat_id = parts[1]
        channel_name = " ".join(parts[2:])
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO telegram_channels (chat_id, name, is_active)
                VALUES (?, ?, 1)
                ON CONFLICT(chat_id) DO UPDATE SET
                    name=excluded.name,
                    is_active=1
            """, (target_chat_id, channel_name))
            conn.commit()
            conn.close()
            
            msg = f"✅ Channel *{escape_md_v2(channel_name)}* \\(`{escape_md_v2(target_chat_id)}`\\) registered successfully for alerts\\."
            self.send_response(chat_id, msg)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")

    def handle_remove_channel(self, chat_id, text):
        parts = text.split()
        if len(parts) < 2:
            self.send_response(chat_id, "⚠️ Usage: `/remove_channel <chat_id>`\nExample: `/remove_channel -100123456789`")
            return
            
        target_chat_id = parts[1]
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM telegram_channels WHERE chat_id = ?", (target_chat_id,))
            row = cursor.fetchone()
            
            if not row:
                conn.close()
                self.send_response(chat_id, f"❌ Chat ID `{escape_md_v2(target_chat_id)}` is not registered\\.")
                return
                
            channel_name = row['name']
            cursor.execute("DELETE FROM telegram_channels WHERE chat_id = ?", (target_chat_id,))
            conn.commit()
            conn.close()
            
            msg = f"✅ Channel *{escape_md_v2(channel_name)}* \\(`{escape_md_v2(target_chat_id)}`\\) successfully removed from alerts list\\."
            self.send_response(chat_id, msg)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")
            
    def handle_bandar(self, chat_id, ticker):
        if not ticker:
            self.send_response(chat_id, "⚠️ Usage: `/bandar <ticker>`\nExample: `/bandar BBRI`")
            return
            
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM bandar_flow WHERE ticker = ?", (ticker,))
            row = cursor.fetchone()
            conn.close()
            
            if not row:
                self.send_response(chat_id, f"❌ No Bandar Flow data found for stock *{escape_md_v2(ticker)}*\\.")
                return
                
            ticker_esc = escape_md_v2(row['ticker'])
            price = escape_md_v2(f"{row['price']:,.0f}")
            volume = escape_md_v2(f"{row['volume']:,}")
            vol_ratio = escape_md_v2(f"{row['vol_ratio']:.2f}x")
            obv_trend = escape_md_v2(row['obv_trend'])
            ad_value = escape_md_v2(f"{row['ad_value']:,.0f}")
            close_position = escape_md_v2(f"{row['close_position']:.2f}")
            mfi = escape_md_v2(f"{row['mfi']:.1f}")
            accum_score = escape_md_v2(f"{row['accum_score']:.1f}")
            signal = escape_md_v2(row['signal'])
            updated_at = escape_md_v2(row['updated_at'][:19])
            
            response = (
                f"🕵️‍♂️ *BANDAR FLOW: {ticker_esc}*\n\n"
                f"• *Accumulation Status:* *{signal}*\n"
                f"• *Composite Score:* {accum_score}/100\n"
                f"• *Price:* {price}\n"
                f"• *Volume:* {volume} \\({vol_ratio}\\)\n"
                f"• *OBV Trend:* {obv_trend}\n"
                f"• *A/D Value:* {ad_value}\n"
                f"• *Close Position:* {close_position}\n"
                f"• *MFI:* {mfi}\n\n"
                f"🕒 Updated: `{updated_at}`"
            )
            self.send_response(chat_id, response)
        except Exception as e:
            self.send_response(chat_id, f"❌ Error: {escape_md_v2(str(e))}")
            
    def send_response(self, chat_id, text):
        actual_chat_id = chat_id
        thread_id = self.current_thread_id
        
        # If chat_id contains a colon, it means it was a registered channel in format chat_id:thread_id
        if ":" in str(chat_id):
            parts = str(chat_id).split(":")
            actual_chat_id = parts[0]
            try:
                thread_id = int(parts[1])
            except ValueError:
                pass

        url = f"https://api.telegram.org/bot{self.token}/sendMessage"
        payload = {
            "chat_id": actual_chat_id,
            "text": text,
            "parse_mode": "MarkdownV2"
        }
        if thread_id is not None:
            payload["message_thread_id"] = thread_id

        try:
            requests.post(url, json=payload, timeout=10)
        except Exception as e:
            print(f"Error sending response to Telegram: {e}")

# -----------------------------------------------------------------------------
# Main Loop Daemon
# -----------------------------------------------------------------------------
def main():
    print("Initializing Daemon...")
    init_db()
    
    # Start Telegram Command Listener
    if TELEGRAM_BOT_TOKEN:
        print("Starting Telegram Command Listener thread...")
        listener = TelegramCommandListener(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
        listener.start()
    
    print("Daemon successfully initialized. Starting periodic screening loop.")
    
    while True:
        try:
            # Check market status
            status, reason = get_market_status()
            market_active = is_market_open()
            
            print(f"Current Market Status: {status.upper()} ({reason})")
            
            if market_active or BYPASS_MARKET_HOURS:
                process_tickers()
            else:
                print("Market is closed. Screening cycle skipped.")
                
        except Exception as loop_err:
            print(f"Fatal error in daemon execution loop: {loop_err}")
            traceback.print_exc()
            
        print(f"Sleeping for {FETCH_INTERVAL_MINUTES} minutes...")
        time.sleep(FETCH_INTERVAL_MINUTES * 60)

if __name__ == "__main__":
    main()
