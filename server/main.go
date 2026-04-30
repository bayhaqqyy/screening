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
	"github.com/sahamscreen/server/ws"
)

func main() {
	config.LoadConfig()
	database.ConnectDB()

	r := mux.NewRouter()
	r.Use(middleware.CorsMiddleware)

	// Health check
	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok", "service": "SahamScreen API"}`))
	}).Methods("GET")

	// Auth routes (public)
	r.HandleFunc("/api/auth/login", handlers.Login).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/register", handlers.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/profile", handlers.UpdateProfile).Methods("PUT", "OPTIONS")

	// Market data routes (public)
	r.HandleFunc("/api/market/overview", handlers.GetMarketOverview).Methods("GET")
	r.HandleFunc("/api/market/top-movers", handlers.GetTopMovers).Methods("GET")
	r.HandleFunc("/api/market/sectors", handlers.GetSectors).Methods("GET")
	r.HandleFunc("/api/market/status", handlers.GetMarketStatus).Methods("GET")

	// Screener routes
	r.HandleFunc("/api/screener/{strategy}", handlers.GetScreenerResults).Methods("GET")

	// News routes
	r.HandleFunc("/api/news", handlers.GetNews).Methods("GET")
	r.HandleFunc("/api/news/featured", handlers.GetFeaturedNews).Methods("GET")

	// Search routes
	r.HandleFunc("/api/search", handlers.SearchStocks).Methods("GET")
	r.HandleFunc("/api/stock", handlers.GetStockDetail).Methods("GET")

	// Watchlist routes (auth required)
	r.HandleFunc("/api/watchlist", handlers.GetWatchlist).Methods("GET")
	r.HandleFunc("/api/watchlist", handlers.AddToWatchlist).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/watchlist", handlers.RemoveFromWatchlist).Methods("DELETE", "OPTIONS")

	// Alerts routes (auth required)
	r.HandleFunc("/api/alerts", handlers.GetAlerts).Methods("GET")
	r.HandleFunc("/api/alerts", handlers.CreateAlert).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/alerts", handlers.DeleteAlert).Methods("DELETE", "OPTIONS")

	// Settings routes (auth required)
	r.HandleFunc("/api/settings", handlers.GetSettings).Methods("GET")
	r.HandleFunc("/api/settings", handlers.UpdateSettings).Methods("PUT", "OPTIONS")

	// Events
	r.HandleFunc("/api/events", handlers.GetEvents).Methods("GET")

	// WebSocket
	r.HandleFunc("/ws/stream", ws.ServeWs)

	go ws.AppHub.Run()
	kafka.StartConsumers()

	log.Printf("Server starting on port %s...", config.AppConfig.Port)
	if err := http.ListenAndServe(":"+config.AppConfig.Port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
