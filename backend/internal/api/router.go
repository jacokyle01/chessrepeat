package api

import (
	"net/http"

	"chessrepeat/internal/ratelimit"
	"chessrepeat/internal/store"
)

// Limits caps the burst (capacity) and steady-state rate (per second)
// for endpoints reachable by unauthenticated or low-cost-to-call paths.
// Anything that does network I/O on Google's infra (login) or that
// could be used to enumerate users (username/check, add collaborator)
// gets a dedicated bucket so traffic on one can't drain another.
//
// Numbers are conservative: a normal user fits well under the steady
// rate, but an enumeration script gets pinned to the refill rate.
type Limits struct {
	// Login: 30/min sustained, burst 10. Each call does a Google JWKS
	// verification and a user lookup, so we'd rather keep the budget low.
	Login *ratelimit.Limiter
	// Username availability check: fires per-keystroke from the signup
	// form, so the burst is generous, but the sustained rate caps
	// enumeration to ~2/sec per IP.
	UsernameCheck *ratelimit.Limiter
	// Collaborator add: lookup-by-username followed by an insert. Modest
	// budget; legit users add a few collaborators a day.
	AddCollaborator *ratelimit.Limiter
}

// DefaultLimits returns production limits sized for a single-VPS deploy.
func DefaultLimits() Limits {
	return Limits{
		Login:           ratelimit.New(10, 30.0/60.0),
		UsernameCheck:   ratelimit.New(20, 2.0),
		AddCollaborator: ratelimit.New(10, 30.0/60.0),
	}
}

// Register attaches every HTTP handler to the given mux. The mux still
// owns CORS — wrap the result in WithCORS at the call site.
func Register(mux *http.ServeMux, db store.Repo, googleClientID string) {
	RegisterWithLimits(mux, db, googleClientID, DefaultLimits())
}

// RegisterWithLimits is the test seam: callers can inject smaller
// limiters to exercise the 429 path without waiting on real-time refill.
func RegisterWithLimits(mux *http.ServeMux, db store.Repo, googleClientID string, limits Limits) {
	mux.HandleFunc("GET /repertoire", GetRepertoire(db))
	mux.HandleFunc("/login", limits.Login.HandlerFunc(Login(db, googleClientID)))
	mux.HandleFunc("/logout", Logout(db))
	mux.HandleFunc("GET /username/check", limits.UsernameCheck.HandlerFunc(CheckUsername(db)))

	mux.HandleFunc("GET /collaborators/outgoing", GetOutgoingCollaborators(db))
	mux.HandleFunc("GET /collaborators/incoming", GetIncomingCollaborators(db))
	mux.HandleFunc("POST /collaborators", limits.AddCollaborator.HandlerFunc(AddCollaborator(db)))
	mux.HandleFunc("DELETE /collaborators/{username}", RemoveCollaborator(db))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}
