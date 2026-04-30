package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sahamscreen/server/database"
)

type MarketOverviewResponse struct {
	IndexValue float64 `json:"index_value"`
	ChangePct  float64 `json:"change_pct"`
	Volume     int64   `json:"volume"`
	Valuation  int64   `json:"valuation"`
	ForeignFlow int64  `json:"foreign_flow"`
	UpdatedAt  string  `json:"updated_at"`
}

type TopMover struct {
	Ticker   string  `json:"ticker"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	ChangePct float64 `json:"change_pct"`
	Volume   int64   `json:"volume"`
}

type SectorPerf struct {
	Sector    string  `json:"sector"`
	ChangePct float64 `json:"change_pct"`
	Volume    int64   `json:"volume"`
}

func GetMarketOverview(w http.ResponseWriter, r *http.Request) {
	var resp MarketOverviewResponse
	err := database.DB.QueryRow(`
		SELECT index_value, change_pct, volume, valuation, foreign_flow, updated_at
		FROM market_overview ORDER BY id DESC LIMIT 1
	`).Scan(&resp.IndexValue, &resp.ChangePct, &resp.Volume, &resp.Valuation, &resp.ForeignFlow, &resp.UpdatedAt)

	if err != nil {
		// Return zeroed data if no rows
		resp = MarketOverviewResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func GetTopMovers(w http.ResponseWriter, r *http.Request) {
	moverType := r.URL.Query().Get("type") // "gainers" or "losers"
	if moverType == "" {
		moverType = "gainers"
	}

	orderDir := "DESC"
	if moverType == "losers" {
		orderDir = "ASC"
	}

	rows, err := database.DB.Query(`
		SELECT ticker, name, last_price, change_pct, volume
		FROM stock_info
		WHERE last_price > 0 AND change_pct != 0
		ORDER BY change_pct `+orderDir+`
		LIMIT 20
	`)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]TopMover{})
		return
	}
	defer rows.Close()

	var movers []TopMover
	for rows.Next() {
		var m TopMover
		rows.Scan(&m.Ticker, &m.Name, &m.Price, &m.ChangePct, &m.Volume)
		movers = append(movers, m)
	}

	if movers == nil {
		movers = []TopMover{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(movers)
}

func GetSectors(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
		SELECT sector, change_pct, volume FROM sector_performance ORDER BY ABS(change_pct) DESC
	`)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]SectorPerf{})
		return
	}
	defer rows.Close()

	var sectors []SectorPerf
	for rows.Next() {
		var s SectorPerf
		rows.Scan(&s.Sector, &s.ChangePct, &s.Volume)
		sectors = append(sectors, s)
	}

	if sectors == nil {
		sectors = []SectorPerf{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sectors)
}

func GetMarketStatus(w http.ResponseWriter, r *http.Request) {
	// Return market session info based on current WIB time
	// This is calculated server-side
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session":   "live",
		"message":   "Market hours are calculated client-side using WIB timezone",
	})
}
