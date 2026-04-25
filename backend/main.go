package main

import "net/http"
import "encoding/json"
import "log"

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		// required for the browser to send / receive the session cookie cross-origin
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// sessionCookieName is the name of the HTTP-only cookie that carries the
// opaque session id on every request from the browser.
const sessionCookieName = "chessrepeat_session"

// requireSession resolves the session cookie and returns the session doc,
// or writes a 401 and returns ok=false. Small helper to keep the handlers
// below from repeating the same cookie-parse boilerplate.
func requireSession(db *DB, w http.ResponseWriter, r *http.Request) (*sessionDoc, bool) {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		return nil, false
	}
	sess, err := fetchSession(db, cookie.Value)
	if err != nil || sess == nil {
		w.WriteHeader(http.StatusUnauthorized)
		return nil, false
	}
	return sess, true
}

// sessionHintCookieName is a non-HttpOnly companion cookie so the frontend
// can cheaply tell whether a session exists without probing /me. It carries
// no secret — just a flag — so exposing it to JS is safe.
const sessionHintCookieName = "chessrepeat_has_session"

func main() {
	log.Println("starting server...")

	var db = connectDb()
	// chatserver needs db as parameter since we perform db operations during websocket connections
	cs := newChatServer(db)

	// GET /repertoire returns the caller's own repertoire (resolved from the
	// session cookie). GET /repertoire?owner=<username> returns the named
	// user's repertoire. The response shape is {user, chapters} — each user
	// IS their repertoire, so the owner's profile doubles as repertoire metadata.
	http.HandleFunc("GET /repertoire", func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		sess, err := fetchSession(db, cookie.Value)
		if err != nil {
			log.Println("session lookup failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if sess == nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		var owner *userJson
		if q := r.URL.Query().Get("owner"); q != "" {
			owner, err = fetchUserByUsername(db, q)
		} else {
			owner, err = fetchUser(db, sess.UserID)
		}
		if err != nil {
			log.Println("owner lookup failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if owner == nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		ok, err := canViewRepertoire(db, owner.TokenID, sess.UserID)
		if err != nil {
			log.Println("view auth check failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if !ok {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		chapters, err := fetchChaptersByOwner(db, owner.TokenID)
		if err != nil {
			log.Println("failed to fetch chapters:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		resp := struct {
			User     userJson              `json:"user"`
			Chapters []ChapterTreeResponse `json:"chapters"`
		}{
			User:     *owner,
			Chapters: chapters,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	// upsert user and open a session. Chapters are created on demand via the
	// WebSocket chapter_created event; there is no separate repertoire row.
	http.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
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

		// verify the Google ID token: signature, issuer, expiry, audience
		// we are trading this for a session
		claims, err := verifyGoogleIDToken(r.Context(), body.IDToken)
		if err != nil {
			log.Println("google id token verification failed:", err)
			http.Error(w, "invalid id token", http.StatusUnauthorized)
			return
		}

		// first-time signups must pick a username. if the user doesn't exist
		// yet and no username came in the request, bail early without writing
		// anything — the frontend will prompt and re-submit with a username.
		existing, err := fetchUser(db, claims.Sub)
		if err != nil {
			log.Println("failed to look up user:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		// reject first log-in attempt if username is missing 
		if existing == nil && body.Username == "" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{"needsUsername": true})
			return
		}

		user := userJson{
			TokenID: claims.Sub,
			Email:   claims.Email,
			Picture: claims.Picture,
		}
		if existing != nil {
			user.Username = existing.Username
		} else {
			user.Username = body.Username
		}

		if err := upsertUser(db, user); err != nil {
			log.Println("failed to upsert user:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// establish an authenticated session bound to the verified user
		//TODO what if we already have a session for this user in DB?
		sess, err := createSession(db, user.TokenID)
		if err != nil {
			log.Println("failed to create session:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// set the session as an HTTP-only cookie. the browser will attach this
		// on subsequent fetches and on the WebSocket handshake, letting us
		// identify the user on every request without JS ever touching the id.
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    sess.SessionID,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			Expires:  sess.ExpiresAt,
		})
		http.SetCookie(w, &http.Cookie{
			Name:     sessionHintCookieName,
			Value:    "1",
			Path:     "/",
			HttpOnly: false,
			SameSite: http.SameSiteLaxMode,
			Expires:  sess.ExpiresAt,
		})

		// mirror GET /repertoire's shape so the client can skip a follow-up
		// round trip: one request hydrates user + chapters + opens session.
		chapters, err := fetchChaptersByOwner(db, user.TokenID)
		if err != nil {
			log.Println("failed to fetch chapters:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			User     userJson              `json:"user"`
			Chapters []ChapterTreeResponse `json:"chapters"`
		}{User: user, Chapters: chapters})
	})

	http.HandleFunc("/logout", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		cookie, err := r.Cookie(sessionCookieName)
		if err == nil {
			if err := deleteSession(db, cookie.Value); err != nil {
				log.Println("failed to delete session:", err)
			}
		}
		// expire the cookie immediately
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
		})
		http.SetCookie(w, &http.Cookie{
			Name:     sessionHintCookieName,
			Value:    "",
			Path:     "/",
			HttpOnly: false,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
		})
		w.WriteHeader(http.StatusOK)
	})

	http.HandleFunc("/chapter/{id}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		id := r.PathValue("id")
		if id == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		tree, err := readChapterAsTree(db, id)
		if err != nil {
			log.Println("failed to read chapter:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if tree == nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(tree)
	})

	// GET  /collaborators/outgoing → { collaborators: [...] } — users I've added
	// GET  /collaborators/incoming → { collaborators: [...] } — users who've added me
	// POST /collaborators { username } → add user to my repertoire
	// DELETE /collaborators/{username}  → remove user from my repertoire
	http.HandleFunc("GET /collaborators/outgoing", func(w http.ResponseWriter, r *http.Request) {
		sess, ok := requireSession(db, w, r)
		if !ok {
			return
		}
		collabs, err := fetchOutgoingCollaborators(db, sess.UserID)
		if err != nil {
			log.Println("failed to fetch outgoing collaborators:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"collaborators": collabs})
	})

	http.HandleFunc("GET /collaborators/incoming", func(w http.ResponseWriter, r *http.Request) {
		sess, ok := requireSession(db, w, r)
		if !ok {
			return
		}
		collabs, err := fetchIncomingCollaborators(db, sess.UserID)
		if err != nil {
			log.Println("failed to fetch incoming collaborators:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"collaborators": collabs})
	})

	http.HandleFunc("POST /collaborators", func(w http.ResponseWriter, r *http.Request) {
		sess, ok := requireSession(db, w, r)
		if !ok {
			return
		}
		var body struct {
			Username string `json:"username"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" {
			http.Error(w, "missing username", http.StatusBadRequest)
			return
		}
		target, err := fetchUserByUsername(db, body.Username)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if target == nil {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		if target.TokenID == sess.UserID {
			http.Error(w, "cannot add yourself", http.StatusBadRequest)
			return
		}
		if err := addCollaborator(db, sess.UserID, target.TokenID); err != nil {
			log.Println("failed to add collaborator:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(CollaboratorView{
			Username: target.Username,
			Picture:  target.Picture,
		})
	})

	http.HandleFunc("DELETE /collaborators/{username}", func(w http.ResponseWriter, r *http.Request) {
		sess, ok := requireSession(db, w, r)
		if !ok {
			return
		}
		username := r.PathValue("username")
		if username == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		target, err := fetchUserByUsername(db, username)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if target == nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if err := removeCollaborator(db, sess.UserID, target.TokenID); err != nil {
			log.Println("failed to remove collaborator:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// WebSocket endpoint, scoped per user. Since each user IS their
	// repertoire, the username identifies the room. The handler resolves
	// the username to the owning user's TokenID internally.
	http.HandleFunc("/subscribe/{username}", cs.subscribeHandler)

	log.Println("server ready to serve! http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", withCORS(http.DefaultServeMux)))
	
}
