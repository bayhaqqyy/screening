package handlers

// ai.go — AI endpoints backed by the Groq free-tier client.
//
// Provider decision (locked in PLAN_V2.md): Groq's OpenAI-compatible
// endpoint with two free models — `llama-3.1-8b-instant` for commentary /
// sentiment and `llama-3.3-70b-versatile` for deep analysis / daily report.
//
// All four handlers share the same safety envelope:
//   • AuthMiddleware (mounted in main.go) — only authenticated users hit
//     the paid API budget.
//   • PerUserEndpointRateLimit — caps per-user calls even for valid JWTs.
//   • AIEnabled feature gate — when false the handlers reply 503 with a
//     structured JSON body so the frontend can hide AI affordances
//     gracefully.
//   • The internal/ai Client wraps the outbound request with a circuit
//     breaker and a TTL cache; handlers just translate its error types
//     to HTTP statuses.

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/internal/ai"
	"github.com/sony/gobreaker"
)

type aiResponse struct {
	Enabled    bool   `json:"enabled"`
	Model      string `json:"model,omitempty"`
	Content    string `json:"content,omitempty"`
	Cached     bool   `json:"cached,omitempty"`
	Message    string `json:"message,omitempty"`
	RetryAfter string `json:"retry_after,omitempty"`
}

// writeAIError maps the internal/ai error types onto the HTTP response
// layer so the frontend can branch on the JSON payload instead of
// scraping strings out of status codes.
func writeAIError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")
	body := aiResponse{Enabled: false, Message: err.Error()}

	switch {
	case errors.Is(err, ai.ErrAIDisabled):
		w.WriteHeader(http.StatusServiceUnavailable)
	case errors.Is(err, ai.ErrNoAPIKey):
		body.Message = "AI provider is enabled but GROQ_API_KEY is not set"
		w.WriteHeader(http.StatusServiceUnavailable)
	case errors.Is(err, gobreaker.ErrOpenState):
		body.Message = "Upstream AI provider is tripped; back off and retry"
		body.RetryAfter = "30"
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusBadGateway)
	default:
		body.RetryAfter = "30"
		w.Header().Set("Retry-After", "30")
		w.WriteHeader(http.StatusBadGateway)
	}
	_ = json.NewEncoder(w).Encode(body)
}

// GetAICommentary — GET /api/ai/commentary?ticker=BBCA&strategy=swing
//
// Instant 1-2 sentence screener commentary via the fast model.
func GetAICommentary(w http.ResponseWriter, r *http.Request) {
	ticker := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("ticker")))
	strategy := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("strategy")))
	if ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	client := ai.Default()
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	resp, err := client.Ask(ctx, ai.ChatRequest{
		System: "You are SahamScreen AI, an expert Indonesian stock market " +
			"analyst. Given a stock ticker and its technical signal data, " +
			"provide a concise 1-2 sentence commentary in Bahasa Indonesia " +
			"about the trading opportunity. Reference the signal type " +
			"(BSJP/Swing/Scalping). Output ONLY the commentary, max 280 chars.",
		User:    "Ticker: " + ticker + "\nStrategy: " + strategy,
		MaxToks: 200,
	})
	if err != nil {
		writeAIError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(aiResponse{
		Enabled: true,
		Model:   resp.Model,
		Content: resp.Content,
		Cached:  resp.Cached,
	})
}

// GetAIAnalysis — GET /api/ai/analysis?ticker=BBCA
//
// Deep trade analysis via the pro model. Returns raw JSON-as-text; the
// frontend is responsible for parsing to match the evolving schema in
// PLAN_V2.md.
func GetAIAnalysis(w http.ResponseWriter, r *http.Request) {
	ticker := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("ticker")))
	if ticker == "" {
		http.Error(w, "ticker required", http.StatusBadRequest)
		return
	}

	client := ai.Default()
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	resp, err := client.Analyse(ctx, ticker, "")
	if err != nil {
		writeAIError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(aiResponse{
		Enabled: true,
		Model:   resp.Model,
		Content: resp.Content,
		Cached:  resp.Cached,
	})
}

// GetAIDailyReport — GET /api/ai/daily-report
//
// End-of-day market report. The schedule_worker fires this at 15:45 WIB;
// this handler serves the most recent result to the Dashboard widget.
func GetAIDailyReport(w http.ResponseWriter, r *http.Request) {
	client := ai.Default()
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	resp, err := client.DailyReport(ctx, "")
	if err != nil {
		writeAIError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(aiResponse{
		Enabled: true,
		Model:   resp.Model,
		Content: resp.Content,
		Cached:  resp.Cached,
	})
}

// GetAIStatus — GET /api/ai/status
//
// Intentionally not rate-limited — feature detection should be free.
// The frontend calls this on every page load to decide whether to render
// AI affordances (commentary tooltips, analysis buttons, daily-report
// widget). Wrapping it in a per-user limiter would cause 429s on normal
// navigation and make the feature-flag check unreliable.
//
// The handler is still behind AuthMiddleware so unauthenticated traffic
// cannot probe it, but authenticated users can call it as often as they
// navigate without penalty.
func GetAIStatus(w http.ResponseWriter, r *http.Request) {
	client := ai.Default()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"enabled":          client.Enabled(),
		"fast_model":       config.AppConfig.GroqFastModel,
		"pro_model":        config.AppConfig.GroqProModel,
		"flag":             config.AppConfig.AIEnabled,
		"has_api_key":      config.AppConfig.GroqAPIKey != "",
		"rate_limit_min":   config.AppConfig.AIRateLimitPerMin,
		"rate_limit_burst": config.AppConfig.AIRateLimitBurst,
	})
}
