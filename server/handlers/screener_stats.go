package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sahamscreen/server/database"
)

type ScreenerStats struct {
	SuccessRate float64 `json:"success_rate"`
	AvgGapUp    float64 `json:"avg_gap_up"`
	TotalHits   int     `json:"total_hits"`
}

func GetScreenerStats(w http.ResponseWriter, r *http.Request) {
	strategy := r.URL.Query().Get("strategy")
	if strategy == "" {
		strategy = "bsjp"
	}

	var stats ScreenerStats

	// Total hits = total screener results for this strategy
	database.DB.QueryRow(`
		SELECT COUNT(*) FROM screener_results WHERE strategy = $1
	`, strategy).Scan(&stats.TotalHits)

	// Success rate = percentage of results with score > 60
	if stats.TotalHits > 0 {
		var successCount int
		database.DB.QueryRow(`
			SELECT COUNT(*) FROM screener_results WHERE strategy = $1 AND score > 60
		`, strategy).Scan(&successCount)
		stats.SuccessRate = float64(successCount) / float64(stats.TotalHits) * 100
	}

	// Avg gap up = average change_pct of stocks that were screened and had positive outcome
	database.DB.QueryRow(`
		SELECT COALESCE(AVG(s.change_pct), 0)
		FROM screener_results sr
		JOIN stock_info s ON sr.ticker = s.ticker
		WHERE sr.strategy = $1 AND s.change_pct > 0
	`, strategy).Scan(&stats.AvgGapUp)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
