package middleware

import (
	"context"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/sahamscreen/server/config"
)

type contextKey string

const UserContextKey = contextKey("user")

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		bearerToken := strings.Split(authHeader, " ")
		if len(bearerToken) != 2 {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		tokenString := bearerToken[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(config.AppConfig.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		} else {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
	})
}

func CorsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedOrigins := strings.Split(config.AppConfig.AllowedOrigins, ",")
		
		allowed := false
		if config.AppConfig.AllowedOrigins == "*" {
			allowed = true
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else {
			for _, o := range allowedOrigins {
				// Trim whitespace so a comma-separated list with spaces
				// (e.g. "http://a, http://b") still matches against the
				// browser's Origin header which never has surrounding
				// whitespace.
				if strings.TrimSpace(o) == origin {
					allowed = true
					w.Header().Set("Access-Control-Allow-Origin", origin)
					break
				}
			}
		}

		if allowed {
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

var (
	clients      = make(map[string]*client)
	mu           sync.Mutex
	cleanupOnce  sync.Once
)

type client struct {
	lastSeen time.Time
	tokens   int
}

// startRateLimitCleanup launches the stale-bucket sweeper exactly once for the
// life of the process. gorilla/mux invokes middleware constructors per request
// in some setups, so a per-call `go func() { for { ... } }` would leak a
// goroutine on every HTTP request.
func startRateLimitCleanup() {
	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			for ip, c := range clients {
				if time.Since(c.lastSeen) > 3*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()
}

// clientIP extracts the bare IP from r.RemoteAddr, handling IPv6 addresses
// (which take the form `[::1]:54321`) correctly. A naive
// strings.Split(r.RemoteAddr, ":")[0] would map every IPv6 client to the
// shared bucket keyed by "[".
func clientIP(r *http.Request) string {
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil || ip == "" {
		return r.RemoteAddr
	}
	return ip
}

// RateLimitMiddleware implements a simple token bucket per IP
func RateLimitMiddleware(next http.Handler) http.Handler {
	// 5 requests per second, max burst 20
	const rateLimit = 5
	const burstLimit = 20

	cleanupOnce.Do(startRateLimitCleanup)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		// For proxies, might want to check X-Forwarded-For

		mu.Lock()
		if _, found := clients[ip]; !found {
			clients[ip] = &client{lastSeen: time.Now(), tokens: burstLimit}
		}

		c := clients[ip]
		now := time.Now()
		elapsed := now.Sub(c.lastSeen).Seconds()
		
		// Replenish tokens
		c.tokens += int(elapsed * rateLimit)
		if c.tokens > burstLimit {
			c.tokens = burstLimit
		}

		if c.tokens > 0 {
			c.tokens--
			c.lastSeen = now
			mu.Unlock()
			next.ServeHTTP(w, r)
		} else {
			c.lastSeen = now
			mu.Unlock()
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}
	})
}


// ---------------------------------------------------------------------------
// Per-user, per-endpoint rate limiter — Sprint 7 addition.
//
// The global RateLimitMiddleware above caps *per-IP* request rate so a single
// abusive host cannot DoS the whole API. That is not enough for
// expensive-per-call endpoints like /api/ai/* where the cost is denominated
// in LLM tokens rather than CPU cycles: different authenticated users behind
// the same NAT'd WiFi would share one bucket, and a logged-in user could
// burn another user's quota.
//
// PerUserEndpointRateLimit keys the bucket by (user-id, route-template) so
// each user gets their own allowance on each protected endpoint, while
// unauthenticated traffic falls back to IP (same key space as the global
// limiter, just at a different layer).
//
// Parameters are explicit so callers can dial the limiter per route without
// inventing new env vars: /api/ai/commentary might allow 20/min, while
// /api/ai/daily-report only allows 2/min.
// ---------------------------------------------------------------------------

type userBucket struct {
	tokens   float64
	lastSeen time.Time
}

var (
	userBuckets   = make(map[string]*userBucket)
	userBucketsMu sync.Mutex
)

// PerUserEndpointRateLimit returns a middleware that enforces a token-bucket
// rate limit keyed by (user-id, endpoint-name).
//
//	perMinute — steady-state rate in requests per minute.
//	burst     — maximum burst size (bucket capacity).
//	endpoint  — stable identifier mixed into the bucket key; use the route
//	            template (e.g. "/api/ai/commentary") so two endpoints with
//	            the same limit do not share a bucket.
//
// If perMinute or burst is <=0 the middleware is a no-op, which makes it
// safe to wire everything in the router and control the limits from env.
func PerUserEndpointRateLimit(perMinute, burst int, endpoint string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if perMinute <= 0 || burst <= 0 {
			return next
		}
		refillPerSec := float64(perMinute) / 60.0
		capacity := float64(burst)

		userBucketsCleanupOnce.Do(startUserBucketsCleanup)

		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := endpoint + "|" + rateLimitSubject(r)

			userBucketsMu.Lock()
			now := time.Now()
			b, ok := userBuckets[key]
			if !ok {
				b = &userBucket{tokens: capacity, lastSeen: now}
				userBuckets[key] = b
			} else {
				elapsed := now.Sub(b.lastSeen).Seconds()
				b.tokens += elapsed * refillPerSec
				if b.tokens > capacity {
					b.tokens = capacity
				}
				b.lastSeen = now
			}

			if b.tokens < 1 {
				userBucketsMu.Unlock()
				w.Header().Set("Retry-After", "1")
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			b.tokens--
			userBucketsMu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}

// rateLimitSubject returns the identity the limiter keys on: the JWT subject
// when the request is authenticated, otherwise the client IP. We read the
// claims injected by AuthMiddleware rather than re-parsing the token so the
// limiter costs nothing when the caller is already authenticated.
func rateLimitSubject(r *http.Request) string {
	if claims, ok := r.Context().Value(UserContextKey).(jwt.MapClaims); ok {
		if sub, ok := claims["sub"].(string); ok && sub != "" {
			return "u:" + sub
		}
	}
	return "ip:" + clientIP(r)
}

var userBucketsCleanupOnce sync.Once

func startUserBucketsCleanup() {
	go func() {
		t := time.NewTicker(2 * time.Minute)
		defer t.Stop()
		for range t.C {
			cutoff := time.Now().Add(-5 * time.Minute)
			userBucketsMu.Lock()
			for k, b := range userBuckets {
				if b.lastSeen.Before(cutoff) {
					delete(userBuckets, k)
				}
			}
			userBucketsMu.Unlock()
		}
	}()
}
