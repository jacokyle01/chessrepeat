package main

import "net/http"
import "encoding/json"
import "log"

import "go.mongodb.org/mongo-driver/v2/mongo"

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

func main() {
	log.Println("starting server...")

	var db = connectDb()
	// chatserver needs db as parameter since we perform db operations during websocket connections
	cs := newChatServer(db)

	
	http.HandleFunc("/repertoire/{id}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			// require an authenticated session — no anonymous reads
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

			id := r.PathValue("id")
			if id == "" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			log.Println("fetching repertoire for id:", id)

			repertoire, err := fetchRepertoire(db, id)
			if err != nil {
				if err == mongo.ErrNoDocuments {
					log.Println("no repertoire found for id:", id, err)
					w.WriteHeader(http.StatusNotFound)
					return
				}
				log.Println("database error when fetching id:", id, err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			chapters, err := fetchChaptersByRepertoire(db, id)
			if err != nil {
				log.Println("failed to fetch chapters for repertoire:", id, err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			resp := struct {
				Repertoire repertoireJson        `json:"repertoire"`
				Chapters   []ChapterTreeResponse `json:"chapters"`
			}{
				Repertoire: repertoire,
				Chapters:   chapters,
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
		} else if r.Method == "POST" {
			var repertoire repertoireJson
			if err := json.NewDecoder(r.Body).Decode(&repertoire); err != nil {
				log.Println("invalid repertoire:", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			repertoire.RepertoireId = r.PathValue("id")

			log.Println("creating repertoire:", repertoire)
			repertoire, err := createRepertoire(db, repertoire)
			if err != nil {
				log.Println("database error when creating repertoire:", repertoire, err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(repertoire)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	/*
		upsert user, repertoire table

		assumptions:
			- the user doesn't have a local repertoire that they want to add.
				so this will just create an empty repertoire for them

	*/
	http.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var body struct {
			IDToken string `json:"idToken"`
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

		user := userJson{
			TokenID: claims.Sub,
			Name:    claims.Name,
			Email:   claims.Email,
			Picture: claims.Picture,
		}

		if err := upsertUser(db, user); err != nil {
			log.Println("failed to upsert user:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		repertoire, err := fetchRepertoireByUser(db, user.TokenID)
		if err != nil {
			log.Println("failed to fetch repertoire:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// new user — create a default repertoire
		if repertoire == nil {
			newRep, err := createRepertoireForUser(db, user.TokenID)
			if err != nil {
				log.Println("failed to create repertoire:", err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			repertoire = &newRep
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(loginResponse{
			User:       user,
			Repertoire: repertoire,
		})
	})



	/*
		auto-login endpoint: validates the session cookie and returns the
		user + repertoire so the frontend can re-establish the auth state on
		page load without prompting the user to sign in again.
	*/
	http.HandleFunc("/me", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		//TODO in memory cache for sessions 
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
		user, err := fetchUser(db, sess.UserID)
		if err != nil {
			log.Println("user lookup failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if user == nil {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		repertoire, err := fetchRepertoireByUser(db, sess.UserID)
		if err != nil {
			log.Println("repertoire lookup failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(loginResponse{
			User:       *user,
			Repertoire: repertoire,
		})
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

	// WebSocket endpoint, scoped per repertoire. Each repertoire id maps
	// to its own "room" of connected subscribers on the backend.
	http.HandleFunc("/subscribe/{repertoireId}", cs.subscribeHandler)

	log.Println("server ready to serve! http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", withCORS(http.DefaultServeMux)))
	
}
