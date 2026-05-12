package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// dummyHandler counts how many requests reached it — a simple way to verify
// that the rate limiter correctly blocks extra requests.
type dummyHandler struct{ hits int }

func (d *dummyHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	d.hits++
	w.WriteHeader(http.StatusOK)
}

// TestPerUserEndpointRateLimit_Burst ensures that `burst` requests get
// through before the limiter starts returning 429, and that each excess
// request receives the expected status + Retry-After header.
func TestPerUserEndpointRateLimit_Burst(t *testing.T) {
	d := &dummyHandler{}
	wrapped := PerUserEndpointRateLimit(1, 3, "/test-endpoint")(d)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test-endpoint", nil)
		req.RemoteAddr = "1.2.3.4:5555"
		rec := httptest.NewRecorder()
		wrapped.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("req %d code = %d, want 200", i+1, rec.Code)
		}
	}

	// 4th request immediately after should be rejected.
	req := httptest.NewRequest(http.MethodGet, "/test-endpoint", nil)
	req.RemoteAddr = "1.2.3.4:5555"
	rec := httptest.NewRecorder()
	wrapped.ServeHTTP(rec, req)
	if rec.Code != http.StatusTooManyRequests {
		t.Errorf("over-limit code = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Error("expected Retry-After header on 429")
	}
	if d.hits != 3 {
		t.Errorf("handler hits = %d, want 3", d.hits)
	}
}

// TestPerUserEndpointRateLimit_Disabled_NoOp — passing perMinute<=0 or
// burst<=0 should return the next handler unchanged so wiring the limiter
// is a safe no-op until ops decide to turn it on.
func TestPerUserEndpointRateLimit_Disabled_NoOp(t *testing.T) {
	d := &dummyHandler{}
	wrapped := PerUserEndpointRateLimit(0, 3, "/x")(d)

	for i := 0; i < 100; i++ {
		req := httptest.NewRequest(http.MethodGet, "/x", nil)
		req.RemoteAddr = "9.9.9.9:1234"
		wrapped.ServeHTTP(httptest.NewRecorder(), req)
	}
	if d.hits != 100 {
		t.Errorf("hits = %d, want 100 (limiter must be a no-op)", d.hits)
	}
}

// TestPerUserEndpointRateLimit_SeparateBucketsPerEndpoint — two endpoints
// using the same limiter spec must NOT share a bucket. We exhaust endpoint
// A and then confirm endpoint B still responds 200.
func TestPerUserEndpointRateLimit_SeparateBucketsPerEndpoint(t *testing.T) {
	dA := &dummyHandler{}
	dB := &dummyHandler{}
	wrapA := PerUserEndpointRateLimit(1, 1, "A")(dA)
	wrapB := PerUserEndpointRateLimit(1, 1, "B")(dB)

	// Burn endpoint A's budget.
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/a", nil)
		req.RemoteAddr = "1.1.1.1:1"
		wrapA.ServeHTTP(httptest.NewRecorder(), req)
	}
	// Endpoint B still fresh.
	req := httptest.NewRequest(http.MethodGet, "/b", nil)
	req.RemoteAddr = "1.1.1.1:1"
	rec := httptest.NewRecorder()
	wrapB.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Errorf("endpoint B code = %d, want 200 — buckets bled across endpoints", rec.Code)
	}
}
