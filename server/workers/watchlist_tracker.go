package workers

// watchlist_tracker.go — Sprint 4 Watchlist V2 daily snapshot worker.
//
// Two entry points are exposed:
//
//   StartWatchlistTracker              — long-running goroutine that at 15:30
//                                        WIB on every trading day writes a
//                                        H+N snapshot for each active
//                                        watchlist row.
//   BackfillWatchlistMissingSnapshots  — one-shot sweep (called on boot) that
//                                        fills any (watchlist_id, day_offset)
//                                        cells missing between the entry_date
//                                        and today using the current last
//                                        price as a best-effort proxy.
//
// Both functions share SnapshotWatchlistDaily, which is the actual DB write
// for a single "today" pass — exported so tests and ad-hoc admin tooling can
// invoke it directly.

import (
	"database/sql"
	"log"
	"time"

	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/internal/markethours"
)

// SnapshotWatchlistDaily computes the trading-day offset for every watchlist
// row relative to its entry_date and writes/updates the corresponding row in
// watchlist_daily_prices. Snapshots beyond H+7 are ignored since the UI
// tracks only seven days.
//
// `now` is the reference wall time (usually time.Now()). It is passed in so
// tests can inject a deterministic clock.
func SnapshotWatchlistDaily(now time.Time) error {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowWIB := now.In(loc)

	// Nothing to record on non-trading days — weekend/holiday closing
	// prices are stale duplicates of the prior Friday.
	if !markethours.IsTradingDay(nowWIB) {
		return nil
	}

	rows, err := database.DB.Query(`
		SELECT w.id, w.ticker, w.entry_date, COALESCE(s.last_price, 0)
		FROM watchlists w
		LEFT JOIN stock_info s ON s.ticker = w.ticker
		WHERE w.entry_date IS NOT NULL
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	today := time.Date(nowWIB.Year(), nowWIB.Month(), nowWIB.Day(), 0, 0, 0, 0, loc)
	recorded := 0

	for rows.Next() {
		var (
			id        string
			ticker    string
			entryDate time.Time
			price     float64
		)
		if err := rows.Scan(&id, &ticker, &entryDate, &price); err != nil {
			log.Printf("watchlist_tracker: scan failed: %v", err)
			continue
		}

		offset := markethours.TradingDaysBetween(entryDate, today)
		if offset < 1 || offset > 7 {
			continue
		}
		if price <= 0 {
			// No stock_info row yet — skip rather than lock in a zero.
			continue
		}

		if err := upsertDailySnapshot(id, offset, price, today); err != nil {
			log.Printf("watchlist_tracker: upsert %s H+%d failed: %v", ticker, offset, err)
			continue
		}
		recorded++
	}

	if recorded > 0 {
		log.Printf("watchlist_tracker: recorded %d daily snapshots for %s", recorded, today.Format("2006-01-02"))
	}
	return nil
}

// BackfillWatchlistMissingSnapshots fills H+1..H+7 cells that are currently
// missing for any watchlist row. On first deploy of V2 and after an outage
// we want the historical H+N columns to reflect the actual trading-day
// closes, not today's live price — writing `last_price` into every missing
// cell makes PnL math a lie.
//
// For each (watchlist, offset) pair we compute the real calendar date
// (`entry_date + offset trading days`) and look up that day's closing
// price in `ohlcv_daily`. If the OHLCV row is missing we skip the cell
// rather than stamping something fabricated — a visible gap in the UI is
// strictly better than a plausible wrong number.
//
// Writes are idempotent (INSERT ... ON CONFLICT DO NOTHING) so re-running
// is safe: only gaps get filled, accurate historical samples are never
// overwritten.
func BackfillWatchlistMissingSnapshots(now time.Time) error {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	nowWIB := now.In(loc)
	today := time.Date(nowWIB.Year(), nowWIB.Month(), nowWIB.Day(), 0, 0, 0, 0, loc)

	rows, err := database.DB.Query(`
		SELECT w.id, w.ticker, w.entry_date
		FROM watchlists w
		WHERE w.entry_date IS NOT NULL
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	filled := 0
	skipped := 0
	for rows.Next() {
		var (
			id        string
			ticker    string
			entryDate time.Time
		)
		if err := rows.Scan(&id, &ticker, &entryDate); err != nil {
			log.Printf("watchlist_tracker backfill: scan failed: %v", err)
			continue
		}

		maxOffset := markethours.TradingDaysBetween(entryDate, today)
		if maxOffset > 7 {
			maxOffset = 7
		}
		for off := 1; off <= maxOffset; off++ {
			tradeDate := markethours.AddTradingDays(entryDate, off)

			// Pull the real close for that trading day. sql.ErrNoRows is
			// the expected "we don't have data for that date yet" path —
			// skip the cell silently, do not stamp today's price.
			var closePrice float64
			err := database.DB.QueryRow(`
				SELECT COALESCE(close, 0) FROM ohlcv_daily
				WHERE ticker = $1 AND trade_date = $2
			`, ticker, tradeDate).Scan(&closePrice)
			if err == sql.ErrNoRows || closePrice <= 0 {
				skipped++
				continue
			}
			if err != nil {
				log.Printf("watchlist_tracker backfill: lookup %s H+%d (%s) failed: %v",
					ticker, off, tradeDate.Format("2006-01-02"), err)
				continue
			}

			// INSERT..ON CONFLICT DO NOTHING ensures we only fill gaps,
			// never overwrite an accurate historical sample.
			res, execErr := database.DB.Exec(`
				INSERT INTO watchlist_daily_prices (watchlist_id, day_offset, price, recorded_at)
				VALUES ($1, $2, $3, $4)
				ON CONFLICT (watchlist_id, day_offset) DO NOTHING
			`, id, off, closePrice, tradeDate)
			if execErr != nil {
				log.Printf("watchlist_tracker backfill: %s H+%d insert failed: %v", ticker, off, execErr)
				continue
			}
			if n, _ := res.RowsAffected(); n > 0 {
				filled++
			}
		}
	}

	if filled > 0 || skipped > 0 {
		log.Printf("watchlist_tracker backfill: filled %d, skipped %d missing snapshots", filled, skipped)
	}
	return nil
}

// StartWatchlistTracker launches the daily snapshot loop. The goroutine wakes
// once a minute and fires SnapshotWatchlistDaily when WIB crosses 15:30. The
// one-minute tick is cheap and lets the worker survive DST-like clock jumps
// without needing a precise timer.
func StartWatchlistTracker() {
	// Catch up on any gaps left by previous downtime.
	if err := BackfillWatchlistMissingSnapshots(time.Now()); err != nil {
		log.Printf("watchlist_tracker: initial backfill failed: %v", err)
	}

	go func() {
		loc, err := time.LoadLocation("Asia/Jakarta")
		if err != nil {
			loc = time.FixedZone("WIB", 7*3600)
		}
		t := time.NewTicker(1 * time.Minute)
		defer t.Stop()

		var lastRun time.Time
		for range t.C {
			now := time.Now().In(loc)
			if now.Hour() != 15 || now.Minute() != 30 {
				continue
			}
			// Guard against double-firing inside the same minute window.
			if !lastRun.IsZero() && now.Sub(lastRun) < 2*time.Minute {
				continue
			}
			lastRun = now

			if err := SnapshotWatchlistDaily(now); err != nil {
				log.Printf("watchlist_tracker: snapshot failed: %v", err)
			}
		}
	}()

	log.Println("Watchlist Tracker started (daily snapshot at 15:30 WIB).")
}

// upsertDailySnapshot writes/updates a single (watchlist_id, day_offset) row
// so calling SnapshotWatchlistDaily multiple times in a day is idempotent —
// only the latest price for that offset is preserved.
func upsertDailySnapshot(watchlistID string, offset int, price float64, recordedAt time.Time) error {
	_, err := database.DB.Exec(`
		INSERT INTO watchlist_daily_prices (watchlist_id, day_offset, price, recorded_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (watchlist_id, day_offset)
		DO UPDATE SET price = EXCLUDED.price, recorded_at = EXCLUDED.recorded_at
	`, watchlistID, offset, price, recordedAt)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	return nil
}
