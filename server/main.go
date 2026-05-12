package main

import (
	"encoding/json"
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

	// Health check — enriched with Sprint 7 counters so ops can see Kafka
	// ingest + Watchlist V2 traffic without adding a metrics server.
	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		body := map[string]interface{}{
			"status":    "ok",
			"service":   "SahamScreen API",
			"kafka":     kafka.ConsumerCounters(),
			"watchlist": handlers.WatchlistCounters(),
		}
		_ = json.NewEncoder(w).Encode(body)
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
	r.HandleFunc("/api/market/bandar", handlers.GetBandarFlow).Methods("GET")
	r.HandleFunc("/api/bandar/batch", handlers.GetBandarFlowBatch).Methods("GET")

	// Screener routes — static path BEFORE the parameterized one so
	// gorilla/mux doesn't match /api/screener/stats as {strategy}=stats.
	r.HandleFunc("/api/screener/stats", handlers.GetScreenerStats).Methods("GET")
	r.HandleFunc("/api/screener/{strategy}", handlers.GetScreenerResults).Methods("GET")

	// News routes (public)
	r.HandleFunc("/api/news", handlers.GetNews).Methods("GET")
	r.HandleFunc("/api/news/featured", handlers.GetFeaturedNews).Methods("GET")
	r.HandleFunc("/api/news/health", handlers.NewsHealth).Methods("GET")

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
	protected.HandleFunc("/watchlist", handlers.UpdateWatchlistSellPrice).Methods("PATCH", "OPTIONS")
	protected.HandleFunc("/watchlist", handlers.RemoveFromWatchlist).Methods("DELETE", "OPTIONS")

	// Alerts
	protected.HandleFunc("/alerts", handlers.GetAlerts).Methods("GET")
	protected.HandleFunc("/alerts", handlers.CreateAlert).Methods("POST", "OPTIONS")
	protected.HandleFunc("/alerts", handlers.DeleteAlert).Methods("DELETE", "OPTIONS")

	// Settings
	protected.HandleFunc("/settings", handlers.GetSettings).Methods("GET")
	protected.HandleFunc("/settings", handlers.UpdateSettings).Methods("PUT", "OPTIONS")

	// AI endpoints. Split into separate rate-limit buckets so commentary
	// heavy-use (screener tables poll this on every row hover) cannot
	// exhaust the daily-report budget (fires once per day from the
	// schedule worker + occasional manual refresh).
	//
	// /ai/status is intentionally NOT rate-limited — it is a cheap
	// feature-detection probe the frontend calls on every page load to
	// decide whether to render AI affordances. Wrapping it in a limiter
	// would cause 429s on normal navigation.
	aiCommentaryLimit := middleware.PerUserEndpointRateLimit(
		config.AppConfig.AIRateLimitPerMin,
		config.AppConfig.AIRateLimitBurst,
		"ai-commentary",
	)
	aiAnalysisLimit := middleware.PerUserEndpointRateLimit(
		config.AppConfig.AIRateLimitPerMin/2, // half the commentary budget
		config.AppConfig.AIRateLimitBurst,
		"ai-analysis",
	)
	aiDailyReportLimit := middleware.PerUserEndpointRateLimit(
		5, // very low — report is generated once/day, manual refresh is rare
		2,
		"ai-daily-report",
	)
	protected.HandleFunc("/ai/status", handlers.GetAIStatus).Methods("GET")
	protected.Handle("/ai/commentary", aiCommentaryLimit(http.HandlerFunc(handlers.GetAICommentary))).Methods("GET")
	protected.Handle("/ai/analysis", aiAnalysisLimit(http.HandlerFunc(handlers.GetAIAnalysis))).Methods("GET")
	protected.Handle("/ai/daily-report", aiDailyReportLimit(http.HandlerFunc(handlers.GetAIDailyReport))).Methods("GET")

	// WebSocket (mounted on root router, no auth — same as before)
	r.HandleFunc("/ws/stream", ws.ServeWs)

	go ws.AppHub.Run()
	kafka.StartConsumers()
	workers.StartAlertWorker()
	workers.StartWatchlistTracker()
	workers.StartScheduleWorker()

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
