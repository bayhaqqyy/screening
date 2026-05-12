package kafka

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"sync/atomic"
	"time"

	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/internal/markethours"
	"github.com/sahamscreen/server/ws"
	"github.com/segmentio/kafka-go"
)

// Sprint 7 observability — lightweight per-topic message counters. Exported
// via ConsumerCounters() so /api/health (or a future /metrics endpoint) can
// surface Kafka ingest health without pulling in a heavyweight metrics
// library. Atomics keep the hot path lock-free.
var (
	counterOhlcv    atomic.Int64
	counterBandar   atomic.Int64
	counterNews     atomic.Int64
	counterScreener atomic.Int64
	counterIndex    atomic.Int64
	counterErrors   atomic.Int64
)

// ConsumerCounters returns a snapshot of the per-topic message counters for
// the health handler / monitoring dashboard. Does not reset them.
func ConsumerCounters() map[string]int64 {
	return map[string]int64{
		"ohlcv":    counterOhlcv.Load(),
		"bandar":   counterBandar.Load(),
		"news":     counterNews.Load(),
		"screener": counterScreener.Load(),
		"index":    counterIndex.Load(),
		"errors":   counterErrors.Load(),
	}
}

func StartConsumers() {
	go consumeTopic("idx.ohlcv.enriched")
	go consumeTopic("idx.bandar.flow")
	go consumeTopic("idx.news.updates")
	go consumeTopic("idx.screener.updates")
	go consumeTopic("idx.index.update")
	go aggregateMarketOverview() // periodic aggregation
	go cleanupOldNews()          // retention policy for news
	go logConsumerStats()         // periodic counter snapshot
}

// logConsumerStats emits a one-line INFO log every minute so operators can
// eyeball whether each topic is still receiving traffic. It is purely
// observational — no persistence, no alerting. If counters flatline it is
// usually the engine-side producer that died.
func logConsumerStats() {
	t := time.NewTicker(60 * time.Second)
	defer t.Stop()
	var prev = ConsumerCounters()
	for range t.C {
		cur := ConsumerCounters()
		log.Printf(
			"kafka_counters ohlcv=%d(+%d) bandar=%d(+%d) news=%d(+%d) screener=%d(+%d) index=%d(+%d) errors=%d(+%d)",
			cur["ohlcv"], cur["ohlcv"]-prev["ohlcv"],
			cur["bandar"], cur["bandar"]-prev["bandar"],
			cur["news"], cur["news"]-prev["news"],
			cur["screener"], cur["screener"]-prev["screener"],
			cur["index"], cur["index"]-prev["index"],
			cur["errors"], cur["errors"]-prev["errors"],
		)
		prev = cur
	}
}

// --- Data structs for parsing Kafka messages ---

