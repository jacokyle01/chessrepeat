package auth

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"

	"chessrepeat/internal/store"
)

// SessionCookieName is the HTTP-only cookie that carries the opaque
// session id on every request from the browser.
const SessionCookieName = "chessrepeat_session"

// SessionHintCookieName is a non-HttpOnly companion cookie so the
// frontend can cheaply tell whether a session exists without probing
// /me. It carries no secret — just a flag — so exposing it to JS is safe.
const SessionHintCookieName = "chessrepeat_has_session"

// NewSessionID returns a cryptographically random opaque session id.
func NewSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// CreateSession mints a session id and persists it.
func CreateSession(db *store.DB, userID string) (store.Session, error) {
	id, err := NewSessionID()
	if err != nil {
		return store.Session{}, err
	}
	return db.CreateSession(id, userID)
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
		SameSite: http.SameSiteLaxMode,
		Expires:  sess.ExpiresAt,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     SessionHintCookieName,
		Value:    "1",
		Path:     "/",
		HttpOnly: false,
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
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     SessionHintCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: false,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}

// RequireSession resolves the session cookie and returns the session
// doc, or writes a 401 and returns ok=false. Small helper to keep the
// HTTP handlers from repeating the same cookie-parse boilerplate.
func RequireSession(db *store.DB, w http.ResponseWriter, r *http.Request) (*store.Session, bool) {
	cookie, err := r.Cookie(SessionCookieName)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return nil, false
	}
	sess, err := db.FetchSession(cookie.Value)
	if err != nil || sess == nil {
		w.WriteHeader(http.StatusUnauthorized)
		return nil, false
	}
	return sess, true
}

