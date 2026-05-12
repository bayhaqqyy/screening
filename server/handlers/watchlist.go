package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/lib/pq"
	"github.com/sahamscreen/server/database"
)

// Sprint 7 observability — per-endpoint counters for the Watchlist V2
// rollout. Exposed through WatchlistCounters() so a future /api/metrics
// handler (or a simple log snapshot) can answer "is anyone actually using
// the new columns?" without adding a full Prometheus stack.
var (
	watchlistGetCount       atomic.Int64
	watchlistAddCount       atomic.Int64
	watchlistRemoveCount    atomic.Int64
	watchlistSellPatchCount atomic.Int64
	watchlistErrorCount     atomic.Int64
)

// WatchlistCounters snapshot for /api/health diagnostics.
func WatchlistCounters() map[string]int64 {
	return map[string]int64{
		"get":        watchlistGetCount.Load(),
		"add":        watchlistAddCount.Load(),
		"remove":     watchlistRemoveCount.Load(),
		"sell_patch": watchlistSellPatchCount.Load(),
		"errors":     watchlistErrorCount.Load(),
	}
}

// DailyPrice represents a single H+N sample in watchlist_daily_prices.
// day_offset ranges 1..7 and the UI renders them as the "H+1"..."H+7"
// columns of the Watchlist V2 table.
type DailyPrice struct {
	DayOffset  int     `json:"day_offset"`
	Price      float64 `json:"price"`
	RecordedAt string  `json:"recorded_at"`
}

// WatchlistItem is the row shape returned by GET /api/watchlist. It carries
// the V2 tracking fields so the React table can render the full H+1..H+7
// trade journal without additional lookups.
type WatchlistItem struct {
	ID            string       `json:"id"`
	Ticker        string       `json:"ticker"`
	Name          string       `json:"name"`
	Category      string       `json:"category"`
	LastPrice     float64      `json:"last_price"`
	ChangePct     float64      `json:"change_pct"`
	Volume        int64        `json:"volume"`
	Sector        string       `json:"sector"`
	EntryPrice    float64      `json:"entry_price"`
	EntryDate     string       `json:"entry_date"`
	LivePrice     float64      `json:"live_price"`
	PnLPct        float64      `json:"pnl_pct"`
	BreakoutPrice float64      `json:"breakout_price"`
	BreakoutDate  string       `json:"breakout_date"`
	TradingSetup  string       `json:"trading_setup"`
	SellPrice     float64      `json:"sell_price"`
	GainPct       float64      `json:"gain_pct"`
	AddedAt       string       `json:"added_at"`
	DailyPrices   []DailyPrice `json:"daily_prices"`
}

