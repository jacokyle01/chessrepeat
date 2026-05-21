package main

import (
	"log"
	"net/http"
	"net/url"
	"strings"

	"chessrepeat/internal/api"
	"chessrepeat/internal/auth"
	"chessrepeat/internal/config"
	"chessrepeat/internal/store"
	"chessrepeat/internal/ws"
)

func main() {
	log.Println("starting server...")

	cfg := config.Load()
	auth.Init(cfg.CookieSecure, cfg.HintCookieDomain)

	db := store.Connect(cfg.PostgresURL)
	wsServer := ws.NewServer(db, wsOriginPatterns(cfg.AllowedOrigins))

	// httpMux carries every short-lived HTTP route. It gets a per-request
	// timeout so a slow query can't pin a DB connection.
	httpMux := http.NewServeMux()
	api.Register(httpMux, db, cfg.GoogleClientID)
	// Chapter creation is an HTTP POST (the tree exceeds the WS frame
	// cap); on success the ws server nudges the owner's room to resync.
	api.RegisterChapterRoute(httpMux, db, wsServer)

	// rootMux dispatches WS upgrades directly (long-lived, no timeout)
	// and everything else through the timeout wrapper.
	rootMux := http.NewServeMux()
	rootMux.HandleFunc("/subscribe/{username}", wsServer.SubscribeHandler)
	rootMux.Handle("/", api.WithRequestTimeout(api.DefaultRequestTimeout, httpMux))

	log.Printf("server ready on %s (origins: %s)", cfg.ListenAddr, strings.Join(cfg.AllowedOrigins, ","))
	log.Fatal(http.ListenAndServe(cfg.ListenAddr, api.WithCORS(cfg.AllowedOrigins, rootMux)))
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
