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
	PostgresURL    string
	GoogleClientID string
	// CookieSecure turns on the Secure flag and the __Host- prefix on
	// the session cookie. Set COOKIE_SECURE=true in any environment
	// behind TLS; leave unset for local HTTP development.
	CookieSecure bool
	// HintCookieDomain is the Domain attribute applied to the non-secret
	// session-hint cookie so the SPA can read it across sibling
	// subdomains (e.g. "chessrepeat.com" when the SPA lives at
	// chessrepeat.com and the API at api.chessrepeat.com). Leave unset
	// in local dev where SPA and API share the same host.
	HintCookieDomain string
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
		ListenAddr:       getEnv("LISTEN_ADDR", ":8080"),
		AllowedOrigins:   splitAndTrim(getEnv("ALLOWED_ORIGINS", "http://localhost:5173")),
		PostgresURL:      getEnv("POSTGRES_URL", "postgres://localhost:5432/chessrepeat?sslmode=disable"),
		GoogleClientID:   os.Getenv("GOOGLE_CLIENT_ID"),
		CookieSecure:     strings.EqualFold(os.Getenv("COOKIE_SECURE"), "true"),
		HintCookieDomain: strings.TrimSpace(os.Getenv("HINT_COOKIE_DOMAIN")),
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
