package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/ratelimit"
)

// TestRouter_LoginRateLimited drives the wired router through enough
// /login bursts to exhaust the limiter, then checks the next call gets
// a 429. Without rate limiting an attacker can hammer Google JWKS
// verification at full network speed.
func TestRouter_LoginRateLimited(t *testing.T) {
	fs := newFakeStore()
	// Pre-seed a different user holding "alice" so subsequent attempts
	// still consume a token but resolve to a 409 conflict, proving the
	// 429 isn't shadowed by an incidental success path.
	if err := fs.UpsertUser(context.Background(), domain.User{TokenID: "owner", Username: "alice", Email: "x"}); err != nil {
		t.Fatal(err)
	}
	stubVerifier(t, &auth.GoogleClaims{Sub: "attacker", Email: "e@example.com"}, nil)

	mux := http.NewServeMux()
	limits := Limits{
		Login:           ratelimit.New(2, 0), // burst 2, no refill
		UsernameCheck:   ratelimit.New(1000, 1000),
		AddCollaborator: ratelimit.New(1000, 1000),
	}
	RegisterWithLimits(mux, fs, testGoogleClientID, limits)

	body := `{"idToken":"tok","username":"alice"}`
	send := func() int {
		req := httptest.NewRequest("POST", "/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "10.0.0.99:9999"
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		return rr.Code
	}

	// First two calls land on the handler — both 409 because "alice" is
	// already owned by a different user. Both still consume a token.
	if got := send(); got != http.StatusConflict {
		t.Fatalf("first /login: status = %d, want 409", got)
	}
	if got := send(); got != http.StatusConflict {
		t.Fatalf("second /login: status = %d, want 409", got)
	}
	if got := send(); got != http.StatusTooManyRequests {
		t.Fatalf("third /login: status = %d, want 429", got)
	}
}

// TestRouter_UsernameCheckRateLimited prevents bulk username
// enumeration via the public availability endpoint.
func TestRouter_UsernameCheckRateLimited(t *testing.T) {
	fs := newFakeStore()

	mux := http.NewServeMux()
	limits := Limits{
		Login:           ratelimit.New(1000, 1000),
		UsernameCheck:   ratelimit.New(2, 0),
		AddCollaborator: ratelimit.New(1000, 1000),
	}
	RegisterWithLimits(mux, fs, testGoogleClientID, limits)

	send := func() int {
		req := httptest.NewRequest("GET", "/username/check?username=alice", nil)
		req.RemoteAddr = "10.0.0.42:1234"
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		return rr.Code
	}

	if got := send(); got != http.StatusOK {
		t.Fatalf("first /username/check: status = %d, want 200", got)
	}
	if got := send(); got != http.StatusOK {
		t.Fatalf("second /username/check: status = %d, want 200", got)
	}
	if got := send(); got != http.StatusTooManyRequests {
		t.Fatalf("third /username/check: status = %d, want 429", got)
	}
}

// TestRouter_LoginRateLimitPerIP confirms one IP getting throttled
// doesn't deny a different IP its own budget.
func TestRouter_LoginRateLimitPerIP(t *testing.T) {
	fs := newFakeStore()
	if err := fs.UpsertUser(context.Background(), domain.User{TokenID: "owner", Username: "alice", Email: "x"}); err != nil {
		t.Fatal(err)
	}
	stubVerifier(t, &auth.GoogleClaims{Sub: "attacker", Email: "e@example.com"}, nil)

	mux := http.NewServeMux()
	limits := Limits{
		Login:           ratelimit.New(1, 0),
		UsernameCheck:   ratelimit.New(1000, 1000),
		AddCollaborator: ratelimit.New(1000, 1000),
	}
	RegisterWithLimits(mux, fs, testGoogleClientID, limits)

	body := `{"idToken":"tok","username":"alice"}`
	send := func(remote string) int {
		req := httptest.NewRequest("POST", "/login", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = remote
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		return rr.Code
	}

	if got := send("10.0.0.1:1111"); got != http.StatusConflict {
		t.Fatalf("ip-1 first call: status = %d, want 409", got)
	}
	if got := send("10.0.0.1:1111"); got != http.StatusTooManyRequests {
		t.Fatalf("ip-1 second call: status = %d, want 429", got)
	}
	// Different IP — own budget, expected 409 (username already taken).
	if got := send("10.0.0.2:1111"); got != http.StatusConflict {
		t.Fatalf("ip-2 first call: status = %d, want 409", got)
	}
}
