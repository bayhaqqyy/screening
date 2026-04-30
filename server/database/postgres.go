package database

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/lib/pq"
	"github.com/sahamscreen/server/config"
)

var DB *sql.DB

func ConnectDB() {
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		config.AppConfig.DBHost, config.AppConfig.DBPort,
		config.AppConfig.DBUser, config.AppConfig.DBPassword,
		config.AppConfig.DBName)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	DB = db
	log.Println("Database connection established")
}
