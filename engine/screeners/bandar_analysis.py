import pandas as pd


def analyze_accumulation(df, ticker):
    """Proxy analisis akumulasi bandar dari OHLCV data.

    Sprint-7 hygiene pass — fallback values that masked a missing input
    have been replaced with ``return None`` so downstream consumers do
    not receive a fabricated "neutral" reading:

    * A candle where ``High == Low`` (no intraday range) no longer reports
      ``close_position = 0.5``; the whole analysis is dropped.
    * A failure inside the MFI calculation (e.g. fewer than 14 bars, all
      zero volume) no longer reports ``mfi = 50``; the whole analysis is
      dropped.

    ``bandar_consumer.py`` already gates the publish on ``if result:`` so
    returning ``None`` is safe — the consumer simply skips that ticker
    until enough data arrives.
    """
    if len(df) < 20:
        return None

    latest = df.iloc[-1]

    # 1. Volume Ratio
    vol_ma_20 = df['Volume'].rolling(20).mean().iloc[-1]
    vol_ratio = latest['Volume'] / vol_ma_20 if vol_ma_20 > 0 else 0

    # 2. OBV Trend
    df['obv'] = (df['Volume'] *
                 ((df['Close'] - df['Close'].shift(1)).apply(
                     lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
                  )).cumsum()
    obv_trend = df['obv'].iloc[-1] - df['obv'].iloc[-5] if len(df) >= 5 else 0

    # 3. Accumulation/Distribution Line
    high_low = latest['High'] - latest['Low']
    mfm = ((latest['Close'] - latest['Low']) - (latest['High'] - latest['Close'])) / high_low if high_low != 0 else 0
    ad_value = mfm * latest['Volume']

    # 4. Close Position (0=low, 1=high). A zero-range candle cannot carry
    # meaningful accumulation information — return None instead of the
    # old "50/50 neutral" fabrication.
    candle_range = latest['High'] - latest['Low']
    if candle_range <= 0:
        return None
    close_position = (latest['Close'] - latest['Low']) / candle_range

    # 5. MFI (Money Flow Index) via ta. If the underlying calculation
    # fails — most commonly because we have fewer than 14 typical-price
    # bars — drop the analysis rather than pretending MFI sits at 50.
    import ta
    try:
        mfi = ta.volume.MFIIndicator(
            high=df['High'],
            low=df['Low'],
            close=df['Close'],
            volume=df['Volume'],
            window=14,
        ).money_flow_index().iloc[-1]
    except Exception:
        return None
    if not pd.notnull(mfi):
        return None

    # 6. Net Buy Proxy
    vwap = (df['Close'] * df['Volume']).rolling(20).sum() / df['Volume'].rolling(20).sum()
    net_buy_signal = latest['Close'] > vwap.iloc[-1]

    # Composite Accumulation Score (0-100)
    accum_score = 0
    accum_score += min(vol_ratio * 15, 30)                               # Volume ratio (max 30)
    accum_score += (20 if obv_trend > 0 else 0)                          # OBV trending up (20)
    accum_score += (close_position * 20)                                 # Close near high (max 20)
    accum_score += (15 if mfi > 50 else 0)                               # MFI bullish (15)
    accum_score += (15 if pd.notnull(net_buy_signal) and net_buy_signal else 0)  # Net buy proxy (15)

    return {
        'ticker': ticker,
        'price': float(latest['Close']),
        'volume': int(latest['Volume']),
        'vol_ratio': round(float(vol_ratio), 2),
        'obv_trend': 'UP' if obv_trend > 0 else 'DOWN',
        'ad_value': round(float(ad_value), 0),
        'close_position': round(float(close_position), 2),
        'mfi': round(float(mfi), 1),
        'net_buy_proxy': bool(net_buy_signal),
        'accum_score': round(float(min(accum_score, 100)), 1),
        'signal': 'STRONG_ACCUM' if accum_score >= 70 else
                  'ACCUMULATING' if accum_score >= 50 else
                  'NEUTRAL' if accum_score >= 30 else 'DISTRIBUTING',
    }
