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

	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok", "service": "SahamScreen API"}`))
	}).Methods("GET")

	r.HandleFunc("/api/auth/login", handlers.Login).Methods("POST")
	
	// Add other routes here
	r.HandleFunc("/ws/stream", ws.ServeWs)

	go ws.AppHub.Run()
	kafka.StartConsumers()

	log.Printf("Server starting on port %s...", config.AppConfig.Port)
	if err := http.ListenAndServe(":"+config.AppConfig.Port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
