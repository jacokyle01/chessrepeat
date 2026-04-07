package main

import "net/http"
import "encoding/json"
import "encoding/base64"
import "log"
import "database/sql"
import "strings"

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {
	log.Println("starting server...")

	var db = connectDb()
	// chatserver needs db as parameter since we perform db operations during websocket connections
	cs := newChatServer(db)

	
	http.HandleFunc("/repertoire/{id}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			var id, err = parseIdFromRequest(r)
			if err != nil {
				log.Println("invalid repertoire:", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			log.Println("fetching repertoire for id:", id)

			repertoire, err := fetchRepertoire(db, id)
			if err != nil {
				if err == sql.ErrNoRows {
					log.Println("no repertoire found for id:", id, err)
					w.WriteHeader(http.StatusNotFound)
					return
				} else {
					log.Println("database error when fetching id:", id, err)
					w.WriteHeader(http.StatusInternalServerError)
					return
				}
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(repertoire)

			w.WriteHeader(http.StatusOK)
		} else if r.Method == "POST" {
			var repertoire, err = parseRepertoireFromRequest(r)
			if err != nil {
				log.Println("invalid repertoire:", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			log.Println("creating repertoire:", repertoire)

			repertoire, err = createRepertoire(db, repertoire)
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

		// decode JWT payload (no verification for now)
		parts := strings.Split(body.IDToken, ".")
		if len(parts) != 3 {
			http.Error(w, "malformed token", http.StatusBadRequest)
			return
		}
		payload, err := base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			http.Error(w, "malformed token payload", http.StatusBadRequest)
			return
		}

		var claims struct {
			Sub     string `json:"sub"`
			Name    string `json:"name"`
			Email   string `json:"email"`
			Picture string `json:"picture"`
		}
		if err := json.Unmarshal(payload, &claims); err != nil || claims.Sub == "" {
			http.Error(w, "invalid token claims", http.StatusBadRequest)
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

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(loginResponse{
			User:       user,
			Repertoire: repertoire,
		})
	})



	http.Handle("/subscribe", cs)
	http.Handle("/publish", cs)
	http.Handle("/chapter", cs)

	log.Println("server ready to serve! http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", withCORS(http.DefaultServeMux)))
	
}
