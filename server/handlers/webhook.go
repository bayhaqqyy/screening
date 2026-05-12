package handlers

import (
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/internal/ta"
	"github.com/sahamscreen/server/ws"
)

// TVAlertPayload mirrors the JSON body that TradingView sends to the webhook.
// Anything not parsed here is still preserved verbatim in tv_alerts.payload
// for audit and future use.
type TVAlertPayload struct {
	Secret    string  `json:"secret"`
	AlertID   string  `json:"alert_id"`
	Ticker    string  `json:"ticker"`
	Exchange  string  `json:"exchange"`
	Interval  string  `json:"interval"`
	Strategy  string  `json:"strategy"`
	Signal    string  `json:"signal"`
	Price     float64 `json:"price"`
	Open      float64 `json:"open"`
	High      float64 `json:"high"`
	Low       float64 `json:"low"`
	Volume    float64 `json:"volume"`
	Score     int     `json:"score"`
	Target    float64 `json:"target"`
	StopLoss  float64 `json:"stop_loss"`
	Time      string  `json:"time"`
}

const (
	maxWebhookBodyBytes = 64 * 1024
	defaultScore        = 70
)

var allowedStrategies = map[string]bool{
	"bsjp":     true,
	"swing":    true,
	"scalping": true,
}

// WebhookHealth is a minimal liveness probe for monitoring + Cloudflare Tunnel
// readiness checks.
func WebhookHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"tradingview-webhook"}`))
}

// TradingViewWebhook accepts alerts published by TradingView, persists them to
// tv_alerts (audit + idempotency), upserts into screener_results, and
// broadcasts the result over WebSocket so the React app updates in real time.
//
// Auth model:
//   - Path token (URL): /api/webhooks/tradingview/{token} validated against
//     TV_WEBHOOK_PATH_TOKEN.
//   - Optional body field "secret" validated against TV_WEBHOOK_SECRET when
//     that env var is set (defense in depth, allows rotation without changing
//     the URL configured in TradingView).
func TradingViewWebhook(w http.ResponseWriter, r *http.Request) {
	if !validatePathToken(r) {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxWebhookBodyBytes)
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "failed to read body", http.StatusBadRequest)
		return
	}

	var payload TVAlertPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		http.Error(w, "invalid json body", http.StatusBadRequest)
		return
	}

	if err := validateBodySecret(payload.Secret); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	normalized, err := normalizeAlert(payload)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// When TradingView omits {{strategy.order.id}} (plain alerts), the
	// alert_id arrives empty and the partial unique index in 004_tv_alerts
	// can't dedupe. Fall back to a deterministic synthetic id derived from
	// (ticker, strategy, payload, 1-min time bucket) so a misfiring TV
	// alert that retries the same payload within a minute still dedupes.
	if normalized.AlertID == "" {
		normalized.AlertID = synthesizeAlertID(normalized, rawBody, time.Now().UTC())
	}

	rawJSON := json.RawMessage(rawBody)
	auditID, duplicate, err := persistTVAlert(normalized, rawJSON)
	if err != nil {
		log.Printf("tv webhook: persist error: %v", err)
		http.Error(w, "failed to persist alert", http.StatusInternalServerError)
		return
	}

	if duplicate {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]any{
			"status":    "duplicate",
			"alert_id":  normalized.AlertID,
			"ticker":    normalized.Ticker,
			"strategy":  normalized.Strategy,
		})
		return
	}

	if err := upsertScreenerResult(normalized); err != nil {
		log.Printf("tv webhook: upsert screener_results error: %v", err)
		// Audit row is already saved, surface the failure but don't lose
		// the audit trail.
		http.Error(w, "failed to update screener results", http.StatusInternalServerError)
		return
	}

	broadcastScreenerUpdate(normalized)
	markProcessed(auditID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]any{
		"status":   "accepted",
		"id":       auditID,
		"ticker":   normalized.Ticker,
		"strategy": normalized.Strategy,
		"signal":   normalized.Signal,
		"score":    normalized.Score,
	})
}

func validatePathToken(r *http.Request) bool {
	expected := config.AppConfig.TVWebhookPathToken
	if expected == "" {
		// Webhook is effectively disabled until an operator sets the token.
		return false
	}
	got := mux.Vars(r)["token"]
	return constantTimeEqual(got, expected)
}

func validateBodySecret(provided string) error {
	expected := config.AppConfig.TVWebhookSecret
	if expected == "" {
		// Body secret is optional; skip when not configured.
		return nil
	}
	if !constantTimeEqual(provided, expected) {
		return errors.New("invalid secret")
	}
	return nil
}

func constantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// normalizeAlert maps a raw TradingView payload into the shape the rest of
// the pipeline expects (lowercase strategy, uppercase ticker without exchange
// prefix, default score, etc).
func normalizeAlert(p TVAlertPayload) (TVAlertPayload, error) {
	p.Ticker = strings.ToUpper(strings.TrimSpace(stripExchangePrefix(p.Ticker)))
	if p.Ticker == "" {
		return p, errors.New("missing ticker")
	}

	p.Strategy = strings.ToLower(strings.TrimSpace(p.Strategy))
	if !allowedStrategies[p.Strategy] {
		return p, errors.New("unsupported strategy")
	}

	p.Signal = strings.ToUpper(strings.TrimSpace(p.Signal))
	if p.Signal == "" {
		p.Signal = "WATCH"
	}

	if p.Score == 0 {
		p.Score = defaultScore
	}
	if p.Score < 0 {
		p.Score = 0
	}
	if p.Score > 100 {
		p.Score = 100
	}

	if p.Price <= 0 {
		return p, errors.New("price must be positive")
	}

	if p.Target == 0 {
		p.Target = p.Price * 1.05
	}
	if p.StopLoss == 0 {
		p.StopLoss = p.Price * 0.97
	}

	return p, nil
}

func stripExchangePrefix(t string) string {
	if i := strings.LastIndex(t, ":"); i >= 0 {
		return t[i+1:]
	}
	return t
}

// synthesizeAlertID produces a stable 32-hex-char fingerprint when the
// TradingView payload doesn't carry an alert_id. Using a 1-minute time
// bucket means the same alert retried within a minute is treated as a
// duplicate (matches typical TV retry/burst behaviour) but a real
// follow-up alert in the next minute still gets a fresh row. The format
// "syn-<16hex>-<unix-bucket>" stays under tv_alerts.alert_id VARCHAR(64).
func synthesizeAlertID(p TVAlertPayload, rawBody []byte, now time.Time) string {
	bucket := now.Unix() / 60
	h := sha256.New()
	fmt.Fprintf(h, "%s|%s|%d|", p.Ticker, p.Strategy, bucket)
	h.Write(rawBody)
	digest := hex.EncodeToString(h.Sum(nil))
	return fmt.Sprintf("syn-%s-%d", digest[:16], bucket)
}

// persistTVAlert writes the audit row. Returns (id, duplicate, err).
// Duplicates (matching alert_id+ticker+strategy) are detected via the
// partial unique index defined in migration 004.
func persistTVAlert(p TVAlertPayload, rawBody json.RawMessage) (int64, bool, error) {
	var id int64
	err := database.DB.QueryRow(`
		INSERT INTO tv_alerts (alert_id, ticker, strategy, signal, score, price, payload)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (alert_id, ticker, strategy)
			WHERE alert_id IS NOT NULL AND alert_id <> ''
			DO NOTHING
		RETURNING id
	`, p.AlertID, p.Ticker, p.Strategy, p.Signal, p.Score, p.Price, []byte(rawBody)).Scan(&id)
	if err != nil {
		// ON CONFLICT DO NOTHING with no row returned manifests as
		// sql.ErrNoRows; treat that as a duplicate.
		if errors.Is(err, sql.ErrNoRows) {
			return 0, true, nil
		}
		return 0, false, err
	}
	return id, false, nil
}

// enrichPayload queries ohlcv_daily to compute support/resistance, FVG, and
// 3-week trend for the given ticker and merges the results into payload.
// Enrichment is best-effort: on any error the payload is returned unchanged
// and a warning is logged so the webhook pipeline is never blocked.
func enrichPayload(ticker string, refPrice float64, payload map[string]any) map[string]any {
	sr, err := ta.ComputeSupportResistance(database.DB, ticker, refPrice)
	if err != nil {
		log.Printf("tv webhook: enrichPayload S/R for %s: %v", ticker, err)
	} else {
		payload["support"] = sr.Support
		payload["resistance"] = sr.Resistance
	}

	fvg, err := ta.ComputeFVG(database.DB, ticker)
	if err != nil {
		log.Printf("tv webhook: enrichPayload FVG for %s: %v", ticker, err)
	} else {
		payload["fvg_bullish"] = fvg.Present
		payload["fvg_high"] = fvg.GapHigh
		payload["fvg_low"] = fvg.GapLow
	}

	trend, err := ta.ComputeTrend3W(database.DB, ticker)
	if err != nil {
		log.Printf("tv webhook: enrichPayload Trend3W for %s: %v", ticker, err)
	} else {
		payload["trend_3w"] = trend.Direction
	}

	return payload
}

func upsertScreenerResult(p TVAlertPayload) error {
	payload := map[string]any{
		"price":         p.Price,
		"entry_price":   p.Price,
		"target":        p.Target,
		"stop_loss":     p.StopLoss,
		"volume":        p.Volume,
		"open":          p.Open,
		"high":          p.High,
		"low":           p.Low,
		"interval":      p.Interval,
		"exchange":      p.Exchange,
		"alert_id":      p.AlertID,
		"alert_time":    p.Time,
		"source":        "tradingview",
	}
<<<<<<< Updated upstream
=======
	var rowID int64
	var isLocked bool
	var existingPayload []byte
	scanErr := database.DB.QueryRow(`
		SELECT id, COALESCE(is_locked, false), payload FROM screener_results
		WHERE strategy = $1 AND ticker = $2
		ORDER BY screened_at DESC LIMIT 1
	`, p.Strategy, p.Ticker).Scan(&rowID, &isLocked, &existingPayload)

	if scanErr == nil && len(existingPayload) > 0 {
		var ep map[string]any
		if json.Unmarshal(existingPayload, &ep) == nil {
			if existingEntry, ok := ep["entry_price"]; ok {
				payload["entry_price"] = existingEntry
			}
		}
	}

	// Best-effort TA enrichment — populates support, resistance, fvg_*, trend_3w.
	payload = enrichPayload(p.Ticker, p.Price, payload)

>>>>>>> Stashed changes
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	// Look for an existing row for this (strategy, ticker) to UPDATE in
	// place; otherwise INSERT a new one. Mirrors what
	// engine/streaming/screener_consumer.py does so the existing
	// /api/screener/{strategy} query (DISTINCT ON ticker) keeps working.
	var rowID int64
	var isLocked bool
	err = database.DB.QueryRow(`
		SELECT id, COALESCE(is_locked, false) FROM screener_results
		WHERE strategy = $1 AND ticker = $2
		ORDER BY screened_at DESC LIMIT 1
	`, p.Strategy, p.Ticker).Scan(&rowID, &isLocked)

	switch {
	case errors.Is(err, sql.ErrNoRows):
		_, err = database.DB.Exec(`
			INSERT INTO screener_results (strategy, ticker, signal, score, payload, screened_at, is_locked, source)
			VALUES ($1, $2, $3, $4, $5, NOW(), false, 'tradingview')
		`, p.Strategy, p.Ticker, p.Signal, p.Score, payloadBytes)
		return err
	case err != nil:
		return err
	}

	if isLocked && p.Strategy == "bsjp" {
		// BSJP locks at end-of-day — respect that to match engine behaviour.
		return nil
	}

	_, err = database.DB.Exec(`
		UPDATE screener_results
		SET signal=$1, score=$2, payload=$3, screened_at=NOW(), source='tradingview'
		WHERE id=$4
	`, p.Signal, p.Score, payloadBytes, rowID)
	return err
}

func markProcessed(id int64) {
	if id == 0 {
		return
	}
	if _, err := database.DB.Exec(`UPDATE tv_alerts SET processed = true WHERE id = $1`, id); err != nil {
		log.Printf("tv webhook: mark processed failed for %d: %v", id, err)
	}
}

// broadcastScreenerUpdate emits a message in the same shape as the existing
// Kafka -> WS bridge in server/kafka/consumer.go so the React client can
// keep using its current WS handler unchanged.
func broadcastScreenerUpdate(p TVAlertPayload) {
	inner := map[string]any{
		"ticker":   p.Ticker,
		"strategy": p.Strategy,
		"signal":   p.Signal,
		"score":    p.Score,
		"payload": map[string]any{
			"price":       p.Price,
			"entry_price": p.Price,
			"target":      p.Target,
			"stop_loss":   p.StopLoss,
			"volume":      p.Volume,
		},
		"source":    "tradingview",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	innerBytes, err := json.Marshal(inner)
	if err != nil {
		log.Printf("tv webhook: marshal ws inner failed: %v", err)
		return
	}

	envelope := map[string]any{
		"topic": "idx.screener.updates",
		"key":   p.Ticker,
		"data":  json.RawMessage(innerBytes),
	}
	envelopeBytes, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("tv webhook: marshal ws envelope failed: %v", err)
		return
	}

	ws.AppHub.Broadcast(envelopeBytes)
}
