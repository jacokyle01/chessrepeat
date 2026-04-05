package main

import "net/http"
import "encoding/json"
import "log"
import "database/sql"

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
	cs := newChatServer()

	
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

	http.Handle("/subscribe", cs)
	http.Handle("/publish", cs)

	log.Println("server ready to serve! http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", withCORS(http.DefaultServeMux)))
	
}
