package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds every runtime knob the server reads from the environment.
// Loaded once at startup and passed by value to anything that needs it,
// so handlers don't reach into os.Getenv at request time.
type Config struct {
	ListenAddr     string
	AllowedOrigins []string
	MongoURI       string
	MongoDB        string
	GoogleClientID string
}

// Load reads .env (if present) and resolves every config value, applying
// dev-friendly defaults where it's safe to do so. Required values that
// are missing cause a fatal log.
func Load() Config {
	log.Println("loading .env file...")
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using process environment")
	}

	cfg := Config{
		ListenAddr:     getEnv("LISTEN_ADDR", ":8080"),
		AllowedOrigins: splitAndTrim(getEnv("ALLOWED_ORIGINS", "http://localhost:5173")),
		MongoURI:       getEnv("MONGO_URI", "mongodb://localhost:27017"),
		MongoDB:        getEnv("MONGO_DB", "chessrepeat"),
		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
	}

	if cfg.GoogleClientID == "" {
		log.Fatal("GOOGLE_CLIENT_ID is required")
	}
	if len(cfg.AllowedOrigins) == 0 {
		log.Fatal("ALLOWED_ORIGINS must contain at least one origin")
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitAndTrim(csv string) []string {
	parts := strings.Split(csv, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