type MarketTick struct {
	Ticker    string  `json:"ticker"`
	LastPrice float64 `json:"last_price"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Close     float64 `json:"close"`
	Volume    int64   `json:"volume"`
	ChangePct float64 `json:"change_pct"`
	PrevClose float64 `json:"prev_close"`
}

type IndexUpdate struct {
	IndexValue float64 `json:"index_value"`
	ChangePct  float64 `json:"change_pct"`
	Volume     int64   `json:"volume"`
}

// ScreenerUpdate matches the message published by
// engine/streaming/screener_consumer.py to idx.screener.updates so the Go
// consumer can persist screener results into the screener_results table.
type ScreenerUpdate struct {
	Ticker   string          `json:"ticker"`
	Strategy string          `json:"strategy"`
	Signal   string          `json:"signal"`
	Score    int             `json:"score"`
	Payload  json.RawMessage `json:"payload"`
	Source   string          `json:"source"`
}

type BandarFlow struct {
	Ticker        string  `json:"ticker"`
	Price         float64 `json:"price"`
	Volume        int64   `json:"volume"`
	VolRatio      float64 `json:"vol_ratio"`
	ObvTrend      string  `json:"obv_trend"`
	AdValue       float64 `json:"ad_value"`
	ClosePosition float64 `json:"close_position"`
	Mfi           float64 `json:"mfi"`
	NetBuyProxy   bool    `json:"net_buy_proxy"`
	AccumScore    float64 `json:"accum_score"`
	Signal        string  `json:"signal"`
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
	ImageURL  string  `json:"image_url"`
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
			counterErrors.Add(1)
			log.Printf("Error reading message from %s: %v", topic, err)
			time.Sleep(3 * time.Second)
			continue
		}

		// 1. Persist to PostgreSQL based on topic
		switch topic {
		case "idx.ohlcv.enriched":
			counterOhlcv.Add(1)
			persistMarketTick(m.Value)
		case "idx.bandar.flow":
			counterBandar.Add(1)
			// Bandar flow is mostly for real-time display, but we log it
			persistBandarFlow(m.Value)
		case "idx.news.updates":
			counterNews.Add(1)
			persistNews(m.Value)
		case "idx.screener.updates":
			counterScreener.Add(1)
			persistScreenerResult(m.Value)
		case "idx.index.update":
			counterIndex.Add(1)
			persistIndexUpdate(m.Value)
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

	_, err := database.DB.Exec(`
		UPDATE stock_info
		SET last_price = $1, change_pct = $2, volume = $3, updated_at = NOW()
		WHERE ticker = $4
	`, tick.LastPrice, tick.ChangePct, tick.Volume, tick.Ticker)
	if err != nil {
		log.Printf("Failed to update stock_info for %s: %v", tick.Ticker, err)
	}

	// Update screener_results payload.price via jsonb_set so V2 tables
	// show live PnL without waiting for a new signal. The 7-day freshness
	// window caps the rewrite to the rows the frontend actually renders —
	// ancient locked BSJP entries are left alone so history stays honest.
	// We ONLY touch payload.price; entry_price / target / stop_loss stay
	// pinned to what the screener (or TradingView webhook) wrote, which
	// is what makes the live-PnL math meaningful. There is a test guard
	// for that invariant in consumer_test.go.
	_, err = database.DB.Exec(`
		UPDATE screener_results
		SET payload = jsonb_set(COALESCE(payload::jsonb, '{}'::jsonb), '{price}', to_jsonb($1::numeric), true)
		WHERE ticker = $2
		  AND screened_at > NOW() - INTERVAL '7 days'
	`, tick.LastPrice, tick.Ticker)
	if err != nil {
		log.Printf("Failed to update screener_results payload for %s: %v", tick.Ticker, err)
	}

	// UPSERT today's OHLCV row so /api/stock/chart has data without needing
	// the (currently disabled) engine-indicator pipeline. Fill missing fields
	// from last_price so a tick without a full OHLC payload still produces a
	// valid candle.
	openVal := tick.Open
	highVal := tick.High
	lowVal := tick.Low
	closeVal := tick.Close
	if closeVal == 0 {
		closeVal = tick.LastPrice
	}
	if openVal == 0 {
		openVal = closeVal
	}
	if highVal == 0 {
		highVal = closeVal
	}
	if lowVal == 0 {
		lowVal = closeVal
	}

	_, err = database.DB.Exec(`
		INSERT INTO ohlcv_daily (ticker, trade_date, open, high, low, close, volume)
		VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6)
		ON CONFLICT (ticker, trade_date) DO UPDATE SET
			open   = ohlcv_daily.open,
			high   = GREATEST(ohlcv_daily.high, EXCLUDED.high),
			low    = LEAST(ohlcv_daily.low, EXCLUDED.low),
			close  = EXCLUDED.close,
			volume = EXCLUDED.volume
	`, tick.Ticker, openVal, highVal, lowVal, closeVal, tick.Volume)
	if err != nil {
		log.Printf("Failed to upsert ohlcv_daily for %s: %v", tick.Ticker, err)
	}
}

// persistScreenerResult writes engine-side BSJP/Swing/Scalping signals into
// screener_results so the /api/screener/{strategy} endpoint can serve them.
// The TradingView webhook handler does its own UPSERT separately; the two
// sources are distinguished by the `source` column ('engine' vs 'tradingview')
// so each can be filtered or audited independently.
func persistScreenerResult(data []byte) {
	var upd ScreenerUpdate
	if err := json.Unmarshal(data, &upd); err != nil {
		return
	}
	if upd.Ticker == "" || upd.Strategy == "" {
		return
	}
	source := upd.Source
	if source == "" {
		source = "engine"
	}

	payload := upd.Payload
	if len(payload) == 0 {
		payload = json.RawMessage("{}")
	}

	// Match the upsert pattern used by handlers/webhook.go: latest row
	// per (strategy, ticker) is updated in place; otherwise insert a
	// new one. BSJP rows are locked at end-of-day to match the engine.
	var rowID int64
	var isLocked bool
	err := database.DB.QueryRow(`
		SELECT id, COALESCE(is_locked, false) FROM screener_results
		WHERE strategy = $1 AND ticker = $2
		ORDER BY screened_at DESC LIMIT 1
	`, upd.Strategy, upd.Ticker).Scan(&rowID, &isLocked)

	if err == sql.ErrNoRows {
		_, err = database.DB.Exec(`
			INSERT INTO screener_results (strategy, ticker, signal, score, payload, screened_at, is_locked, source)
			VALUES ($1, $2, $3, $4, $5, NOW(), false, $6)
		`, upd.Strategy, upd.Ticker, upd.Signal, upd.Score, []byte(payload), source)
		if err != nil {
			log.Printf("persistScreenerResult insert failed for %s/%s: %v", upd.Ticker, upd.Strategy, err)
		}
		return
	}
	if err != nil {
		log.Printf("persistScreenerResult lookup failed for %s/%s: %v", upd.Ticker, upd.Strategy, err)
		return
	}

	if isLocked && upd.Strategy == "bsjp" {
		return
	}

	_, err = database.DB.Exec(`
		UPDATE screener_results
		SET signal=$1, score=$2, payload=$3, screened_at=NOW(), source=$4
		WHERE id=$5
	`, upd.Signal, upd.Score, []byte(payload), source, rowID)
	if err != nil {
		log.Printf("persistScreenerResult update failed for %s/%s: %v", upd.Ticker, upd.Strategy, err)
	}
}

func persistBandarFlow(data []byte) {
	var flow BandarFlow
	if err := json.Unmarshal(data, &flow); err != nil {
		return
	}
	
	_, err := database.DB.Exec(`
		INSERT INTO bandar_flow (ticker, price, volume, vol_ratio, obv_trend, ad_value, close_position, mfi, net_buy_proxy, accum_score, signal, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		ON CONFLICT (ticker) DO UPDATE SET
			price = EXCLUDED.price,
			volume = EXCLUDED.volume,
			vol_ratio = EXCLUDED.vol_ratio,
			obv_trend = EXCLUDED.obv_trend,
			ad_value = EXCLUDED.ad_value,
			close_position = EXCLUDED.close_position,
			mfi = EXCLUDED.mfi,
			net_buy_proxy = EXCLUDED.net_buy_proxy,
			accum_score = EXCLUDED.accum_score,
			signal = EXCLUDED.signal,
			updated_at = NOW()
	`, flow.Ticker, flow.Price, flow.Volume, flow.VolRatio, flow.ObvTrend, flow.AdValue, flow.ClosePosition, flow.Mfi, flow.NetBuyProxy, flow.AccumScore, flow.Signal)

	if err != nil {
		log.Printf("Failed to persist bandar flow for %s: %v", flow.Ticker, err)
	}
}

func persistNews(data []byte) {
	var news NewsItem
	if err := json.Unmarshal(data, &news); err != nil {
		return
	}
	if news.Headline == "" {
		return
	}

	// image_url is written to the column that migration 002 already provides;
	// on conflict we upgrade the stored value so a later fetch that finds a
	// better image can overwrite an empty one from an earlier run.
	_, err := database.DB.Exec(`
		INSERT INTO news (title, link, source, sentiment, sentiment_score, ticker, url, image_url, published_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (link) DO UPDATE SET
			image_url = COALESCE(NULLIF(EXCLUDED.image_url, ''), news.image_url)
	`, news.Headline, news.URL, news.Source, news.Sentiment, news.SentimentScore, news.Ticker, news.URL, news.ImageURL, news.Timestamp)

	if err != nil {
		log.Printf("Failed to persist news: %v", err)
	}
}

// persistIndexUpdate writes real IHSG index data from ^JKSE to market_overview
func persistIndexUpdate(data []byte) {
	var idx IndexUpdate
	if err := json.Unmarshal(data, &idx); err != nil {
		return
	}
	if idx.IndexValue == 0 {
		return
	}

	// Update only index_value and change_pct from real IHSG data;
	// volume/valuation/foreign_flow are still aggregated from stock_info.
	_, err := database.DB.Exec(`
		UPDATE market_overview
		SET index_value = $1, change_pct = $2, updated_at = NOW()
		WHERE id = 1
	`, idx.IndexValue, idx.ChangePct)
	if err != nil {
		log.Printf("Failed to persist IHSG index update: %v", err)
	}
}

func aggregateMarketOverview() {
	for {
		time.Sleep(30 * time.Second)
<<<<<<< Updated upstream
=======
		if markethours.IsMarketOpenOrEODWindow(time.Now()) {
			DoAggregateMarketOverview()
		}
	}
}
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
		// Use real IHSG value if available (set by persistIndexUpdate from ^JKSE),
		// otherwise fall back to synthetic weighted average.
		var existingIndex float64
		database.DB.QueryRow(`
			SELECT COALESCE(index_value, 0) FROM market_overview WHERE id = 1
		`).Scan(&existingIndex)

		var indexValue float64
		if existingIndex > 0 {
			// Real IHSG from ^JKSE is already set; keep it.
			indexValue = existingIndex
		} else {
			// Fallback: synthetic weighted average
			database.DB.QueryRow(`
				SELECT COALESCE(SUM(last_price * market_cap) / NULLIF(SUM(market_cap), 0), 0)
				FROM stock_info WHERE last_price > 0 AND market_cap > 0
			`).Scan(&indexValue)
		}

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
=======
	// Use real IHSG value if available (set by persistIndexUpdate from ^JKSE).
	// When the index feed has not produced anything yet (existingIndex == 0
	// means persistIndexUpdate() has never run for IHSG), we intentionally
	// DO NOT synthesise a weighted-average index — that produced a plausible
	// but fake number that misled users. Instead we skip the index_value /
	// change_pct columns for this iteration and only refresh the real
	// aggregates (volume / valuation / foreign_flow). The frontend renders
	// an "Index data unavailable" placeholder when index_value is still 0.
	var existingIndex float64
	var existingChangePct float64
	database.DB.QueryRow(`
		SELECT COALESCE(index_value, 0), COALESCE(change_pct, 0) FROM market_overview WHERE id = 1
	`).Scan(&existingIndex, &existingChangePct)

	// Estimate foreign flow as net of top gainers vs losers volume (simplified proxy)
	var foreignFlow int64
	database.DB.QueryRow(`
		SELECT COALESCE(
			SUM(CASE WHEN change_pct > 0 THEN volume ELSE -volume END),
		0) FROM stock_info WHERE change_pct != 0
	`).Scan(&foreignFlow)

	if existingIndex <= 0 {
		// IHSG feed still cold — refresh only the aggregate columns and
		// leave index_value / change_pct at their seed (0 / 0) so the UI
		// can surface the "unavailable" state. We still log so an operator
		// can tell apart "aggregation never ran" from "index feed is down".
		_, err = database.DB.Exec(`
			UPDATE market_overview
			   SET volume = $1,
			       valuation = $2,
			       foreign_flow = $3,
			       updated_at = NOW()
			 WHERE id = 1
		`, totalVolume, totalValuation, foreignFlow)
		if err != nil {
			log.Printf("Failed to update market_overview aggregates (no IHSG yet): %v", err)
			return
		}
		log.Printf("market_overview: refreshed aggregates only; IHSG index feed not yet available")
	} else {
		// Real IHSG from ^JKSE is set; UPSERT the full row so the index
		// and change_pct stay pinned to the live feed. The existing-row
		// values are reused verbatim so we never overwrite the feed with
		// derived numbers.
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
		`, existingIndex, existingChangePct, totalVolume, totalValuation, foreignFlow)

		if err != nil {
			log.Printf("Failed to update market_overview: %v", err)
			return
		}
	}

	// Compute sector performance from stock_info grouped by sector.
	// Remove `change_pct != 0` as some valid sectors might be flat.
	// Exclude null/empty sectors.
	sectorRows, err := database.DB.Query(`
		SELECT sector, AVG(change_pct), SUM(volume)
		FROM stock_info
		WHERE sector IS NOT NULL AND sector != '' AND sector != 'N/A' AND last_price > 0
		GROUP BY sector
		ORDER BY ABS(AVG(change_pct)) DESC
	`)
	if err != nil {
		return
	}
>>>>>>> Stashed changes

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

// cleanupOldNews runs periodically (e.g. daily) to remove old news
// preventing the news table from bloating storage.
func cleanupOldNews() {
	for {
		_, err := database.DB.Exec(`
			DELETE FROM news 
			WHERE published_at < NOW() - INTERVAL '30 days'
		`)
		if err != nil {
			log.Printf("Failed to cleanup old news: %v", err)
		} else {
			log.Printf("Successfully cleaned up old news (>30 days)")
		}

		// Run once a day
		time.Sleep(24 * time.Hour)
	}
}
