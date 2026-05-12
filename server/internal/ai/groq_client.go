// Package ai — Groq free-tier client.
//
// Decision lock (see PLAN_V2.md "AI Provider Lock"): all LLM traffic goes
// through Groq's free-tier OpenAI-compatible endpoint. Two models are
// addressed by role, not by version string, so swapping either is a config
// change:
//
//   GroqFastModel  ("llama-3.1-8b-instant")      — screener commentary, news
//   GroqProModel   ("llama-3.3-70b-versatile")   — deep analysis, daily report
//
// Three layers sit in front of every outbound request:
//
//   1. Feature flag (config.AIEnabled). When false, Ask returns
//      ErrAIDisabled immediately — no network, no cache hit.
//   2. TTL cache. Keys are sha256(system || user || model). Hot path is a
//      stock ticker being asked about repeatedly within the cache TTL.
//   3. gobreaker circuit breaker. A run of failures trips the breaker so
//      we stop paying the rate-limit budget on a provider that is already
//      unhappy; callers get gobreaker.ErrOpenState and the HTTP handlers
//      translate that to a 502 with Retry-After.
package ai

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sahamscreen/server/config"
	"github.com/sony/gobreaker"
)

// ErrAIDisabled is returned while config.AIEnabled is false so callers can
// degrade gracefully (e.g. hide an "AI commentary" badge) instead of 500ing.
var ErrAIDisabled = errors.New("ai: disabled — set AI_ENABLED=true to enable Groq calls")

// ErrNoAPIKey means AI is nominally enabled but no GROQ_API_KEY is configured.
// Separated from ErrAIDisabled so ops dashboards can distinguish "off by
// design" from "misconfigured".
var ErrNoAPIKey = errors.New("ai: GROQ_API_KEY is not configured")

// Client is the single entry point other packages should use. Construct it
// once (see Default()) and share — it is safe for concurrent use.
type Client struct {
	http      *http.Client
	breaker  *gobreaker.CircuitBreaker
	cache    *ttlCache
	fastModel string
	proModel  string
	endpoint  string
	apiKey    string
	enabled   bool
}

// ChatRequest is the minimal, model-agnostic input shape. The concrete wire
// format (OpenAI-compatible /chat/completions) is handled internally so
// callers never build JSON by hand.
type ChatRequest struct {
	System   string
	User     string
	MaxToks  int
	Model    string // optional override; default picks FastModel
	CacheKey string // optional; skip the default hash-based key
}

// ChatResponse carries only what the rest of the app needs today. Extend with
// token counts / tool calls when we wire up richer UI features.
type ChatResponse struct {
	Content string
	Cached  bool
	Model   string
}

var (
	defaultOnce   sync.Once
	defaultClient *Client
)

// Default returns the process-wide Groq client, lazily initialised from
// config.AppConfig. Separated from NewClient so tests can build an isolated
// Client with a fake http.Client pointing at httptest.Server.
func Default() *Client {
	defaultOnce.Do(func() {
		defaultClient = NewClient(config.AppConfig)
	})
	return defaultClient
}

// ResetDefault clears the cached Default() instance. Tests use this to
// force re-initialisation after mutating config.AppConfig.
func ResetDefault() {
	defaultOnce = sync.Once{}
	defaultClient = nil
}

// NewClient builds a Client from an explicit Config snapshot. Does not hit
// the network.
func NewClient(cfg config.Config) *Client {
	timeout := time.Duration(cfg.GroqTimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 8 * time.Second
	}

	cbSettings := gobreaker.Settings{
		Name:        "groq",
		MaxRequests: 1,                // one probe request in half-open
		Interval:    60 * time.Second, // rolling window for failure counting
		Timeout:     30 * time.Second, // how long we stay tripped before half-open
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			if counts.ConsecutiveFailures >= 5 {
				return true
			}
			if counts.Requests < 10 {
				return false
			}
			failRatio := float64(counts.TotalFailures) / float64(counts.Requests)
			return failRatio >= 0.6
		},
	}

	ttl := time.Duration(cfg.GroqCacheTTLSec) * time.Second
	if ttl <= 0 {
		ttl = 120 * time.Second
	}

	return &Client{
		http:      &http.Client{Timeout: timeout},
		breaker:   gobreaker.NewCircuitBreaker(cbSettings),
		cache:     newTTLCache(ttl),
		fastModel: cfg.GroqFastModel,
		proModel:  cfg.GroqProModel,
		endpoint:  cfg.GroqAPIURL,
		apiKey:    cfg.GroqAPIKey,
		enabled:   cfg.AIEnabled,
	}
}

