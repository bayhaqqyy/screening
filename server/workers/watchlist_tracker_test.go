package workers

import (
	"database/sql"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/internal/markethours"
)

// TestBackfillWatchlistMissingSnapshots_SkipsGaps is the regression guard
// for the Sprint-7 fix: the backfill must never stamp today's live price
// into an H+N cell. It has to look up the actual historical close from
// ohlcv_daily at the corresponding trading date, and when that row is
// missing (sql.ErrNoRows), skip the cell silently.
//
// Scenario:
//   - Entry date: Monday 2026-05-11 (Mon..Fri are trading days in our
//     Asia/Jakarta calendar, no holidays in the window).
//   - "now" clock: Thursday 2026-05-14 → TradingDaysBetween == 3, so
//     offsets 1, 2, 3 are in range.
//   - ohlcv_daily has a close price for H+1 and H+3 but NOT for H+2 (the
//     gap we're asserting on).
//
// Expectations:
//   - INSERT fires for H+1 (with the historical H+1 close) and H+3 (with
//     the historical H+3 close).
//   - NO INSERT fires for H+2 — the missing ohlcv row must cause a silent
//     skip, not a live-price fabrication.
func TestBackfillWatchlistMissingSnapshots_SkipsGaps(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db

	loc, _ := time.LoadLocation("Asia/Jakarta")
	entryDate := time.Date(2026, 5, 11, 0, 0, 0, 0, loc) // Monday
	now := time.Date(2026, 5, 14, 15, 0, 0, 0, loc)      // Thursday

	// Sanity check the calendar math the backfill relies on. If this
	// drifts the whole test is meaningless, so we assert it up front.
	if got := markethours.TradingDaysBetween(entryDate, now); got != 3 {
		t.Fatalf("test setup broken: TradingDaysBetween = %d, want 3", got)
	}

	watchlistID := "wl-1"
	ticker := "BBCA"

	// 1. The initial watchlist scan returns one row.
	mock.ExpectQuery(`SELECT w\.id, w\.ticker, w\.entry_date\s+FROM watchlists w\s+WHERE w\.entry_date IS NOT NULL`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "ticker", "entry_date"}).
			AddRow(watchlistID, ticker, entryDate))

	// 2. H+1 lookup — Tue 2026-05-12 — returns 9300.
	h1Date := markethours.AddTradingDays(entryDate, 1)
	mock.ExpectQuery(`SELECT COALESCE\(close, 0\) FROM ohlcv_daily\s+WHERE ticker = \$1 AND trade_date = \$2`).
		WithArgs(ticker, h1Date).
		WillReturnRows(sqlmock.NewRows([]string{"close"}).AddRow(9300.0))

	// 3. H+1 insert fires with the historical close + the H+1 trade date
	//    (NOT today's date — the recorded_at must reflect when the price
	//    was taken).
	mock.ExpectExec(`INSERT INTO watchlist_daily_prices`).
		WithArgs(watchlistID, 1, 9300.0, h1Date).
		WillReturnResult(sqlmock.NewResult(1, 1))

	// 4. H+2 lookup — Wed 2026-05-13 — returns sql.ErrNoRows. This is
	//    the critical assertion: NO InsertExec for H+2 afterwards.
	h2Date := markethours.AddTradingDays(entryDate, 2)
	mock.ExpectQuery(`SELECT COALESCE\(close, 0\) FROM ohlcv_daily\s+WHERE ticker = \$1 AND trade_date = \$2`).
		WithArgs(ticker, h2Date).
		WillReturnError(sql.ErrNoRows)

	// 5. H+3 lookup — Thu 2026-05-14 — returns 9500.
	h3Date := markethours.AddTradingDays(entryDate, 3)
	mock.ExpectQuery(`SELECT COALESCE\(close, 0\) FROM ohlcv_daily\s+WHERE ticker = \$1 AND trade_date = \$2`).
		WithArgs(ticker, h3Date).
		WillReturnRows(sqlmock.NewRows([]string{"close"}).AddRow(9500.0))

	// 6. H+3 insert fires.
	mock.ExpectExec(`INSERT INTO watchlist_daily_prices`).
		WithArgs(watchlistID, 3, 9500.0, h3Date).
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := BackfillWatchlistMissingSnapshots(now); err != nil {
		t.Fatalf("BackfillWatchlistMissingSnapshots: %v", err)
	}

	// Any unmet expectation OR an unexpected Exec (for example, an
	// accidental H+2 stamp using live price) will surface here.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet / unexpected DB calls: %v", err)
	}
}

// TestBackfillWatchlistMissingSnapshots_ZeroClosesSkipped verifies that a
// COALESCE(close, 0) result of 0 is treated the same as "no data" — we
// never insert a zero-price cell.
func TestBackfillWatchlistMissingSnapshots_ZeroClosesSkipped(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	database.DB = db

	loc, _ := time.LoadLocation("Asia/Jakarta")
	entryDate := time.Date(2026, 5, 11, 0, 0, 0, 0, loc)
	now := time.Date(2026, 5, 12, 15, 0, 0, 0, loc) // Tuesday → offset=1

	mock.ExpectQuery(`SELECT w\.id, w\.ticker, w\.entry_date\s+FROM watchlists w\s+WHERE w\.entry_date IS NOT NULL`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "ticker", "entry_date"}).
			AddRow("wl-2", "BBRI", entryDate))

	h1Date := markethours.AddTradingDays(entryDate, 1)
	mock.ExpectQuery(`SELECT COALESCE\(close, 0\) FROM ohlcv_daily\s+WHERE ticker = \$1 AND trade_date = \$2`).
		WithArgs("BBRI", h1Date).
		WillReturnRows(sqlmock.NewRows([]string{"close"}).AddRow(0.0))

	// No INSERT expected — zero close must be treated as missing data.

	if err := BackfillWatchlistMissingSnapshots(now); err != nil {
		t.Fatalf("BackfillWatchlistMissingSnapshots: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet / unexpected DB calls: %v", err)
	}
}
