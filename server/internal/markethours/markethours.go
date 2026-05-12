package markethours

import (
	"time"
)

// holidays lists IDX non-trading dates in YYYY-MM-DD form.
//
// Source: BEI 2026 trading calendar — verify annually from idx.co.id.
//
// NOTE on maintenance burden: hardcoding the calendar means the binary has
// to be re-built every December when the next year's calendar is released.
// See PLAN_V2.md backlog item "Migrate holidays to bei_holidays DB table"
// for the follow-up that removes that annual re-deploy step.
//
// The entries below cover the 2026 BEI calendar — national public holidays,
// Lebaran/Idul Fitri collective leave, and year-end trading closure. Rows
// are grouped by reason so a maintainer reviewing the list next December
// can map each entry to an external source.
var holidays = map[string]bool{
	// New Year.
	"2026-01-01": true,
	// Isra Mi'raj (estimated — confirm against BEI circular once published).
	"2026-01-16": true,
	// Chinese New Year (Imlek).
	"2026-02-17": true,
	// Hari Raya Nyepi (Balinese Day of Silence).
	"2026-03-19": true,
	// Good Friday.
	"2026-04-03": true,
	// Idul Fitri 1447H + collective-leave cluster (estimated around 2026-03-20
	// first day; BEI typically closes a 5–6 day window). Confirm exact
	// dates from the official Kemenaker + BEI circular each year.
	"2026-03-20": true,
	"2026-03-23": true,
	"2026-03-24": true,
	// Labour Day.
	"2026-05-01": true,
	// Waisak (Vesak).
	"2026-05-31": true,
	// Kenaikan Isa Almasih (Ascension Day).
	"2026-05-14": true,
	// Pancasila Day.
	"2026-06-01": true,
	// Idul Adha (estimated; confirm from BEI circular).
	"2026-05-27": true,
	// Hijri New Year (Tahun Baru Islam).
	"2026-06-17": true,
	// Independence Day.
	"2026-08-17": true,
	// Maulid Nabi Muhammad.
	"2026-08-25": true,
	// Christmas Day + year-end trading closure cluster.
	"2026-12-24": true,
	"2026-12-25": true,
	"2026-12-31": true,
}

func GetMarketStatus(now time.Time) (string, string) {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}

	now = now.In(loc)
	dateStr := now.Format("2006-01-02")
	if holidays[dateStr] {
		return "closed", "Holiday"
	}

	weekday := now.Weekday()
	hour := now.Hour()
	min := now.Minute()
	timeVal := hour*60 + min

	if weekday == time.Saturday || weekday == time.Sunday {
		return "closed", "Weekend"
	} else if timeVal < 8*60+45 {
		return "closed", "Pre-Market Closed"
	} else if timeVal < 9*60 {
		return "pre-market", "Pre-Market"
	} else if timeVal < 12*60 && weekday != time.Friday {
		return "live", "Session 1"
	} else if timeVal < 11*60+30 && weekday == time.Friday {
		return "live", "Session 1"
	} else if timeVal < 13*60+30 && weekday != time.Friday {
		return "break", "Break"
	} else if timeVal < 14*60 && weekday == time.Friday {
		return "break", "Break"
	} else if timeVal < 16*60 {
		return "live", "Session 2"
	} else if timeVal < 16*60+15 {
		return "pre-close", "Pre-Close"
	} else {
		return "closed", "Market Closed"
	}
}

func IsMarketOpen(now time.Time) bool {
	session, _ := GetMarketStatus(now)
	return session == "pre-market" || session == "live" || session == "pre-close"
}

