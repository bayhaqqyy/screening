package handlers

import (
	"encoding/json"
	"net/http"
	"time"

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
	// Pick the freshest row by updated_at, NOT the highest id. The seeded
	// row (id=1) is what aggregateMarketOverview() UPSERTs every 30s, but
	// historical seed re-runs (the migrator running on every up) can leave
	// stale empty rows with higher SERIAL ids — picking by id would surface
	// those zero rows instead of the live aggregate.
	err := database.DB.QueryRow(`
		SELECT index_value, change_pct, volume, valuation, foreign_flow, updated_at
		FROM market_overview ORDER BY updated_at DESC LIMIT 1
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
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		// Fallback to UTC if timezone db not found, but approximate it
		loc = time.FixedZone("WIB", 7*3600)
	}
	
	now := time.Now().In(loc)
	weekday := now.Weekday()
	hour := now.Hour()
	min := now.Minute()
	timeVal := hour*60 + min

	var session string
	var message string

	if weekday == time.Saturday || weekday == time.Sunday {
		session = "closed"
		message = "Weekend"
	} else if timeVal < 8*60 + 45 {
		session = "closed"
		message = "Pre-Market Closed"
	} else if timeVal < 9*60 {
		session = "pre-market"
		message = "Pre-Market"
	} else if timeVal < 12*60 && weekday != time.Friday {
		session = "live"
		message = "Session 1"
	} else if timeVal < 11*60 + 30 && weekday == time.Friday {
		session = "live"
		message = "Session 1"
	} else if timeVal < 13*60 + 30 && weekday != time.Friday {
		session = "break"
		message = "Break"
	} else if timeVal < 14*60 && weekday == time.Friday {
		session = "break"
		message = "Break"
	} else if timeVal < 16*60 {
		session = "live"
		message = "Session 2"
	} else if timeVal < 16*60 + 15 {
		session = "pre-close"
		message = "Pre-Close"
	} else {
		session = "closed"
		message = "Market Closed"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session": session,
		"message": message,
	})
}
