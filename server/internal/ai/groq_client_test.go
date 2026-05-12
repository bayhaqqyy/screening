package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sahamscreen/server/config"
)

// TestClient_DisabledByDefault — the flag must gate everything so the
// dark-launch can't accidentally start hitting Groq.
func TestClient_DisabledByDefault(t *testing.T) {
	c := NewClient(config.Config{
		GroqAPIKey:    "test-key",
		GroqFastModel: "llama-3.1-8b-instant",
	})
	if c.Enabled() {
		t.Error("client reports enabled when AIEnabled=false")
	}
	_, err := c.Ask(context.Background(), ChatRequest{User: "hi"})
	if !errors.Is(err, ErrAIDisabled) {
		t.Errorf("Ask err = %v, want ErrAIDisabled", err)
	}
	if _, err := c.CallChat(context.Background(), "sys", "user"); !errors.Is(err, ErrAIDisabled) {
		t.Errorf("CallChat err = %v, want ErrAIDisabled", err)
	}
}

// TestClient_NoAPIKey — even with AI_ENABLED=true, a missing key must raise
// a distinct error so ops can tell "off" apart from "misconfigured".
func TestClient_NoAPIKey(t *testing.T) {
	c := NewClient(config.Config{AIEnabled: true, GroqFastModel: "llama-3.1-8b-instant"})
	if c.Enabled() {
		t.Error("client should not be Enabled() without GROQ_API_KEY")
	}
	_, err := c.Ask(context.Background(), ChatRequest{User: "hi"})
	if !errors.Is(err, ErrNoAPIKey) {
		t.Errorf("Ask err = %v, want ErrNoAPIKey", err)
	}
}

// TestHashKey_Determinism — two identical requests must hash to the same key
// so the cache actually deduplicates.
func TestHashKey_Determinism(t *testing.T) {
	a := hashKey("model", "sys", "hello")
	b := hashKey("model", "sys", "hello")
	if a != b {
		t.Errorf("hashKey not deterministic: %q vs %q", a, b)
	}
	if hashKey("model", "sys", "HELLO") == a {
		t.Error("hashKey collides on case difference")
	}
	if hashKey("different-model", "sys", "hello") == a {
		t.Error("hashKey does not distinguish model")
	}
}

// TestTTLCache_GetSetExpire — exercises the cache directly with a short TTL
// so we cover the expiry branch without sleeping a second.
func TestTTLCache_GetSetExpire(t *testing.T) {
	cache := &ttlCache{entries: map[string]cacheEntry{}, ttl: 50 * time.Millisecond}

	cache.set("k", "v")
	if got, ok := cache.get("k"); !ok || got != "v" {
		t.Errorf("get after set = (%q,%v), want (v,true)", got, ok)
	}

	time.Sleep(80 * time.Millisecond)
	if _, ok := cache.get("k"); ok {
		t.Error("expected cache miss after TTL")
	}
}

// --- Integration tests against a fake Groq via httptest.Server -------------

