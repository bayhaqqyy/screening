package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DBHost             string
	DBPort             string
	DBUser             string
	DBPassword         string
	DBName             string
	JWTSecret          string
	KafkaBroker        string
	TVWebhookPathToken string
	TVWebhookSecret    string
	AllowedOrigins     string
}

var AppConfig Config

func LoadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	AppConfig = Config{
		Port:               getEnv("PORT", "8080"),
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnv("DB_PORT", "5432"),
		DBUser:             getEnv("DB_USER", "sahamscreen"),
		DBPassword:         getEnv("DB_PASSWORD", "sahamscreen_dev"),
		DBName:             getEnv("DB_NAME", "sahamscreen"),
		JWTSecret:          getEnv("JWT_SECRET", "super-secret"),
		KafkaBroker:        getEnv("KAFKA_BROKER", "localhost:9092"),
		TVWebhookPathToken: getEnv("TV_WEBHOOK_PATH_TOKEN", ""),
		TVWebhookSecret:    getEnv("TV_WEBHOOK_SECRET", ""),
		AllowedOrigins:     getEnv("ALLOWED_ORIGINS", "http://localhost:5173"),
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}
