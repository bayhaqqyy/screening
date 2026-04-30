package kafka

import (
	"context"
	"log"

	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/ws"
	"github.com/segmentio/kafka-go"
)

func StartConsumers() {
	go consumeTopic("idx.ohlcv.enriched")
	go consumeTopic("idx.bandar.flow")
}

func consumeTopic(topic string) {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{config.AppConfig.KafkaBroker},
		GroupID:  "go-web-consumer",
		Topic:    topic,
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})

	log.Printf("Started Kafka consumer for topic: %s", topic)

	for {
		m, err := r.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message from %s: %v", topic, err)
			continue
		}
		
		// In a real app, you might parse the message and persist it to PostgreSQL here
		// For now, we'll just broadcast the raw JSON to WebSocket clients
		
		wsMessage := []byte(`{"topic": "` + topic + `", "key": "` + string(m.Key) + `", "data": ` + string(m.Value) + `}`)
		ws.AppHub.Broadcast(wsMessage)
	}
}
