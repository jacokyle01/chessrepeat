package api

import (
	"encoding/json"
	"log"
	"net/http"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

// Login upserts the user and opens a session. Chapters are created on
// demand via the WebSocket chapter_created event; there is no separate
// repertoire row.
func Login(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var body struct {
			IDToken  string `json:"idToken"`
			Username string `json:"username"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IDToken == "" {
			http.Error(w, "missing idToken", http.StatusBadRequest)
			return
		}

		// verify the Google ID token: signature, issuer, expiry, audience —
		// we are trading this for a session
		claims, err := auth.VerifyGoogleIDToken(r.Context(), body.IDToken)
		if err != nil {
			log.Println("google id token verification failed:", err)
			http.Error(w, "invalid id token", http.StatusUnauthorized)
			return
		}

		// first-time signups must pick a username. if the user doesn't
		// exist yet and no username came in the request, bail early
		// without writing anything — the frontend will prompt and
		// re-submit with a username.
		existing, err := db.FetchUser(claims.Sub)
		if err != nil {
			log.Println("failed to look up user:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if existing == nil && body.Username == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{"needsUsername": true})
			return
		}

		user := domain.User{
			TokenID: claims.Sub,
			Email:   claims.Email,
			Picture: claims.Picture,
		}
		if existing != nil {
			user.Username = existing.Username
		} else {
			user.Username = body.Username
		}

		if err := db.UpsertUser(user); err != nil {
			log.Println("failed to upsert user:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		sess, err := auth.CreateSession(db, user.TokenID)
		if err != nil {
			log.Println("failed to create session:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		auth.SetSessionCookies(w, sess)

		// mirror GET /repertoire's shape so the client can skip a follow-up
		// round trip: one request hydrates user + chapters + opens session.
		chapters, err := db.FetchChaptersByOwner(user.TokenID)
		if err != nil {
			log.Println("failed to fetch chapters:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			User     domain.User                  `json:"user"`
			Chapters []domain.ChapterTreeResponse `json:"chapters"`
		}{User: user, Chapters: chapters})
	}
}

func Logout(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
			if err := db.DeleteSession(cookie.Value); err != nil {
				log.Println("failed to delete session:", err)
			}
		}
		auth.ClearSessionCookies(w)
		w.WriteHeader(http.StatusOK)
	}
}