// Enabled reports whether the feature flag is on AND we have an API key.
// Handlers should check this before exposing AI-adjacent UI.
func (c *Client) Enabled() bool {
	return c != nil && c.enabled && c.apiKey != ""
}

// FastModel / ProModel expose the configured model ids for status endpoints.
func (c *Client) FastModel() string { return c.fastModel }
func (c *Client) ProModel() string  { return c.proModel }

// SetHTTPClient is the test seam for swapping the net/http client so a
// httptest.Server can stand in for Groq. Not part of the public contract;
// tests should use this + ResetDefault() together.
func (c *Client) SetHTTPClient(h *http.Client) {
	if c == nil || h == nil {
		return
	}
	c.http = h
}

// SetEndpoint is another test seam used to redirect traffic at an httptest
// server. Same no-op guards as SetHTTPClient.
func (c *Client) SetEndpoint(url string) {
	if c == nil || url == "" {
		return
	}
	c.endpoint = url
}

// chatCompletionReq mirrors the subset of the OpenAI-compatible chat
// completions body that Groq accepts today. Only fields we actually set are
// present — extend as the UI grows features.
type chatCompletionReq struct {
	Model       string                 `json:"model"`
	Messages    []chatMessage          `json:"messages"`
	MaxTokens   int                    `json:"max_tokens,omitempty"`
	Temperature float64                `json:"temperature,omitempty"`
	Stream      bool                   `json:"stream"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionResp struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

// CallChat is the low-level POST-to-Groq primitive. It is exposed on the
// Client so tests and advanced callers can bypass the convenience wrappers,
// but normal code paths use Ask / Analyse / DailyReport / NewsSentiment.
//
// The function handles:
//   • request body serialisation to OpenAI-compatible JSON
//   • Authorization: Bearer header
//   • context cancellation (so a handler timing out tears the call down)
//   • non-2xx responses surface the provider's error body verbatim
func (c *Client) CallChat(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	return c.callChatWithModel(ctx, systemPrompt, userPrompt, c.fastModel, 0)
}

// callChatWithModel is the internal variant used by Analyse / DailyReport to
// switch to the pro model. Exposed only inside the package.
func (c *Client) callChatWithModel(ctx context.Context, systemPrompt, userPrompt, model string, maxTokens int) (string, error) {
	if c == nil {
		return "", ErrAIDisabled
	}
	if !c.enabled {
		return "", ErrAIDisabled
	}
	if c.apiKey == "" {
		return "", ErrNoAPIKey
	}
	if model == "" {
		model = c.fastModel
	}

	body := chatCompletionReq{
		Model:       model,
		Messages:    buildMessages(systemPrompt, userPrompt),
		MaxTokens:   maxTokens,
		Temperature: 0.2, // screener commentary should be stable, not creative
		Stream:      false,
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("ai: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("ai: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("ai: http: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("ai: read body: %w", err)
	}
	if resp.StatusCode >= 400 {
		// Try to extract the provider's `error.message` for a better log
		// trail; fall back to the raw body otherwise.
		var parsed chatCompletionResp
		_ = json.Unmarshal(raw, &parsed)
		if parsed.Error != nil && parsed.Error.Message != "" {
			return "", fmt.Errorf("ai: groq %d: %s", resp.StatusCode, parsed.Error.Message)
		}
		return "", fmt.Errorf("ai: groq %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var parsed chatCompletionResp
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("ai: decode response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", errors.New("ai: groq returned no choices")
	}
	return strings.TrimSpace(parsed.Choices[0].Message.Content), nil
}

func buildMessages(systemPrompt, userPrompt string) []chatMessage {
	msgs := make([]chatMessage, 0, 2)
	if systemPrompt != "" {
		msgs = append(msgs, chatMessage{Role: "system", Content: systemPrompt})
	}
	msgs = append(msgs, chatMessage{Role: "user", Content: userPrompt})
	return msgs
}

// Ask is the generic entry point for the fast model. Results are cached by
// sha256 of (system, user, model) so repeat calls within TTL are free.
//
// Errors propagated to callers:
//   ErrAIDisabled   — AI_ENABLED=false.
//   ErrNoAPIKey     — AI_ENABLED=true but GROQ_API_KEY is empty.
//   gobreaker.ErrOpenState — too many recent failures; back off and retry.
//   wrapped HTTP / decode / status errors — any other upstream failure.
func (c *Client) Ask(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	if c == nil || !c.enabled {
		return nil, ErrAIDisabled
	}
	if c.apiKey == "" {
		return nil, ErrNoAPIKey
	}

	model := c.pickModel(req)

	key := req.CacheKey
	if key == "" {
		key = hashKey(model, req.System, req.User)
	}
	if hit, ok := c.cache.get(key); ok {
		return &ChatResponse{Content: hit, Cached: true, Model: model}, nil
	}

	out, err := c.breaker.Execute(func() (interface{}, error) {
		return c.callChatWithModel(ctx, req.System, req.User, model, req.MaxToks)
	})
	if err != nil {
		return nil, err
	}
	content, _ := out.(string)
	if content != "" {
		c.cache.set(key, content)
	}
	return &ChatResponse{Content: content, Cached: false, Model: model}, nil
}

// Analyse is the "deep" wrapper — routes through the pro model and asks for
// structured JSON. The caller decides what to do with the JSON string; we
// do not pre-parse because the schema will evolve.
func (c *Client) Analyse(ctx context.Context, ticker, extraContext string) (*ChatResponse, error) {
	return c.Ask(ctx, ChatRequest{
		Model: c.proModel,
		System: "You are SahamScreen AI, a professional Indonesian stock market " +
			"technical analyst. Respond in compact JSON with keys: verdict, " +
			"confidence, entry_zone{low,high}, targets[], stop_loss, " +
			"risk_reward_ratio, support_levels[], resistance_levels[], " +
			"key_factors[], commentary_id, timeframe. Bahasa Indonesia for " +
			"any free-text fields.",
		User:    fmt.Sprintf("Ticker: %s\nContext:\n%s", ticker, extraContext),
		MaxToks: 800,
	})
}

// DailyReport generates the end-of-day Bahasa Indonesia market summary. Fires
// from the schedule worker at 15:45 WIB on trading days.
func (c *Client) DailyReport(ctx context.Context, summary string) (*ChatResponse, error) {
	return c.Ask(ctx, ChatRequest{
		Model: c.proModel,
		System: "You are SahamScreen AI, generating the end-of-day market report " +
			"for the Indonesian stock market (IDX / BEI). Use clean markdown, " +
			"Bahasa Indonesia, and stay under 500 words with sections: " +
			"Ringkasan Pasar, Sektor Unggulan, Top Picks Hari Ini, " +
			"Sentimen Berita, Outlook Besok.",
		User:    summary,
		MaxToks: 1200,
	})
}

// NewsSentiment is the very-cheap wrapper used by the news pipeline to
// re-check a keyword-based sentiment call with the fast model.
func (c *Client) NewsSentiment(ctx context.Context, headline string) (*ChatResponse, error) {
	return c.Ask(ctx, ChatRequest{
		Model: c.fastModel,
		System: "You classify an Indonesian financial news headline into " +
			"'positive', 'negative', or 'neutral'. Reply with a single word, " +
			"lowercase, no punctuation.",
		User:    headline,
		MaxToks: 10,
	})
}

func (c *Client) pickModel(req ChatRequest) string {
	if req.Model != "" {
		return req.Model
	}
	return c.fastModel
}

// hashKey produces a deterministic cache key. SHA-256 is overkill for a
// local map but the cost is negligible and it avoids any cross-ticker
// collision risk.
func hashKey(model, system, user string) string {
	h := sha256.New()
	h.Write([]byte(model))
	h.Write([]byte{0})
	h.Write([]byte(system))
	h.Write([]byte{0})
	h.Write([]byte(user))
	return hex.EncodeToString(h.Sum(nil))
}

// --- ttlCache ---------------------------------------------------------------
//
// A bounded, lock-guarded string cache is enough for the current load: a few
// hundred keys per hour, short values. If we outgrow this the Client API
// does not change — swap in ristretto or memcached.

type cacheEntry struct {
	value   string
	expires time.Time
}

type ttlCache struct {
	mu      sync.RWMutex
	entries map[string]cacheEntry
	ttl     time.Duration
}

func newTTLCache(ttl time.Duration) *ttlCache {
	c := &ttlCache{entries: make(map[string]cacheEntry), ttl: ttl}
	go c.janitor()
	return c
}

func (c *ttlCache) get(key string) (string, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok {
		return "", false
	}
	if time.Now().After(e.expires) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		return "", false
	}
	return e.value, true
}

func (c *ttlCache) set(key, value string) {
	c.mu.Lock()
	c.entries[key] = cacheEntry{value: value, expires: time.Now().Add(c.ttl)}
	c.mu.Unlock()
}

func (c *ttlCache) janitor() {
	t := time.NewTicker(5 * time.Minute)
	defer t.Stop()
	for range t.C {
		now := time.Now()
		c.mu.Lock()
		for k, e := range c.entries {
			if now.After(e.expires) {
				delete(c.entries, k)
			}
		}
		c.mu.Unlock()
	}
}
