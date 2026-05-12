import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import datetime
import pytz
import pytest
from utils.market_hours import get_market_status, is_market_open

def test_market_status():
    wib = pytz.timezone('Asia/Jakarta')
    
    # Weekend
    dt = wib.localize(datetime.datetime(2026, 5, 16, 10, 0, 0)) # Saturday
    assert get_market_status(dt) == ("closed", "Weekend")
    assert not is_market_open(dt)

    # Holiday
    dt = wib.localize(datetime.datetime(2026, 8, 17, 10, 0, 0)) # Independence Day
    assert get_market_status(dt) == ("closed", "Holiday")
    assert not is_market_open(dt)
    
    # Session 1 Mon-Thu
    dt = wib.localize(datetime.datetime(2026, 5, 11, 10, 0, 0)) # Monday
    assert get_market_status(dt) == ("live", "Session 1")
    assert is_market_open(dt)
    
    # Session 1 Friday
    dt = wib.localize(datetime.datetime(2026, 5, 15, 10, 0, 0)) # Friday
    assert get_market_status(dt) == ("live", "Session 1")
    assert is_market_open(dt)
    
    # Break Mon-Thu
    dt = wib.localize(datetime.datetime(2026, 5, 11, 12, 30, 0)) # Monday
    assert get_market_status(dt) == ("break", "Break")
    assert not is_market_open(dt)
    
    # Break Friday
    dt = wib.localize(datetime.datetime(2026, 5, 15, 11, 45, 0)) # Friday
    assert get_market_status(dt) == ("break", "Break")
    assert not is_market_open(dt)
    
    # Session 2 Mon-Thu
    dt = wib.localize(datetime.datetime(2026, 5, 11, 14, 0, 0)) # Monday
    assert get_market_status(dt) == ("live", "Session 2")
    assert is_market_open(dt)
    
    # Session 2 Friday
    dt = wib.localize(datetime.datetime(2026, 5, 15, 14, 30, 0)) # Friday
    assert get_market_status(dt) == ("live", "Session 2")
    assert is_market_open(dt)
    
    # Pre-Close
    dt = wib.localize(datetime.datetime(2026, 5, 11, 16, 5, 0)) # Monday
    assert get_market_status(dt) == ("pre-close", "Pre-Close")
    assert is_market_open(dt)
    
    # Market Closed After Hours
    dt = wib.localize(datetime.datetime(2026, 5, 11, 17, 0, 0)) # Monday
    assert get_market_status(dt) == ("closed", "Market Closed")
    assert not is_market_open(dt)
