package config

import (
	"log"
	"os"
	"strconv"

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
	// ScheduleTimesOverride — optional comma-separated "HH:MM:strategy"
	// triples that bypass the cron schedule in workers/schedule_worker.go.
	// Primarily used by tests/QA to trigger a refresh at a non-production
	// wall clock (e.g. "12:00:swing,13:30:bsjp"). Empty disables override.
	ScheduleTimesOverride string

	// --- AI: Groq free-tier ------------------------------------------------
	// Provider decision (locked): Groq, free-tier OpenAI-compatible endpoint.
	// Two models are addressed separately so the instant vs deep use cases
	// can pick the right latency/size trade-off without a code change:
	//   GroqFastModel — llama-3.1-8b-instant — screener commentary, news
	//                   sentiment. <2s latency target.
	//   GroqProModel  — llama-3.3-70b-versatile — deep trade analysis and
	//                   the daily market report. <10s latency target.
	//
	// AIEnabled stays as the master feature gate. When false the handlers
	// reply 503 and the client never dials out, which is the right default
	// for an environment that has not yet populated GROQ_API_KEY.
	AIEnabled         bool
	GroqAPIKey        string
	GroqAPIURL        string
	GroqFastModel     string
	GroqProModel      string
	GroqTimeoutMS     int
	GroqCacheTTLSec   int
	AIRateLimitPerMin int
	AIRateLimitBurst  int
}

var AppConfig Config

func LoadConfig() {
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, relying on environment variables")
	}

	AppConfig = Config{
		Port:                  getEnv("PORT", "8080"),
		DBHost:                getEnv("DB_HOST", "localhost"),
		DBPort:                getEnv("DB_PORT", "5432"),
		DBUser:                getEnv("DB_USER", "sahamscreen"),
		DBPassword:            getEnv("DB_PASSWORD", "sahamscreen_dev"),
		DBName:                getEnv("DB_NAME", "sahamscreen"),
		JWTSecret:             getEnv("JWT_SECRET", "super-secret"),
		KafkaBroker:           getEnv("KAFKA_BROKER", "localhost:9092"),
		TVWebhookPathToken:    getEnv("TV_WEBHOOK_PATH_TOKEN", ""),
		TVWebhookSecret:       getEnv("TV_WEBHOOK_SECRET", ""),
		AllowedOrigins:        getEnv("ALLOWED_ORIGINS", "http://localhost:5173"),
		ScheduleTimesOverride: getEnv("SCHEDULE_TIMES_OVERRIDE", ""),

		AIEnabled:         getEnvBool("AI_ENABLED", false),
		GroqAPIKey:        getEnv("GROQ_API_KEY", ""),
		GroqAPIURL:        getEnv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions"),
		// Default models chosen from the Groq free-tier quota table:
		//   FAST — llama-3.1-8b-instant: 14.4K req/day, 500K tok/day. Best
		//          headroom for per-signal screener commentary + news
		//          sentiment classification.
		//   PRO  — meta-llama/llama-4-scout-17b-16e-instruct: 1K req/day,
		//          500K tok/day (5× the token budget of llama-3.3-70b),
		//          newer training, MoE for lower latency. Good fit for
		//          deep trade analysis + daily market report.
		// Override either via env if a different free model is a better
		// fit for the traffic shape — e.g. qwen/qwen3-32b (60 RPM = 2×
		// the rate limit) for burst-heavy days.
		GroqFastModel:     getEnv("GROQ_FAST_MODEL", "llama-3.1-8b-instant"),
		GroqProModel:      getEnv("GROQ_PRO_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
		GroqTimeoutMS:     getEnvInt("GROQ_TIMEOUT_MS", 8000),
		GroqCacheTTLSec:   getEnvInt("GROQ_CACHE_TTL_SECONDS", 120),
		AIRateLimitPerMin: getEnvInt("AI_RATE_LIMIT_PER_MIN", 20),
		AIRateLimitBurst:  getEnvInt("AI_RATE_LIMIT_BURST", 5),
	}
}

func getEnv(key, defaultVal string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultVal
}

// getEnvInt reads an int env var, returning the fallback on parse failure so
// a stray whitespace or empty value cannot crash boot.
func getEnvInt(key string, defaultVal int) int {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		log.Printf("config: invalid int for %s (%q), using default %d", key, raw, defaultVal)
		return defaultVal
	}
	return n
}

// getEnvBool accepts the usual true/false/1/0/yes/no spellings so ops can use
// whichever idiom their deploy tooling prefers.
func getEnvBool(key string, defaultVal bool) bool {
	raw, ok := os.LookupEnv(key)
	if !ok || raw == "" {
		return defaultVal
	}
	b, err := strconv.ParseBool(raw)
	if err != nil {
		log.Printf("config: invalid bool for %s (%q), using default %v", key, raw, defaultVal)
		return defaultVal
	}
	return b
}
