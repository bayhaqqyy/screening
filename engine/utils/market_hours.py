import datetime
import pytz

HOLIDAYS = {
    datetime.date(2026, 1, 1),
    datetime.date(2026, 8, 17),
}

def get_market_status(dt=None):
    if dt is None:
        wib = pytz.timezone('Asia/Jakarta')
        dt = datetime.datetime.now(wib)
    else:
        if dt.tzinfo is None:
            wib = pytz.timezone('Asia/Jakarta')
            dt = wib.localize(dt)
        else:
            wib = pytz.timezone('Asia/Jakarta')
            dt = dt.astimezone(wib)
            
    if dt.date() in HOLIDAYS:
        return "closed", "Holiday"
        
    weekday = dt.weekday()
    if weekday >= 5: # Saturday=5, Sunday=6
        return "closed", "Weekend"
        
    t = dt.hour * 60 + dt.minute
    
    if t < 8*60 + 45:
        return "closed", "Pre-Market Closed"
    elif t < 9*60:
        return "pre-market", "Pre-Market"
    
    # Session 1
    if weekday < 4: # Mon-Thu
        if t < 12*60:
            return "live", "Session 1"
        elif t < 13*60 + 30:
            return "break", "Break"
    else: # Friday
        if t < 11*60 + 30:
            return "live", "Session 1"
        elif t < 14*60:
            return "break", "Break"
            
    # Session 2
    if t < 16*60:
        return "live", "Session 2"
    elif t < 16*60 + 15:
        return "pre-close", "Pre-Close"
    else:
        return "closed", "Market Closed"

def is_market_open(dt=None):
    session, _ = get_market_status(dt)
    return session in ["pre-market", "live", "pre-close"]
