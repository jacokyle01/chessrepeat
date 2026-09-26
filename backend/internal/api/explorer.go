package api

import (
	"io"
	"log"
	"net/http"
	"net/url"
	"time"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/store"
)

// explorerClient bounds the server-to-server call so a slow explorer
// can't tie up a request goroutine indefinitely.
var explorerClient = &http.Client{Timeout: 5 * time.Second}

// GetExplorer proxies opening-explorer stats for a position. The browser
// hits this cookie-authenticated endpoint (same session gate as every
// other API route); the backend forwards to the explorer, an internal-
// only service reached over the compose network. Response body is the
// explorer's JSON passed through unchanged.
func GetExplorer(db store.Repo, explorerURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := auth.RequireSession(db, w, r); !ok {
			return
		}
		if explorerURL == "" {
			// Feature disabled (e.g. local dev without the explorer running).
			// Return an empty result rather than an error so the UI just
			// shows "no games" and the browser console stays clean.
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte("null"))
			return
		}

		fen := r.URL.Query().Get("fen")
		if fen == "" {
			http.Error(w, "missing fen", http.StatusBadRequest)
			return
		}

		upstream := explorerURL + "/query?fen=" + url.QueryEscape(fen)
		req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, upstream, nil)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		resp, err := explorerClient.Do(req)
		if err != nil {
			log.Println("explorer query failed:", err)
			http.Error(w, "explorer unavailable", http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(resp.StatusCode)
		io.Copy(w, resp.Body)
	}
}

// RegisterExplorerRoute wires the /explorer proxy. No-op-friendly: when
// the explorer isn't configured the handler returns an empty result.
func RegisterExplorerRoute(mux *http.ServeMux, db store.Repo, explorerURL string) {
	mux.HandleFunc("GET /explorer", GetExplorer(db, explorerURL))
}
