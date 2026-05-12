package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/sahamscreen/server/database"
)

type BandarFlowResult struct {
	Ticker        string  `json:"ticker"`
	Price         float64 `json:"price"`
	Volume        int64   `json:"volume"`
	VolRatio      float64 `json:"vol_ratio"`
	ObvTrend      string  `json:"obv_trend"`
	AdValue       float64 `json:"ad_value"`
	ClosePosition float64 `json:"close_position"`
	Mfi           float64 `json:"mfi"`
	NetBuyProxy   bool    `json:"net_buy_proxy"`
	AccumScore    float64 `json:"accum_score"`
	Signal        string  `json:"signal"`
	UpdatedAt     string  `json:"updated_at"`
}

func GetBandarFlow(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
		SELECT ticker, price, volume, vol_ratio, obv_trend, ad_value, close_position, mfi, net_buy_proxy, accum_score, signal, updated_at
		FROM bandar_flow
		ORDER BY accum_score DESC
	`)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]BandarFlowResult{})
		return
	}
	defer rows.Close()

	var results []BandarFlowResult
	for rows.Next() {
		var bf BandarFlowResult
		if err := rows.Scan(
			&bf.Ticker, &bf.Price, &bf.Volume, &bf.VolRatio, &bf.ObvTrend, 
			&bf.AdValue, &bf.ClosePosition, &bf.Mfi, &bf.NetBuyProxy, 
			&bf.AccumScore, &bf.Signal, &bf.UpdatedAt,
		); err != nil {
			continue
		}
		results = append(results, bf)
	}

	if results == nil {
		results = []BandarFlowResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}


// GetBandarFlowBatch returns bandar_flow rows for a list of tickers supplied
// via a comma-separated ?tickers= query parameter. Used by the V2 screener
// tables to pull accumulation data for every row on the page in a single
// round trip instead of N individual GetBandarFlow lookups.
//
// Example: GET /api/bandar/batch?tickers=BBCA,BBRI,BMRI
//
// Response shape mirrors GetBandarFlow but is always returned as a map
// keyed by ticker so the frontend can O(1) index into it while rendering
// rows. Missing tickers are simply absent from the map.
func GetBandarFlowBatch(w http.ResponseWriter, r *http.Request) {
	raw := strings.TrimSpace(r.URL.Query().Get("tickers"))
	out := map[string]BandarFlowResult{}

	if raw == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
		return
	}

	// Parse and normalise — upper-case, trim, drop empties, cap to a sane
	// limit so a malicious caller can't request the entire exchange.
	parts := strings.Split(raw, ",")
	const maxBatch = 100
	tickers := make([]string, 0, len(parts))
	seen := map[string]bool{}
	for _, p := range parts {
		t := strings.ToUpper(strings.TrimSpace(p))
		if t == "" || seen[t] {
			continue
		}
		seen[t] = true
		tickers = append(tickers, t)
		if len(tickers) >= maxBatch {
			break
		}
	}

	if len(tickers) == 0 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
		return
	}

	// Build an IN clause with positional placeholders so pq can type-check
	// parameters properly (safer than string interpolation).
	placeholders := make([]string, len(tickers))
	args := make([]interface{}, len(tickers))
	for i, t := range tickers {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = t
	}

	query := fmt.Sprintf(`
		SELECT ticker, price, volume, vol_ratio, obv_trend, ad_value,
		       close_position, mfi, net_buy_proxy, accum_score, signal, updated_at
		FROM bandar_flow
		WHERE ticker IN (%s)
	`, strings.Join(placeholders, ","))

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var bf BandarFlowResult
		if err := rows.Scan(
			&bf.Ticker, &bf.Price, &bf.Volume, &bf.VolRatio, &bf.ObvTrend,
			&bf.AdValue, &bf.ClosePosition, &bf.Mfi, &bf.NetBuyProxy,
			&bf.AccumScore, &bf.Signal, &bf.UpdatedAt,
		); err != nil {
			continue
		}
		out[bf.Ticker] = bf
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
