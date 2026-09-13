package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

// idTokenVerifier is the function shape of auth.VerifyFirebaseIDToken.
// Exposed as a package-level var so tests can stub the network round
// trip to Google without rewiring every Login signature.
type idTokenVerifier func(ctx context.Context, token, projectID string) (*auth.FirebaseClaims, error)

var verifyIDToken idTokenVerifier = auth.VerifyFirebaseIDToken

// Login trades a Firebase ID token (from any enabled provider: Google,
// email+password, ...) for a server session, upserting the user row on
// the way. Chapters are created on demand via the WebSocket
// chapter_created event; there is no separate repertoire row.
func Login(db store.Repo, firebaseProjectID string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var body struct {
			IDToken  string `json:"idToken"`
			Username string `json:"username"`
			// Picture is only honoured on first signup; a returning
			// user's stored picture is left alone. Empty falls back to
			// whatever the identity provider supplied (Google's photo).
			Picture string `json:"picture"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IDToken == "" {
			http.Error(w, "missing idToken", http.StatusBadRequest)
			return
		}

		// verify the Firebase ID token: signature, issuer, expiry, audience —
		// we are trading this for a session
		claims, err := verifyIDToken(r.Context(), body.IDToken, firebaseProjectID)
		if err != nil {
			log.Println("firebase id token verification failed:", err)
			http.Error(w, "invalid id token", http.StatusUnauthorized)
			return
		}

		// first-time signups must pick a username. if the user doesn't
		// exist yet and no username came in the request, bail early
		// without writing anything — the frontend will prompt and
		// re-submit with a username.
		existing, err := db.FetchUser(r.Context(), claims.UID)
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
			TokenID: claims.UID,
			Email:   claims.Email,
		}
		if existing != nil {
			user.Username = existing.Username
			user.Picture = existing.Picture
		} else {
			candidate := strings.ToLower(strings.TrimSpace(body.Username))
			if !isValidUsername(candidate) {
				http.Error(w, "invalid username", http.StatusBadRequest)
				return
			}
			taken, err := db.FetchUserByUsername(r.Context(), candidate)
			if err != nil {
				log.Println("username lookup failed:", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			if taken != nil {
				http.Error(w, "username taken", http.StatusConflict)
				return
			}
			user.Username = candidate

			picture := strings.TrimSpace(body.Picture)
			if picture == "" {
				picture = claims.Picture
			}
			if !isValidPictureURL(picture) {
				http.Error(w, "invalid picture", http.StatusBadRequest)
				return
			}
			user.Picture = picture
		}

		if err := db.UpsertUser(r.Context(), user); err != nil {
			log.Println("failed to upsert user:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		sess, err := auth.CreateSession(r.Context(), db, user.TokenID)
		if err != nil {
			log.Println("failed to create session:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		auth.SetSessionCookies(w, sess)

		// mirror GET /repertoire's shape so the client can skip a follow-up
		// round trip: one request hydrates user + chapters + opens session.
		chapters, err := db.FetchChaptersByOwner(r.Context(), user.TokenID)
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

// CheckUsername reports whether a username is available for signup.
// Used by the signup form to show live availability feedback before
// the user submits. Validation rules mirror what we'd enforce on
// upsert: 3–20 chars, [a-z0-9_], lowercased.
func CheckUsername(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("username")))
		w.Header().Set("Content-Type", "application/json")

		if !isValidUsername(username) {
			json.NewEncoder(w).Encode(map[string]any{
				"available": false,
				"reason":    "invalid",
			})
			return
		}
		existing, err := db.FetchUserByUsername(r.Context(), username)
		if err != nil {
			log.Println("username check failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(map[string]any{
			"available": existing == nil,
			"reason": func() string {
				if existing == nil {
					return ""
				}
				return "taken"
			}(),
		})
	}
}

var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

func isValidUsername(u string) bool { return usernameRe.MatchString(u) }

// maxPictureURLLen bounds what we'll store; real avatar URLs are a few
// hundred bytes.
const maxPictureURLLen = 2048

// pictureHosts is where a picture may be served from: Firebase Storage
// (uploads from the signup form) and Google's photo CDN (the picture
// claim on a Google sign-in). Pictures are echoed to collaborators and
// rendered in an <img>, so an arbitrary URL would let a user point
// everyone who views their profile at a host of their choosing.
var pictureHosts = []string{
	"firebasestorage.googleapis.com",
	".firebasestorage.app",
	"storage.googleapis.com",
	".googleusercontent.com",
}

// isValidPictureURL accepts an empty picture (no avatar) or an https
// URL on one of pictureHosts.
func isValidPictureURL(p string) bool {
	if p == "" {
		return true
	}
	if len(p) > maxPictureURLLen {
		return false
	}
	u, err := url.Parse(p)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, h := range pictureHosts {
		if strings.HasPrefix(h, ".") {
			if strings.HasSuffix(host, h) {
				return true
			}
		} else if host == h {
			return true
		}
	}
	return false
}

func Logout(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if cookie, err := r.Cookie(auth.SessionCookieName); err == nil {
			if err := db.DeleteSession(r.Context(), cookie.Value); err != nil {
				log.Println("failed to delete session:", err)
			}
		}
		auth.ClearSessionCookies(w)
		w.WriteHeader(http.StatusOK)
	}
}
