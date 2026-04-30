package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sahamscreen/server/database"
)

type ScreenerResult struct {
	Ticker   string          `json:"ticker"`
	Strategy string          `json:"strategy"`
	Signal   string          `json:"signal"`
	Score    int             `json:"score"`
	Payload  json.RawMessage `json:"payload"`
	ScreenedAt string        `json:"screened_at"`
}

func GetScreenerResults(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	strategy := vars["strategy"]

	if strategy == "" {
		strategy = "bsjp"
	}

	rows, err := database.DB.Query(`
		SELECT DISTINCT ON (ticker) ticker, strategy, COALESCE(signal, ''), COALESCE(score, 0), payload, screened_at
		FROM screener_results
		WHERE strategy = $1
		ORDER BY ticker, screened_at DESC
		LIMIT 50
	`, strategy)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]ScreenerResult{})
		return
	}
	defer rows.Close()

	var results []ScreenerResult
	for rows.Next() {
		var sr ScreenerResult
		rows.Scan(&sr.Ticker, &sr.Strategy, &sr.Signal, &sr.Score, &sr.Payload, &sr.ScreenedAt)
		results = append(results, sr)
	}

	if results == nil {
		results = []ScreenerResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