// IsMarketOpenOrEODWindow reports whether the market is currently in a
// session where aggregation should run. This is a superset of IsMarketOpen:
// it includes the 16:00–16:30 WIB "post-close settlement" window so that
// the aggregateMarketOverview loop captures the final-of-day values for
// market_overview and sector_performance before going idle until the next
// pre-market.
//
// Without this window the Sector Heatmap and market_overview volume freeze
// at whatever value was last written before 16:00 — the pre-close session
// ends at 16:15 and the loop's IsMarketOpen gate would immediately stop
// aggregation, missing the last few ticks that arrive during settlement.
//
// The window is intentionally generous (30 min) because the yfinance
// fetcher and TradingView webhook can both deliver delayed ticks up to
// ~15 min after the official close.
func IsMarketOpenOrEODWindow(now time.Time) bool {
	if IsMarketOpen(now) {
		return true
	}
	// Check if we are in the 16:00–16:30 WIB post-close window on a
	// trading day. GetMarketStatus returns "closed" / "Market Closed"
	// after 16:15, so we need a direct time check.
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	now = now.In(loc)
	if !IsTradingDay(now) {
		return false
	}
	timeVal := now.Hour()*60 + now.Minute()
	// 16:00 (960) to 16:30 (990) inclusive.
	return timeVal >= 16*60 && timeVal <= 16*60+30
}

// IsTradingDay reports whether the given time falls on an IDX trading day —
// i.e. not a Saturday, Sunday, or a registered holiday. The time is first
// normalised to Asia/Jakarta because the holiday table and weekday rule are
// both expressed in local Jakarta time.
//
// Used by watchlist_tracker to decide whether to snapshot closing prices
// and to count trading-day offsets for H+1..H+7.
func IsTradingDay(t time.Time) bool {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	t = t.In(loc)

	if holidays[t.Format("2006-01-02")] {
		return false
	}
	wd := t.Weekday()
	return wd != time.Saturday && wd != time.Sunday
}

// TradingDaysBetween returns the number of trading days strictly after
// `from` up to and including `to` (counted in Asia/Jakarta calendar days).
//
// Examples (Mon..Fri all trading, Sat/Sun not):
//   from=Mon, to=Mon  → 0 (same calendar day)
//   from=Mon, to=Tue  → 1 (H+1)
//   from=Fri, to=Mon  → 1 (weekend skipped)
//   from=Fri, to=Tue  → 2
//
// Returns 0 when `to` is not strictly after `from`. This matches the
// mental model of H+N on the watchlist UI: day_offset = N means
// "the Nth trading day after the entry date".
func TradingDaysBetween(from, to time.Time) int {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	from = from.In(loc)
	to = to.In(loc)

	// Compare on calendar-day granularity.
	fromDay := time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, loc)
	toDay := time.Date(to.Year(), to.Month(), to.Day(), 0, 0, 0, 0, loc)

	if !toDay.After(fromDay) {
		return 0
	}

	count := 0
	for cur := fromDay.AddDate(0, 0, 1); !cur.After(toDay); cur = cur.AddDate(0, 0, 1) {
		if IsTradingDay(cur) {
			count++
		}
	}
	return count
}

// AddTradingDays is the inverse of TradingDaysBetween: given a starting
// trading day `d` and a count `n`, it returns the date exactly `n` trading
// days after `d` (weekends and registered holidays skipped). Calendar time
// on `d` is normalised to Asia/Jakarta midnight so the returned value is
// always a clean date useful as an `ohlcv_daily.trade_date` lookup key.
//
// Semantics (aligned with TradingDaysBetween):
//   AddTradingDays(Mon, 0) = Mon   — same day, no advance
//   AddTradingDays(Mon, 1) = Tue   — H+1
//   AddTradingDays(Fri, 1) = Mon   — weekend skipped
//   AddTradingDays(Fri, 3) = Wed   — Sat/Sun skipped, then Mon/Tue/Wed
//
// Negative `n` walks backwards. If the starting day `d` itself is not a
// trading day (e.g. the caller passed a Saturday), the function still
// counts only trading days forward/backward — the starting point is used
// as an anchor, not required to be tradable itself.
func AddTradingDays(d time.Time, n int) time.Time {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	d = d.In(loc)
	cur := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc)

	if n == 0 {
		return cur
	}

	step := 1
	if n < 0 {
		step = -1
		n = -n
	}
	for i := 0; i < n; {
		cur = cur.AddDate(0, 0, step)
		if IsTradingDay(cur) {
			i++
		}
	}
	return cur
}
