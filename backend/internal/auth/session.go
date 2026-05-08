package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/http"

	"chessrepeat/internal/store"
)

// SessionCookieName is the HTTP-only cookie that carries the opaque
// session id on every request from the browser. The name is rewritten
// at startup by Init: in secure mode it gains the `__Host-` prefix,
// which forbids a Domain attribute, requires Path=/, and refuses to be
// set over plaintext — three properties the browser then enforces.
var SessionCookieName = "chessrepeat_session"

// SessionHintCookieName is a non-HttpOnly companion cookie so the
// frontend can cheaply tell whether a session exists without probing
// /me. It carries no secret — just a flag — so exposing it to JS is
// safe. Name is *not* prefixed in secure mode because the SPA reads it
// by name (frontend/src/hooks/useStartup.ts).
const SessionHintCookieName = "chessrepeat_has_session"

// secureCookies toggles the Secure flag on every cookie we set, plus
// the __Host- prefix on SessionCookieName. Configured at startup via
// Init from the COOKIE_SECURE env var; defaults to false so localhost
// HTTP development still works.
var secureCookies = false

// Init wires deployment-time cookie settings. Call once at startup
// (before any handler runs) with secure=true in any environment that
// terminates TLS — the Secure flag prevents the browser from ever
// sending the cookie over plaintext, and the __Host- prefix makes
// that guarantee browser-enforced.
func Init(secure bool) {
	secureCookies = secure
	if secure {
		SessionCookieName = "__Host-chessrepeat_session"
	}
}

// NewSessionID returns a cryptographically random opaque session id.
func NewSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// CreateSession mints a session id and persists it.
func CreateSession(ctx context.Context, db store.Repo, userID string) (store.Session, error) {
	id, err := NewSessionID()
	if err != nil {
		return store.Session{}, err
	}
	return db.CreateSession(ctx, id, userID)
}

// SetSessionCookies attaches both cookies to the response. The HTTP-only
// cookie is the truth; the hint cookie lets the SPA branch on
// "logged-in?" without a round-trip.
func SetSessionCookies(w http.ResponseWriter, sess store.Session) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    sess.SessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		Expires:  sess.ExpiresAt,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     SessionHintCookieName,
		Value:    "1",
		Path:     "/",
		HttpOnly: false,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		Expires:  sess.ExpiresAt,
	})
}

// ClearSessionCookies expires both cookies immediately on logout.
func ClearSessionCookies(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     SessionHintCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: false,
		Secure:   secureCookies,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

// RequireSession resolves the session cookie and returns the session
// doc, or writes a 401 and returns ok=false. Small helper to keep the
// HTTP handlers from repeating the same cookie-parse boilerplate.
func RequireSession(db store.Repo, w http.ResponseWriter, r *http.Request) (*store.Session, bool) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return nil, false
	}
	sess, err := db.FetchSession(r.Context(), cookie.Value)
	if err != nil || sess == nil {
		w.WriteHeader(http.StatusUnauthorized)
		return nil, false
	}
	return sess, true
}

