package main

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"chessrepeat/internal/api"
	"chessrepeat/internal/config"
	"chessrepeat/internal/store"
	"chessrepeat/internal/ws"
)

func main() {
	log.Println("starting server...")

	cfg := config.Load()

	db := store.Connect(cfg.MongoURI, cfg.MongoDB)
	wsServer := ws.NewServer(db, wsOriginPatterns(cfg.AllowedOrigins))

	mux := http.NewServeMux()
	api.Register(mux, db, cfg.GoogleClientID)
	mux.HandleFunc("/subscribe/{username}", wsServer.SubscribeHandler)

	log.Printf("server ready on %s (origins: %s)", cfg.ListenAddr, strings.Join(cfg.AllowedOrigins, ","))
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, api.WithCORS(cfg.AllowedOrigins, mux)))
}

// wsOriginPatterns converts the CORS origin URLs ("http://localhost:5173")
// into the host[:port] patterns coder/websocket expects ("localhost:5173").
// Anything that fails to parse is passed through unchanged so a raw host
// pattern in env still works.
func wsOriginPatterns(origins []string) []string {
	out := make([]string, 0, len(origins))
	for _, o := range origins {
		if u, err := url.Parse(o); err == nil && u.Host != "" {
			out = append(out, u.Host)
			continue
		}
		out = append(out, o)
	}
	return out
}
