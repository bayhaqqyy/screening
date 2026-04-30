package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sahamscreen/server/database"
)

type CorporateEvent struct {
	ID          int64  `json:"id"`
	Ticker      string `json:"ticker"`
	EventType   string `json:"event_type"`
	Title       string `json:"title"`
	Description string `json:"description"`
	EventDate   string `json:"event_date"`
}

func GetEvents(w http.ResponseWriter, r *http.Request) {
	rows, err := database.DB.Query(`
		SELECT id, ticker, event_type, title, COALESCE(description,''), event_date
		FROM corporate_events
		WHERE event_date >= CURRENT_DATE
		ORDER BY event_date ASC
		LIMIT 20
	`)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode([]CorporateEvent{})
		return
	}
	defer rows.Close()

	var events []CorporateEvent
	for rows.Next() {
		var e CorporateEvent
		rows.Scan(&e.ID, &e.Ticker, &e.EventType, &e.Title, &e.Description, &e.EventDate)
		events = append(events, e)
	}

	if events == nil {
		events = []CorporateEvent{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}
