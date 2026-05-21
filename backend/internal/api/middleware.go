package api

import (
	"context"
	"net/http"
	"time"
)

// DefaultRequestTimeout caps how long a single HTTP request may run. The
// timeout is attached to r.Context() and threaded through the store, so
// a slow query is cancelled at this deadline even if the client stays
// connected — preventing a slow-query DoS from holding a DB connection
// indefinitely.
const DefaultRequestTimeout = 15 * time.Second

// WithRequestTimeout wraps next so each request's context expires after
// timeout. WebSocket upgrades skip this wrapper at the call site since
// they're long-lived and manage their own per-message timeouts.
func WithRequestTimeout(timeout time.Duration, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// WithCORS returns a handler that echoes the request Origin only when
// it appears in the allowlist. Anything else is silently passed through
// without CORS headers, so the browser blocks it. Credentials are
// allowed for permitted origins so the session cookie rides along.
func WithCORS(allowed []string, next http.Handler) http.Handler {
	set := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		set[o] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, ok := set[origin]; ok && origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
