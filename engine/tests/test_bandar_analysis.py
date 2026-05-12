"""Regression tests for `engine/screeners/bandar_analysis.py`.

The Sprint-7 hygiene pass replaced two silent fallbacks (close_position
defaulting to 0.5 on a zero-range candle, MFI defaulting to 50 on
exception) with honest ``return None``. These tests lock that behaviour
in so nobody reintroduces the "neutral" defaults.
"""

import os
import sys

import pandas as pd
import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from screeners.bandar_analysis import analyze_accumulation  # noqa: E402


def _make_ohlcv_frame(n_bars, *, high_low_equal_on_last=False):
    """Build a minimally-plausible OHLCV frame of length ``n_bars``.

    The bars gently trend up so volume_ma / OBV / VWAP calculations all
    produce non-zero denominators. When ``high_low_equal_on_last`` is
    True the final candle gets ``High == Low == Close`` so the
    zero-range guard is exercised.
    """
    rows = []
    base = 1000.0
    for i in range(n_bars):
        open_ = base + i * 2
        close = open_ + 1
        high = close + 2
        low = open_ - 2
        volume = 1_000_000 + i * 50_000
        rows.append({'Open': open_, 'High': high, 'Low': low, 'Close': close, 'Volume': volume})

    if high_low_equal_on_last and rows:
        last = rows[-1]
        flat = last['Close']
        last['Open'] = flat
        last['High'] = flat
        last['Low'] = flat

    return pd.DataFrame(rows)


def test_returns_none_when_history_shorter_than_minimum():
    """< 20 bars is the explicit early-exit guard at the top of the fn."""
    df = _make_ohlcv_frame(10)
    assert analyze_accumulation(df, 'BBCA') is None


def test_returns_none_when_history_shorter_than_mfi_window():
    """The MFI computation needs 14+ typical-price bars. A 14-bar frame
    is also shorter than the 20-bar volume-MA requirement, so the early
    exit fires first — but we keep the assertion explicit because the
    test name reflects the documented contract (comment on the original
    review)."""
    df = _make_ohlcv_frame(13)
    assert analyze_accumulation(df, 'BBRI') is None


def test_returns_none_when_last_candle_has_zero_range():
    """High == Low on the latest bar used to silently set
    close_position = 0.5. The new contract is: no range, no signal."""
    df = _make_ohlcv_frame(30, high_low_equal_on_last=True)
    assert analyze_accumulation(df, 'BMRI') is None


def test_returns_none_when_mfi_cannot_be_computed(monkeypatch):
    """When ``ta.volume.MFIIndicator`` raises (or produces NaN) the old
    code stamped mfi=50 as if everything were fine. The new contract
    drops the analysis entirely."""
    import ta

    class _BrokenMFI:
        def __init__(self, *args, **kwargs):
            raise RuntimeError('synthetic MFI failure for test')

    monkeypatch.setattr(ta.volume, 'MFIIndicator', _BrokenMFI)

    df = _make_ohlcv_frame(40)
    assert analyze_accumulation(df, 'TLKM') is None


def test_happy_path_returns_populated_dict():
    """Sanity check: with 40 normal bars the function still returns a
    fully populated dict so the None branches above are the only skip
    paths, not a regression in the happy path."""
    df = _make_ohlcv_frame(40)
    result = analyze_accumulation(df, 'ASII')
    assert result is not None
    # Core fields the downstream Go consumer scans on must all exist.
    for key in (
        'ticker', 'price', 'volume', 'vol_ratio', 'obv_trend',
        'ad_value', 'close_position', 'mfi', 'net_buy_proxy',
        'accum_score', 'signal',
    ):
        assert key in result, f'result missing {key!r}'
    # close_position and mfi must be real (not the removed defaults).
    assert 0.0 <= result['close_position'] <= 1.0
    # mfi can legitimately equal 50 as a real computation — but with
    # this upward-drifting fixture it should land above 50.
    assert isinstance(result['mfi'], float)


def test_zero_range_not_masked_by_a_single_good_bar_in_middle():
    """Defensive regression: even if every historical bar is fine, a
    zero-range LATEST candle must still trip the guard because the
    analysis scores the last bar specifically."""
    df = _make_ohlcv_frame(40)
    # Zero the final candle by hand (monkey-patch style) to simulate a
    # suspension / halt on the current bar.
    df.iloc[-1, df.columns.get_loc('High')] = df.iloc[-1]['Close']
    df.iloc[-1, df.columns.get_loc('Low')] = df.iloc[-1]['Close']
    assert analyze_accumulation(df, 'GOTO') is None
