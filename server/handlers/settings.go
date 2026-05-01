package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sahamscreen/server/database"
)

type UserSettings struct {
	Theme           string          `json:"theme"`
	Notifications   json.RawMessage `json:"notifications"`
	DefaultStrategy string          `json:"default_strategy"`
}

func GetSettings(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var settings UserSettings
	err := database.DB.QueryRow(`
		SELECT theme, notifications, default_strategy
		FROM user_settings
		WHERE user_id = $1
	`, userID).Scan(&settings.Theme, &settings.Notifications, &settings.DefaultStrategy)

	if err != nil {
		// If no settings exist yet, return defaults
		settings = UserSettings{
			Theme:           "dark",
			Notifications:   json.RawMessage(`{"bsjp": true, "swing": true, "scalping": false}`),
			DefaultStrategy: "bsjp",
		}
		
		// Insert default row to prevent future query errors
		database.DB.Exec(`
			INSERT INTO user_settings (user_id, theme, notifications, default_strategy)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id) DO NOTHING
		`, userID, settings.Theme, settings.Notifications, settings.DefaultStrategy)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID, err := getUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req UserSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Basic validation / Defaults
	if req.Theme == "" {
		req.Theme = "dark"
	}
	if req.DefaultStrategy == "" {
		req.DefaultStrategy = "bsjp"
	}
	if req.Notifications == nil {
		req.Notifications = json.RawMessage(`{}`)
	}

	_, err := database.DB.Exec(`
		INSERT INTO user_settings (user_id, theme, notifications, default_strategy)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET
			theme = EXCLUDED.theme,
			notifications = EXCLUDED.notifications,
			default_strategy = EXCLUDED.default_strategy
	`, userID, req.Theme, req.Notifications, req.DefaultStrategy)

	if err != nil {
		http.Error(w, "Failed to update settings", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}
