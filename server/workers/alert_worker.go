package workers

import (
	"encoding/json"
	"log"
	"time"

	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/ws"
)

type AlertRecord struct {
	ID          string  `json:"id"`
	UserID      string  `json:"user_id"`
	Ticker      string  `json:"ticker"`
	Condition   string  `json:"condition"`
	TargetPrice float64 `json:"target_price"`
}

type WsAlertPayload struct {
	Type string      `json:"type"`
	Data AlertRecord `json:"data"`
}

func StartAlertWorker() {
	ticker := time.NewTicker(10 * time.Second) // Check every 10 seconds
	
	go func() {
		for range ticker.C {
			checkAlerts()
		}
	}()
	
	log.Println("Alert Trigger Worker started.")
}

func checkAlerts() {
	// 1. Get all active alerts
	rows, err := database.DB.Query(`
		SELECT a.id, a.user_id, a.ticker, a.condition, a.target_price, s.last_price 
		FROM alerts a
		JOIN stock_info s ON a.ticker = s.ticker
		WHERE a.triggered = false
	`)
	if err != nil {
		log.Printf("Alert worker error: %v", err)
		return
	}
	defer rows.Close()

	var triggeredAlerts []AlertRecord

	for rows.Next() {
		var alert AlertRecord
		var lastPrice float64
		if err := rows.Scan(&alert.ID, &alert.UserID, &alert.Ticker, &alert.Condition, &alert.TargetPrice, &lastPrice); err != nil {
			continue
		}

		// 2. Evaluate condition
		isTriggered := false
		if alert.Condition == "above" && lastPrice >= alert.TargetPrice {
			isTriggered = true
		} else if alert.Condition == "below" && lastPrice <= alert.TargetPrice {
			isTriggered = true
		}

		if isTriggered {
			triggeredAlerts = append(triggeredAlerts, alert)
		}
	}

	// 3. Mark as triggered and send notifications
	for _, alert := range triggeredAlerts {
		_, err := database.DB.Exec("UPDATE alerts SET triggered = true WHERE id = $1", alert.ID)
		if err != nil {
			log.Printf("Failed to update alert status %s: %v", alert.ID, err)
			continue
		}

		log.Printf("Alert Triggered: %s hit %v for user %s", alert.Ticker, alert.TargetPrice, alert.UserID)

		// Broadcast to WS
		payload := WsAlertPayload{
			Type: "ALERT_TRIGGERED",
			Data: alert,
		}
		
		payloadBytes, _ := json.Marshal(payload)
		ws.AppHub.Broadcast(payloadBytes)
	}
}
