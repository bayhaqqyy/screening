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
