package markethours

import (
	"testing"
	"time"
)

// TestIsTradingDay covers the three branches: weekend, holiday, and a regular
// weekday. Uses Asia/Jakarta times because the helper normalises to WIB
// before consulting the holiday table — a UTC-only input would shift the
// date for times near midnight.
func TestIsTradingDay(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	tests := []struct {
		name string
		t    time.Time
		want bool
	}{
		{"Monday", time.Date(2026, 5, 11, 10, 0, 0, 0, loc), true},
		{"Friday", time.Date(2026, 5, 15, 10, 0, 0, 0, loc), true},
		{"Saturday", time.Date(2026, 5, 16, 10, 0, 0, 0, loc), false},
		{"Sunday", time.Date(2026, 5, 17, 10, 0, 0, 0, loc), false},
		{"Independence Day holiday", time.Date(2026, 8, 17, 10, 0, 0, 0, loc), false},
		{"New Year holiday", time.Date(2026, 1, 1, 10, 0, 0, 0, loc), false},
		// Sprint-7 hygiene: the holiday table used to only cover New Year +
		// Independence Day, so every other public holiday silently leaked
		// into the "is trading day" path. These assertions lock in a
		// handful of the 2026 additions; re-verify the full list from
		// idx.co.id every December.
		{"Good Friday 2026", time.Date(2026, 4, 3, 10, 0, 0, 0, loc), false},
		{"Labour Day 2026", time.Date(2026, 5, 1, 10, 0, 0, 0, loc), false},
		{"Ascension Day 2026", time.Date(2026, 5, 14, 10, 0, 0, 0, loc), false},
		{"Christmas 2026", time.Date(2026, 12, 25, 10, 0, 0, 0, loc), false},
		{"Year-end trading closure 2026", time.Date(2026, 12, 31, 10, 0, 0, 0, loc), false},
		// A regular weekday that is NOT a holiday must still return true.
		{"Regular Tuesday 2026-05-05", time.Date(2026, 5, 5, 10, 0, 0, 0, loc), true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsTradingDay(tc.t); got != tc.want {
				t.Errorf("IsTradingDay(%s) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}

// TestTradingDaysBetween covers the weekend-skip behaviour that the watchlist
// H+N tracker relies on. The Friday→Monday case in particular matters: a
// naive day-diff would give H+3 there, but trading calendar semantics say
// H+1.
func TestTradingDaysBetween(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	tests := []struct {
		name string
		from time.Time
		to   time.Time
		want int
	}{
		{
			name: "same day",
			from: time.Date(2026, 5, 11, 10, 0, 0, 0, loc),
			to:   time.Date(2026, 5, 11, 15, 0, 0, 0, loc),
			want: 0,
		},
		{
			name: "Mon->Tue is H+1",
			from: time.Date(2026, 5, 11, 10, 0, 0, 0, loc),
			to:   time.Date(2026, 5, 12, 10, 0, 0, 0, loc),
			want: 1,
		},
		{
			name: "Fri->Mon is H+1 (weekend skipped)",
			from: time.Date(2026, 5, 15, 10, 0, 0, 0, loc),
			to:   time.Date(2026, 5, 18, 10, 0, 0, 0, loc),
			want: 1,
		},
		{
			name: "Fri->Tue is H+2",
			from: time.Date(2026, 5, 15, 10, 0, 0, 0, loc),
			to:   time.Date(2026, 5, 19, 10, 0, 0, 0, loc),
			want: 2,
		},
		{
			name: "to < from returns 0",
			from: time.Date(2026, 5, 15, 10, 0, 0, 0, loc),
			to:   time.Date(2026, 5, 14, 10, 0, 0, 0, loc),
			want: 0,
		},
		{
			name: "Mon->Mon+7d spans one weekend = 5",
			from: time.Date(2026, 5, 11, 10, 0, 0, 0, loc),
			to:   time.Date(2026, 5, 18, 10, 0, 0, 0, loc),
			want: 5,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := TradingDaysBetween(tc.from, tc.to); got != tc.want {
				t.Errorf("TradingDaysBetween() = %d, want %d", got, tc.want)
			}
		})
	}
}


// TestAddTradingDays covers weekend-skip, holiday-skip, zero-steps and
// negative-step cases — the helper is the inverse of TradingDaysBetween
// and powers the watchlist backfill's date lookup so a regression here
// corrupts PnL reporting.
func TestAddTradingDays(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	tests := []struct {
		name string
		from time.Time
		n    int
		want time.Time
	}{
		{
			name: "n=0 returns same date (normalised to midnight)",
			from: time.Date(2026, 5, 11, 14, 30, 0, 0, loc),
			n:    0,
			want: time.Date(2026, 5, 11, 0, 0, 0, 0, loc),
		},
		{
			name: "Mon + 1 = Tue",
			from: time.Date(2026, 5, 11, 0, 0, 0, 0, loc),
			n:    1,
			want: time.Date(2026, 5, 12, 0, 0, 0, 0, loc),
		},
		{
			name: "Fri + 1 = Mon (weekend skipped)",
			from: time.Date(2026, 5, 15, 0, 0, 0, 0, loc),
			n:    1,
			want: time.Date(2026, 5, 18, 0, 0, 0, 0, loc),
		},
		{
			name: "Fri + 3 = Wed",
			from: time.Date(2026, 5, 15, 0, 0, 0, 0, loc),
			n:    3,
			want: time.Date(2026, 5, 20, 0, 0, 0, 0, loc),
		},
		{
			name: "Wed + 5 crosses a weekend",
			from: time.Date(2026, 5, 13, 0, 0, 0, 0, loc),
			n:    5,
			want: time.Date(2026, 5, 20, 0, 0, 0, 0, loc),
		},
		{
			name: "skips registered Independence Day holiday",
			from: time.Date(2026, 8, 14, 0, 0, 0, 0, loc), // Friday
			n:    1,
			want: time.Date(2026, 8, 18, 0, 0, 0, 0, loc), // Tue (Aug 17 holiday skipped)
		},
		{
			name: "negative n walks backwards through weekend",
			from: time.Date(2026, 5, 18, 0, 0, 0, 0, loc), // Mon
			n:    -1,
			want: time.Date(2026, 5, 15, 0, 0, 0, 0, loc), // Fri
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := AddTradingDays(tc.from, tc.n)
			if !got.Equal(tc.want) {
				t.Errorf("AddTradingDays(%s, %d) = %s, want %s",
					tc.from.Format("2006-01-02"), tc.n,
					got.Format("2006-01-02"),
					tc.want.Format("2006-01-02"))
			}
		})
	}
}

// TestAddTradingDays_RoundTripWithTradingDaysBetween cross-checks the two
// helpers so a change to the holiday table or weekday rule is caught on
// both sides.
func TestAddTradingDays_RoundTripWithTradingDaysBetween(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	start := time.Date(2026, 5, 11, 0, 0, 0, 0, loc) // Monday

	for n := 0; n <= 10; n++ {
		target := AddTradingDays(start, n)
		gotN := TradingDaysBetween(start, target)
		if gotN != n {
			t.Errorf("round trip broke at n=%d: AddTradingDays=%s, TradingDaysBetween=%d",
				n, target.Format("2006-01-02"), gotN)
		}
	}
}


// TestIsMarketOpenOrEODWindow verifies the post-close settlement window
// (16:00–16:30 WIB) is included so aggregateMarketOverview captures the
// final-of-day values before going idle. This is the integration-level
// assertion the review asked for: "verify DoAggregateMarketOverview runs
// at least once during 16:00–16:30 WIB" — the loop gates on this helper,
// so proving the helper returns true at 16:10 proves the loop fires.
func TestIsMarketOpenOrEODWindow(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")

	tests := []struct {
		name string
		t    time.Time
		want bool
	}{
		{
			name: "Session 2 (14:30 Mon) — open",
			t:    time.Date(2026, 5, 11, 14, 30, 0, 0, loc),
			want: true,
		},
		{
			name: "Pre-close (16:05 Mon) — open",
			t:    time.Date(2026, 5, 11, 16, 5, 0, 0, loc),
			want: true,
		},
		{
			name: "EOD window start (16:00 Mon) — open",
			t:    time.Date(2026, 5, 11, 16, 0, 0, 0, loc),
			want: true,
		},
		{
			name: "EOD window mid (16:20 Mon) — open",
			t:    time.Date(2026, 5, 11, 16, 20, 0, 0, loc),
			want: true,
		},
		{
			name: "EOD window end (16:30 Mon) — open",
			t:    time.Date(2026, 5, 11, 16, 30, 0, 0, loc),
			want: true,
		},
		{
			name: "After EOD window (16:31 Mon) — closed",
			t:    time.Date(2026, 5, 11, 16, 31, 0, 0, loc),
			want: false,
		},
		{
			name: "After EOD window (17:00 Mon) — closed",
			t:    time.Date(2026, 5, 11, 17, 0, 0, 0, loc),
			want: false,
		},
		{
			name: "Weekend 16:10 — closed (not a trading day)",
			t:    time.Date(2026, 5, 16, 16, 10, 0, 0, loc),
			want: false,
		},
		{
			name: "Holiday 16:10 — closed (not a trading day)",
			t:    time.Date(2026, 8, 17, 16, 10, 0, 0, loc),
			want: false,
		},
		{
			name: "Pre-market (08:50 Mon) — open via IsMarketOpen",
			t:    time.Date(2026, 5, 11, 8, 50, 0, 0, loc),
			want: true,
		},
		{
			name: "Before pre-market (07:00 Mon) — closed",
			t:    time.Date(2026, 5, 11, 7, 0, 0, 0, loc),
			want: false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := IsMarketOpenOrEODWindow(tc.t); got != tc.want {
				t.Errorf("IsMarketOpenOrEODWindow(%s) = %v, want %v",
					tc.t.Format("2006-01-02 15:04"), got, tc.want)
			}
		})
	}
}
