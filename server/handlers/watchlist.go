package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
)

type WatchlistItem struct {
	Ticker    string  `json:"ticker"`
	Name      string  `json:"name"`
	LastPrice float64 `json:"last_price"`
	ChangePct float64 `json:"change_pct"`
	Volume    int64   `json:"volume"`
	Sector    string  `json:"sector"`
	AddedAt   string  `json:"added_at"`
}

func getUserIDFromToken(r *http.Request) (string, error) {
	authHeader := r.Header.Get("Authorization")
	tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return "", err
	}
	claims := token.Claims.(jwt.MapClaims)
	return claims["sub"].(string), nil
}

func GetWatchlist(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := database.DB.Query(`
		SELECT w.ticker, COALESCE(s.name,''), COALESCE(s.last_price,0), 
		       COALESCE(s.change_pct,0), COALESCE(s.volume,0), COALESCE(s.sector,''),
		       w.added_at
		FROM watchlists w
		LEFT JOIN stock_info s ON w.ticker = s.ticker
		WHERE w.user_id = $1
		ORDER BY w.added_at DESC
	`, userID)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]WatchlistItem{})
		return
	}
	defer rows.Close()

	var items []WatchlistItem
	for rows.Next() {
		var item WatchlistItem
		rows.Scan(&item.Ticker, &item.Name, &item.LastPrice, &item.ChangePct,
			&item.Volume, &item.Sector, &item.AddedAt)
		items = append(items, item)
	}

	if items == nil {
		items = []WatchlistItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func AddToWatchlist(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Ticker string `json:"ticker"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	_, err = database.DB.Exec(`
		INSERT INTO watchlists (user_id, ticker) VALUES ($1, $2) ON CONFLICT DO NOTHING
	`, userID, strings.ToUpper(req.Ticker))

	if err != nil {
		http.Error(w, "Failed to add", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}

func RemoveFromWatchlist(w http.ResponseWriter, r *http.Request) {
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
		http.Error(w, "Failed to remove", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"success": true})
}
