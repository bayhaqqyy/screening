package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/ws"
	"github.com/segmentio/kafka-go"
)

func StartConsumers() {
	go consumeTopic("idx.ohlcv.enriched")
	go consumeTopic("idx.bandar.flow")
	go consumeTopic("idx.news.updates")
	go consumeTopic("idx.screener.updates")
	go aggregateMarketOverview() // periodic aggregation
	go cleanupOldNews()          // retention policy for news
}

// --- Data structs for parsing Kafka messages ---

type MarketTick struct {
	Ticker    string  `json:"ticker"`
	LastPrice float64 `json:"last_price"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Volume    int64   `json:"volume"`
	ChangePct float64 `json:"change_pct"`
}

type BandarFlow struct {
	Ticker    string   `json:"ticker"`
	FlowType  string  `json:"flow_type"`
	NetVolume int64   `json:"net_volume"`
	TopBuyers []string `json:"top_buyers"`
	TopSellers []string `json:"top_sellers"`
}

type NewsItem struct {
	ID        string  `json:"id"`
	Ticker    string  `json:"ticker"`
	Headline  string  `json:"headline"`
	Source    string  `json:"source"`
	Timestamp string  `json:"timestamp"`
	Sentiment string  `json:"sentiment"`
	SentimentScore float64 `json:"sentiment_score"`
	URL       string  `json:"url"`
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
			time.Sleep(3 * time.Second)
			continue
		}

		// 1. Persist to PostgreSQL based on topic
		switch topic {
		case "idx.ohlcv.enriched":
			persistMarketTick(m.Value)
		case "idx.bandar.flow":
			// Bandar flow is mostly for real-time display, but we log it
			persistBandarFlow(m.Value)
		case "idx.news.updates":
			persistNews(m.Value)
		}

		// 2. Broadcast to WebSocket clients (existing behavior)
		wsMessage := []byte(`{"topic": "` + topic + `", "key": "` + string(m.Key) + `", "data": ` + string(m.Value) + `}`)
		ws.AppHub.Broadcast(wsMessage)
	}
}

func persistMarketTick(data []byte) {
	var tick MarketTick
	if err := json.Unmarshal(data, &tick); err != nil {
		return
	}
	if tick.Ticker == "" || tick.LastPrice == 0 {
		return
	}

	// UPSERT into stock_info — update price, change_pct, volume
	_, err := database.DB.Exec(`
		UPDATE stock_info 
		SET last_price = $1, change_pct = $2, volume = $3
		WHERE ticker = $4
	`, tick.LastPrice, tick.ChangePct, tick.Volume, tick.Ticker)

	if err != nil {
		log.Printf("Failed to update stock_info for %s: %v", tick.Ticker, err)
	}
}

func persistBandarFlow(data []byte) {
	var flow BandarFlow
	if err := json.Unmarshal(data, &flow); err != nil {
		return
	}
	// We don't have a dedicated bandar table yet, but we can store in a generic log
	// For now, the WS broadcast handles real-time display
}

func persistNews(data []byte) {
	var news NewsItem
	if err := json.Unmarshal(data, &news); err != nil {
		return
	}
	if news.Headline == "" {
		return
	}

	_, err := database.DB.Exec(`
		INSERT INTO news (title, link, source, sentiment, sentiment_score, ticker, url, published_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (link) DO NOTHING
	`, news.Headline, news.URL, news.Source, news.Sentiment, news.SentimentScore, news.Ticker, news.URL, news.Timestamp)

	if err != nil {
		log.Printf("Failed to persist news: %v", err)
	}
}

// aggregateMarketOverview runs every 30 seconds and computes
// market-wide stats from stock_info, then writes to market_overview
func aggregateMarketOverview() {
	for {
		time.Sleep(30 * time.Second)

		// Compute aggregate stats from stock_info
		var totalVolume int64
		var totalValuation int64
		var avgChangePct float64
		var count int

		err := database.DB.QueryRow(`
			SELECT 
				COALESCE(SUM(volume), 0),
				COALESCE(SUM(market_cap), 0),
				COALESCE(AVG(change_pct), 0),
				COUNT(*)
			FROM stock_info
			WHERE last_price > 0 AND change_pct != 0
		`).Scan(&totalVolume, &totalValuation, &avgChangePct, &count)

		if err != nil || count == 0 {
			continue
		}

		// Estimate an IHSG-like index value (simplified weighted average)
		var indexValue float64
		database.DB.QueryRow(`
			SELECT COALESCE(SUM(last_price * market_cap) / NULLIF(SUM(market_cap), 0), 0)
			FROM stock_info WHERE last_price > 0 AND market_cap > 0
		`).Scan(&indexValue)

		// Estimate foreign flow as net of top gainers vs losers volume (simplified proxy)
		var foreignFlow int64
		database.DB.QueryRow(`
			SELECT COALESCE(
				SUM(CASE WHEN change_pct > 0 THEN volume ELSE -volume END),
			0) FROM stock_info WHERE change_pct != 0
		`).Scan(&foreignFlow)

		// UPSERT market_overview (we keep a single row with id=1 for simplicity)
		_, err = database.DB.Exec(`
			INSERT INTO market_overview (id, index_value, change_pct, volume, valuation, foreign_flow, updated_at)
			VALUES (1, $1, $2, $3, $4, $5, NOW())
			ON CONFLICT (id) DO UPDATE SET
				index_value = $1,
				change_pct = $2,
				volume = $3,
				valuation = $4,
				foreign_flow = $5,
				updated_at = NOW()
		`, indexValue, avgChangePct, totalVolume, totalValuation, foreignFlow)

		if err != nil {
			log.Printf("Failed to update market_overview: %v", err)
			continue
		}

		// Compute sector performance from stock_info grouped by sector
		sectorRows, err := database.DB.Query(`
			SELECT sector, AVG(change_pct), SUM(volume)
			FROM stock_info
			WHERE sector != '' AND last_price > 0 AND change_pct != 0
			GROUP BY sector
			ORDER BY ABS(AVG(change_pct)) DESC
		`)
		if err != nil {
			continue
		}

		for sectorRows.Next() {
			var sector string
			var sectorChange float64
			var sectorVol int64
			if err := sectorRows.Scan(&sector, &sectorChange, &sectorVol); err != nil {
				continue
			}

			database.DB.Exec(`
				INSERT INTO sector_performance (sector, change_pct, volume)
				VALUES ($1, $2, $3)
				ON CONFLICT (sector) DO UPDATE SET
					change_pct = $2,
					volume = $3
			`, sector, sectorChange, sectorVol)
		}
		sectorRows.Close()
	}
}

// cleanupOldNews runs periodically (e.g. daily) to remove old news
// preventing the news table from bloating storage.
func cleanupOldNews() {
	for {
		_, err := database.DB.Exec(`
			DELETE FROM news 
			WHERE published_at < NOW() - INTERVAL '7 days'
		`)
		if err != nil {
			log.Printf("Failed to cleanup old news: %v", err)
		} else {
			log.Printf("Successfully cleaned up old news (>7 days)")
		}

		// Run once a day
		time.Sleep(24 * time.Hour)
	}
}
