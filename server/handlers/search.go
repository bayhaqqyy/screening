package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sahamscreen/server/database"
)

type StockSearchResult struct {
	Ticker    string  `json:"ticker"`
	Name      string  `json:"name"`
	Sector    string  `json:"sector"`
	Industry  string  `json:"industry"`
	LastPrice float64 `json:"last_price"`
	ChangePct float64 `json:"change_pct"`
	MarketCap int64   `json:"market_cap"`
}

func SearchStocks(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]StockSearchResult{})
		return
	}

	searchPattern := "%" + query + "%"

	rows, err := database.DB.Query(`
		SELECT ticker, COALESCE(name,''), COALESCE(sector,''), COALESCE(industry,''),
		       COALESCE(last_price,0), COALESCE(change_pct,0), COALESCE(market_cap,0)
		FROM stock_info
		WHERE ticker ILIKE $1 OR name ILIKE $1
		ORDER BY market_cap DESC
		LIMIT 15
	`, searchPattern)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]StockSearchResult{})
		return
	}
	defer rows.Close()

	var results []StockSearchResult
	for rows.Next() {
		var s StockSearchResult
		rows.Scan(&s.Ticker, &s.Name, &s.Sector, &s.Industry, &s.LastPrice, &s.ChangePct, &s.MarketCap)
		results = append(results, s)
	}

	if results == nil {
		results = []StockSearchResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

func GetStockDetail(w http.ResponseWriter, r *http.Request) {
	ticker := r.URL.Query().Get("ticker")
	if ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	var s StockSearchResult
	err := database.DB.QueryRow(`
		SELECT ticker, COALESCE(name,''), COALESCE(sector,''), COALESCE(industry,''),
		       COALESCE(last_price,0), COALESCE(change_pct,0), COALESCE(market_cap,0)
		FROM stock_info
		WHERE ticker = $1
	`, ticker).Scan(&s.Ticker, &s.Name, &s.Sector, &s.Industry, &s.LastPrice, &s.ChangePct, &s.MarketCap)

	if err != nil {
		http.Error(w, "Stock not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

type ChartData struct {
	Time   string  `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
}

func GetStockChart(w http.ResponseWriter, r *http.Request) {
	ticker := r.URL.Query().Get("ticker")
	if ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	rows, err := database.DB.Query(`
		SELECT to_char(date, 'YYYY-MM-DD'), open, high, low, close, volume
		FROM ohlcv_daily
		WHERE ticker = $1
		ORDER BY date ASC
		LIMIT 365
	`, ticker)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]ChartData{})
		return
	}
	defer rows.Close()

	var results []ChartData
	for rows.Next() {
		var c ChartData
		if err := rows.Scan(&c.Time, &c.Open, &c.High, &c.Low, &c.Close, &c.Volume); err != nil {
			continue
		}
		results = append(results, c)
	}

	if results == nil {
		results = []ChartData{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
