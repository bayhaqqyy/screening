package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
)

type Alert struct {
	ID          string  `json:"id"`
	Ticker      string  `json:"ticker"`
	Condition   string  `json:"condition"` // 'above' | 'below'
	TargetPrice float64 `json:"target_price"`
	Triggered   bool    `json:"triggered"`
	CreatedAt   string  `json:"created_at"`
}

func GetAlerts(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := database.DB.Query(`
		SELECT id, ticker, condition, target_price, triggered, created_at
		FROM alerts
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var alerts []Alert
	for rows.Next() {
		var a Alert
		if err := rows.Scan(&a.ID, &a.Ticker, &a.Condition, &a.TargetPrice, &a.Triggered, &a.CreatedAt); err != nil {
			continue
		}
		alerts = append(alerts, a)
	}

	if alerts == nil {
		alerts = []Alert{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}

func CreateAlert(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req struct {
		Ticker      string  `json:"ticker"`
		Condition   string  `json:"condition"`
		TargetPrice float64 `json:"target_price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Ticker == "" || req.Condition == "" || req.TargetPrice <= 0 {
		http.Error(w, "Invalid fields", http.StatusBadRequest)
		return
	}

	req.Ticker = strings.ToUpper(req.Ticker)

	var newAlert Alert
	err := database.DB.QueryRow(`
		INSERT INTO alerts (user_id, ticker, condition, target_price)
		VALUES ($1, $2, $3, $4)
		RETURNING id, ticker, condition, target_price, triggered, created_at
	`, userID, req.Ticker, req.Condition, req.TargetPrice).
		Scan(&newAlert.ID, &newAlert.Ticker, &newAlert.Condition, &newAlert.TargetPrice, &newAlert.Triggered, &newAlert.CreatedAt)

	if err != nil {
		http.Error(w, "Failed to create alert", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newAlert)
}

func DeleteAlert(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	alertID := r.URL.Query().Get("id")
	if alertID == "" {
		http.Error(w, "Alert ID required", http.StatusBadRequest)
		return
	}

	_, err := database.DB.Exec("DELETE FROM alerts WHERE id = $1 AND user_id = $2", alertID, userID)
	if err != nil {
		http.Error(w, "Failed to delete alert", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"success": true})
}

