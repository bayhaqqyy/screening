import pandas as pd

def screen_bsjp_phase_1(df, ticker):
    """
    Fase 1: Pantauan Sesi 1 (11:30)
    Kriteria: Volume > 1.5x avg, Return > 0.5%, Value > 10M
    """
    if len(df) < 20:
        return None
        
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    
    # Hitung rata-rata volume (20 hari)
    vol_ma_20 = df['Volume'].rolling(20).mean().iloc[-1]
    
    # Pada sesi 1, volume harian belum utuh (baru setengah hari).
    # Namun rule dari desain kita adalah vol > 1.5x untuk menangkap volume spike awal
    if latest['Volume'] < vol_ma_20 * 1.5:
        return None
        
    return_pct = ((latest['Close'] - prev['Close']) / prev['Close']) * 100
    if return_pct < 0.5:
        return None
        
    value = latest['Close'] * latest['Volume']
    if value < 10_000_000_000:
        return None
        
    return {
        'ticker': ticker,
        'price': latest['Close'],
        'return_sesi1': round(return_pct, 2),
        'volume_sesi1': latest['Volume'],
        'vol_ratio_sesi1': round(latest['Volume'] / vol_ma_20, 2),
        'value_sesi1': value,
        'status': 'WATCHING'
    }

def screen_bsjp_phase_2(df, ticker, in_watchlist=False):
    """
    Fase 2: Final Screening (15:30)
    Kriteria Inti: Volume >= 2x avg, Return >= 1%, Value > 20M
    """
    if len(df) < 20:
        return None
        
    latest = df.iloc[-1]
    prev = df.iloc[-2]
    
    # 1. CORE FILTER
    vol_ma_20 = df['Volume'].rolling(20).mean().iloc[-1]
    if latest['Volume'] < vol_ma_20 * 2.0:
        return None
        
    return_pct = ((latest['Close'] - prev['Close']) / prev['Close']) * 100
    if return_pct < 1.0:
        return None
        
    value = latest['Close'] * latest['Volume']
    if value < 20_000_000_000:
        return None
        
    # 2. ENHANCED SCORING (0-100)
    score = 0
    
    # VWAP (asumsi kolom vwap sudah ada dari indicator_consumer)
    vwap = latest.get('vwap')
    if vwap and latest['Close'] > vwap:
        score += 20
        
    # Higher High
    if latest['High'] > prev['High']:
        score += 10
        
    # RSI Sweet Spot (40-70)
    rsi_14 = latest.get('rsi_14')
    if rsi_14:
        if 40 < rsi_14 < 70:
            score += 15
        elif 30 < rsi_14 <= 40:
            score += 8
            
    # EMA Alignment
    ema_5 = latest.get('ema_5')
    ema_20 = latest.get('ema_20')
    if ema_5 and ema_20 and latest['Close'] > ema_5 > ema_20:
        score += 15
        
    # Bullish Close
    if latest['Close'] > latest['Open']:
        score += 10
        
    # Volume Intensity Bonus
    vol_ratio = latest['Volume'] / vol_ma_20
    if vol_ratio >= 3.0:
        score += 15
    elif vol_ratio >= 2.5:
        score += 10
    else:
        score += 5
        
    # Watchlist Bonus
    if in_watchlist:
        score += 15
        
    return {
        'ticker': ticker,
        'price': latest['Close'],
        'daily_return': round(return_pct, 2),
        'volume': latest['Volume'],
        'vol_ratio': round(vol_ratio, 2),
        'value': value,
        'rsi_14': round(rsi_14, 2) if rsi_14 else None,
        'bsjp_score': min(score, 100),
        'signal': 'STRONG_BUY' if score >= 70 else 'BUY' if score >= 40 else 'WATCH',
        'watchlist_phase1': in_watchlist
    }
