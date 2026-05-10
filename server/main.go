package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/sahamscreen/server/config"
	"github.com/sahamscreen/server/database"
	"github.com/sahamscreen/server/handlers"
	"github.com/sahamscreen/server/kafka"
	"github.com/sahamscreen/server/middleware"
	"github.com/sahamscreen/server/workers"
	"github.com/sahamscreen/server/ws"
)

func main() {
	config.LoadConfig()
	database.ConnectDB()

	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok", "service": "SahamScreen API"}`))
	}).Methods("GET")

	// Auth routes (public)
	r.HandleFunc("/api/auth/login", handlers.Login).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/register", handlers.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/forgot-password", handlers.ForgotPassword).Methods("POST", "OPTIONS")

	// Market data routes (public)
	r.HandleFunc("/api/market/overview", handlers.GetMarketOverview).Methods("GET")
	r.HandleFunc("/api/market/top-movers", handlers.GetTopMovers).Methods("GET")
	r.HandleFunc("/api/market/sectors", handlers.GetSectors).Methods("GET")
	r.HandleFunc("/api/market/status", handlers.GetMarketStatus).Methods("GET")

	// Screener routes — static path BEFORE the parameterized one so
	// gorilla/mux doesn't match /api/screener/stats as {strategy}=stats.
	r.HandleFunc("/api/screener/stats", handlers.GetScreenerStats).Methods("GET")
	r.HandleFunc("/api/screener/{strategy}", handlers.GetScreenerResults).Methods("GET")

	// News routes (public)
	r.HandleFunc("/api/news", handlers.GetNews).Methods("GET")
	r.HandleFunc("/api/news/featured", handlers.GetFeaturedNews).Methods("GET")

	// Search routes (public)
	r.HandleFunc("/api/search", handlers.SearchStocks).Methods("GET")
	r.HandleFunc("/api/stock", handlers.GetStockDetail).Methods("GET")
	r.HandleFunc("/api/stock/chart", handlers.GetStockChart).Methods("GET")

	// Events (public)
	r.HandleFunc("/api/events", handlers.GetEvents).Methods("GET")

	// TradingView webhook (public; auth is path token + optional body secret).
	// Mounted on the root router so it is NOT subject to AuthMiddleware.
	r.HandleFunc("/api/webhooks/health", handlers.WebhookHealth).Methods("GET")
	r.HandleFunc("/api/webhooks/tradingview/{token}", handlers.TradingViewWebhook).Methods("POST")

	// Protected routes (require a valid JWT). Use a subrouter so AuthMiddleware
	// applies uniformly without leaking onto the public routes above.
	protected := r.PathPrefix("/api").Subrouter()
	protected.Use(middleware.AuthMiddleware)

	// Auth (protected)
	protected.HandleFunc("/auth/profile", handlers.UpdateProfile).Methods("PUT", "OPTIONS")
	protected.HandleFunc("/auth/refresh", handlers.RefreshToken).Methods("POST", "OPTIONS")

	// Watchlist
	protected.HandleFunc("/watchlist", handlers.GetWatchlist).Methods("GET")
	protected.HandleFunc("/watchlist", handlers.AddToWatchlist).Methods("POST", "OPTIONS")
	protected.HandleFunc("/watchlist", handlers.RemoveFromWatchlist).Methods("DELETE", "OPTIONS")

	// Alerts
	protected.HandleFunc("/alerts", handlers.GetAlerts).Methods("GET")
	protected.HandleFunc("/alerts", handlers.CreateAlert).Methods("POST", "OPTIONS")
	protected.HandleFunc("/alerts", handlers.DeleteAlert).Methods("DELETE", "OPTIONS")

	// Settings
	protected.HandleFunc("/settings", handlers.GetSettings).Methods("GET")
	protected.HandleFunc("/settings", handlers.UpdateSettings).Methods("PUT", "OPTIONS")

	// WebSocket (mounted on root router, no auth — same as before)
	r.HandleFunc("/ws/stream", ws.ServeWs)

	go ws.AppHub.Run()
	kafka.StartConsumers()
	workers.StartAlertWorker()

	// Wrap the router with global middleware via http.Handler chaining
	// instead of r.Use(). gorilla/mux's r.Use() only fires on routes it
	// can match — when the browser sends a CORS preflight OPTIONS request
	// for a route registered as GET-only (e.g. /api/market/sectors), mux
	// falls through to NotFoundHandler and r.Use'd middleware never runs,
	// so the preflight response has no Access-Control-Allow-Origin header
	// and the browser blocks the subsequent real request entirely. Wrapping
	// at the http.ListenAndServe level fires the middleware on every
	// request, including 404s and arbitrary OPTIONS preflights.
	//
	// Order: outermost is CORS so even a 429 from RateLimit (or a 404 from
	// the router) still carries the CORS headers the browser needs to
	// surface the response to JS.
	var handler http.Handler = r
	handler = middleware.RateLimitMiddleware(handler)
	handler = middleware.CorsMiddleware(handler)

	log.Printf("Server starting on port %s...", config.AppConfig.Port)
	if err := http.ListenAndServe(":"+config.AppConfig.Port, handler); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