func GetWatchlist(w http.ResponseWriter, r *http.Request) {
	watchlistGetCount.Add(1)
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := database.DB.Query(`
		SELECT
			w.id,
			w.ticker,
			COALESCE(s.name, ''),
			COALESCE(w.category, 'WATCHLIST'),
			COALESCE(s.last_price, 0),
			COALESCE(s.change_pct, 0),
			COALESCE(s.volume, 0),
			COALESCE(s.sector, ''),
			COALESCE(w.entry_price, 0),
			COALESCE(w.entry_date, w.added_at::date),
			COALESCE(w.live_price, 0),
			COALESCE(w.pnl_pct, 0),
			COALESCE(w.breakout_price, 0),
			w.breakout_date,
			COALESCE(w.trading_setup, ''),
			COALESCE(w.sell_price, 0),
			w.added_at
		FROM watchlists w
		LEFT JOIN stock_info s ON w.ticker = s.ticker
		WHERE w.user_id = $1
		ORDER BY w.added_at DESC
	`, userID)

	if err != nil {
		log.Printf("GetWatchlist query failed: %v", err)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]WatchlistItem{})
		return
	}
	defer rows.Close()

	var items []WatchlistItem
	ids := make([]string, 0, 16)

	for rows.Next() {
		var item WatchlistItem
		var entryDate time.Time
		var breakoutDate sql.NullTime
		var addedAt time.Time

		if err := rows.Scan(
			&item.ID,
			&item.Ticker,
			&item.Name,
			&item.Category,
			&item.LastPrice,
			&item.ChangePct,
			&item.Volume,
			&item.Sector,
			&item.EntryPrice,
			&entryDate,
			&item.LivePrice,
			&item.PnLPct,
			&item.BreakoutPrice,
			&breakoutDate,
			&item.TradingSetup,
			&item.SellPrice,
			&addedAt,
		); err != nil {
			log.Printf("GetWatchlist scan failed: %v", err)
			continue
		}

		item.EntryDate = entryDate.Format("2006-01-02")
		if breakoutDate.Valid {
			item.BreakoutDate = breakoutDate.Time.Format("2006-01-02")
		}
		item.AddedAt = addedAt.Format(time.RFC3339)

		// gain_pct uses sell_price when the user has closed the trade,
		// otherwise falls back to live pnl_pct so the UI always has a
		// single running "performance" number to render.
		if item.SellPrice > 0 && item.EntryPrice > 0 {
			item.GainPct = ((item.SellPrice - item.EntryPrice) / item.EntryPrice) * 100
		} else {
			item.GainPct = item.PnLPct
		}

		// Seeded empty so callers never have to null-check.
		item.DailyPrices = []DailyPrice{}
		items = append(items, item)
		ids = append(ids, item.ID)
	}

	// Attach H+1..H+7 samples in a single round-trip keyed by watchlist_id.
	if len(ids) > 0 {
		dpMap, err := fetchDailyPrices(ids)
		if err != nil {
			log.Printf("GetWatchlist daily prices fetch failed: %v", err)
		} else {
			for i := range items {
				if dps, ok := dpMap[items[i].ID]; ok {
					items[i].DailyPrices = dps
				}
			}
		}
	}

	if items == nil {
		items = []WatchlistItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// fetchDailyPrices returns a map keyed by watchlist_id so the caller can
// stitch H+N samples onto each watchlist row without N+1 queries.
func fetchDailyPrices(watchlistIDs []string) (map[string][]DailyPrice, error) {
	out := make(map[string][]DailyPrice, len(watchlistIDs))

	rows, err := database.DB.Query(`
		SELECT watchlist_id, day_offset, price, recorded_at
		FROM watchlist_daily_prices
		WHERE watchlist_id = ANY($1)
		ORDER BY watchlist_id, day_offset ASC
	`, pq.Array(watchlistIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			wid        string
			dp         DailyPrice
			recordedAt time.Time
		)
		if err := rows.Scan(&wid, &dp.DayOffset, &dp.Price, &recordedAt); err != nil {
			continue
		}
		dp.RecordedAt = recordedAt.Format("2006-01-02")
		out[wid] = append(out[wid], dp)
	}
	return out, nil
}

// fetchDailyPrices returns a map keyed by watchlist_id so the caller can
// stitch H+N samples onto each watchlist row without N+1 queries.

// AddToWatchlist — POST /api/watchlist. Seeds entry_price from stock_info
// (Lock Decision #3) and stamps entry_date to today so the daily tracker
// can compute H+N offsets starting tomorrow.
func AddToWatchlist(w http.ResponseWriter, r *http.Request) {
	watchlistAddCount.Add(1)
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Ticker        string  `json:"ticker"`
		Category      string  `json:"category"`
		BreakoutPrice float64 `json:"breakout_price"`
		TradingSetup  string  `json:"trading_setup"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	ticker := strings.ToUpper(req.Ticker)
	category := strings.ToUpper(strings.TrimSpace(req.Category))
	if category == "" {
		category = "WATCHLIST"
	}

	// Snapshot the current last_price as the entry price (Lock Decision #3).
	// A missing stock_info row just means entry_price=0 — the tracker will
	// rewrite pnl_pct once market data catches up.
	var entryPrice float64
	if err := database.DB.QueryRow(
		`SELECT COALESCE(last_price, 0) FROM stock_info WHERE ticker = $1`, ticker,
	).Scan(&entryPrice); err != nil && err != sql.ErrNoRows {
		log.Printf("AddToWatchlist price lookup failed for %s: %v", ticker, err)
	}

	today := time.Now().Format("2006-01-02")

	_, err = database.DB.Exec(`
		INSERT INTO watchlists (
			user_id, ticker, category, entry_price, entry_date,
			live_price, breakout_price, trading_setup
		)
		VALUES ($1, $2, $3, $4, $5, $4, $6, $7)
		ON CONFLICT (user_id, ticker) DO NOTHING
	`, userID, ticker, category, entryPrice, today, req.BreakoutPrice, req.TradingSetup)

	if err != nil {
		log.Printf("AddToWatchlist insert failed: %v", err)
		watchlistErrorCount.Add(1)
		http.Error(w, "Failed to add", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"ticker":      ticker,
		"entry_price": entryPrice,
		"entry_date":  today,
	})
}

func RemoveFromWatchlist(w http.ResponseWriter, r *http.Request) {
	watchlistRemoveCount.Add(1)
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ticker := r.URL.Query().Get("ticker")
	if ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec(`DELETE FROM watchlists WHERE user_id = $1 AND ticker = $2`, userID, ticker)
	if err != nil {
		watchlistErrorCount.Add(1)
		http.Error(w, "Failed to remove", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

// UpdateWatchlistSellPrice — PATCH /api/watchlist. Lets the user close a
// trade by stamping a sell price. The handler also recomputes the realised
// gain_pct server-side so every client sees a consistent number without
// having to duplicate the math.
//
// Body: { "ticker": "BBCA", "sell_price": 9900 }
// Use sell_price == 0 to clear a previously recorded sell.
func UpdateWatchlistSellPrice(w http.ResponseWriter, r *http.Request) {
	watchlistSellPatchCount.Add(1)
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Ticker    string  `json:"ticker"`
		SellPrice float64 `json:"sell_price"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}
	if req.SellPrice < 0 {
		http.Error(w, "sell_price must be non-negative", http.StatusBadRequest)
		return
	}

	ticker := strings.ToUpper(req.Ticker)

	res, err := database.DB.Exec(`
		UPDATE watchlists
		   SET sell_price = $1
		 WHERE user_id = $2 AND ticker = $3
	`, req.SellPrice, userID, ticker)
	if err != nil {
		log.Printf("UpdateWatchlistSellPrice failed: %v", err)
		watchlistErrorCount.Add(1)
		http.Error(w, "Failed to update", http.StatusInternalServerError)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		http.Error(w, "watchlist entry not found", http.StatusNotFound)
		return
	}

	// Compute the realised gain for the API response so the client does
	// not have to round-trip another GET to refresh the gain column.
	var entryPrice float64
	_ = database.DB.QueryRow(
		`SELECT COALESCE(entry_price, 0) FROM watchlists WHERE user_id = $1 AND ticker = $2`,
		userID, ticker,
	).Scan(&entryPrice)

	gainPct := 0.0
	if entryPrice > 0 && req.SellPrice > 0 {
		gainPct = ((req.SellPrice - entryPrice) / entryPrice) * 100
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"ticker":     ticker,
		"sell_price": req.SellPrice,
		"gain_pct":   gainPct,
	})
}