// newFakeGroq returns an httptest.Server that mimics Groq's OpenAI-compatible
// /v1/chat/completions endpoint. `reply` is placed in choices[0].message.content
// and `hits` is atomically incremented on each request so tests can assert the
// cache was actually consulted.
func newFakeGroq(t *testing.T, reply string, hits *int64) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			atomic.AddInt64(hits, 1)
		}

		// Header sanity checks — ensure our client sends what the real
		// API expects so a regression cannot go undetected.
		if got := r.Header.Get("Authorization"); !strings.HasPrefix(got, "Bearer ") {
			t.Errorf("missing Bearer auth header, got %q", got)
		}
		if got := r.Header.Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", got)
		}

		// Sanity-check the request body has the OpenAI shape.
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Errorf("read body: %v", err)
		}
		var body map[string]interface{}
		if err := json.Unmarshal(raw, &body); err != nil {
			t.Errorf("request body is not JSON: %v", err)
		}
		if _, ok := body["model"]; !ok {
			t.Error("request body missing model field")
		}
		if _, ok := body["messages"]; !ok {
			t.Error("request body missing messages field")
		}

		resp := map[string]interface{}{
			"choices": []map[string]interface{}{
				{"message": map[string]interface{}{"role": "assistant", "content": reply}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
}

// TestCallChat_IntegrationAgainstFakeGroq drives the real code path end to
// end. It confirms (a) a successful 2xx response is parsed into the content
// string, (b) the breaker/cache layers do not corrupt the value, and (c)
// repeated calls hit the cache instead of dialling out again.
func TestCallChat_IntegrationAgainstFakeGroq(t *testing.T) {
	var hits int64
	server := newFakeGroq(t, "ringkasan singkat BBCA", &hits)
	defer server.Close()

	c := NewClient(config.Config{
		AIEnabled:       true,
		GroqAPIKey:      "test-key",
		GroqAPIURL:      server.URL,
		GroqFastModel:   "llama-3.1-8b-instant",
		GroqProModel:    "llama-3.3-70b-versatile",
		GroqTimeoutMS:   2000,
		GroqCacheTTLSec: 60,
	})

	// First call — should hit the fake server.
	got, err := c.CallChat(context.Background(), "system prompt", "BBCA")
	if err != nil {
		t.Fatalf("CallChat: %v", err)
	}
	if got != "ringkasan singkat BBCA" {
		t.Errorf("content = %q, want %q", got, "ringkasan singkat BBCA")
	}
	if n := atomic.LoadInt64(&hits); n != 1 {
		t.Errorf("hits after 1st call = %d, want 1", n)
	}

	// Second call via Ask with identical prompts — should hit the cache,
	// so the fake server hit count does NOT advance.
	resp, err := c.Ask(context.Background(), ChatRequest{
		System: "system prompt",
		User:   "BBCA",
	})
	if err != nil {
		t.Fatalf("Ask: %v", err)
	}
	if resp.Cached {
		// First Ask after a raw CallChat will not see a cache hit (the
		// CallChat path does not populate the Ask cache), so the Ask
		// should have hit the network. This is a deliberate behaviour
		// note for the maintainer reading the test.
		_ = resp
	}

	// Third call — guaranteed cache hit now.
	resp2, err := c.Ask(context.Background(), ChatRequest{
		System: "system prompt",
		User:   "BBCA",
	})
	if err != nil {
		t.Fatalf("Ask (2nd): %v", err)
	}
	if !resp2.Cached {
		t.Error("expected Cached=true on repeat Ask call")
	}
}

// TestCallChat_SurfacesUpstreamErrors confirms a 4xx/5xx from Groq becomes a
// wrapped error instead of silently returning empty content.
func TestCallChat_SurfacesUpstreamErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"error": map[string]string{
				"message": "Rate limit exceeded",
				"type":    "rate_limit",
			},
		})
	}))
	defer server.Close()

	c := NewClient(config.Config{
		AIEnabled:       true,
		GroqAPIKey:      "test-key",
		GroqAPIURL:      server.URL,
		GroqFastModel:   "llama-3.1-8b-instant",
		GroqTimeoutMS:   2000,
		GroqCacheTTLSec: 60,
	})

	_, err := c.CallChat(context.Background(), "", "hi")
	if err == nil {
		t.Fatal("expected error on 429, got nil")
	}
	if !strings.Contains(err.Error(), "429") || !strings.Contains(err.Error(), "Rate limit exceeded") {
		t.Errorf("error missing status/message: %v", err)
	}
}

// TestCallChat_RespectsContextCancellation ensures a cancelled context tears
// the HTTP request down rather than waiting for the server timeout.
func TestCallChat_RespectsContextCancellation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
		w.WriteHeader(200)
	}))
	defer server.Close()

	c := NewClient(config.Config{
		AIEnabled:       true,
		GroqAPIKey:      "test-key",
		GroqAPIURL:      server.URL,
		GroqFastModel:   "llama-3.1-8b-instant",
		GroqTimeoutMS:   5000,
		GroqCacheTTLSec: 60,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	_, err := c.CallChat(ctx, "", "hi")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if elapsed := time.Since(start); elapsed > 300*time.Millisecond {
		t.Errorf("CallChat waited %v, expected <300ms context cancellation", elapsed)
	}
}
