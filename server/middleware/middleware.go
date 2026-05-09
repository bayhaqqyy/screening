package middleware

import (
	"context"
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
				if o == origin {
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
	clients = make(map[string]*client)
	mu      sync.Mutex
)

type client struct {
	lastSeen time.Time
	tokens   int
}

// RateLimitMiddleware implements a simple token bucket per IP
func RateLimitMiddleware(next http.Handler) http.Handler {
	// 5 requests per second, max burst 20
	const rateLimit = 5
	const burstLimit = 20

	// Cleanup stale clients periodically
	go func() {
		for {
			time.Sleep(time.Minute)
			mu.Lock()
			for ip, client := range clients {
				if time.Since(client.lastSeen) > 3*time.Minute {
					delete(clients, ip)
				}
			}
			mu.Unlock()
		}
	}()

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := strings.Split(r.RemoteAddr, ":")[0]
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
