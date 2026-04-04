package main

import "net/http"
import "encoding/json"
import "log"
import "database/sql"

func main() {
	log.Println("starting server...")

	var db = connectDb()

	http.HandleFunc("/repertoire/{id}/create-moves", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" {
			var id, err = parseIdFromRequest(r)
			if err != nil {
				log.Println("invalid repertoire id:", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			moves, err := parseMovesFromRequest(r)
			if err != nil {
				log.Println("invalid moves:", err)
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

			// TODO(ben): verify existing repertoire doesn't already have the combination of san and prev_moves

			repertoire, err = createMoves(db, repertoire, moves)
			if err != nil {
				log.Println("database error when created moves:", repertoire, moves, err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			log.Println("moves created successfully!:", repertoire, moves)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(repertoire)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	http.HandleFunc("/repertoire/{id}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			var id, err = parseIdFromRequest(r)
			if err != nil {
				log.Println("invalid repertoire id:", err)
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

			log.Println("repertoire fetched successfully!:", repertoire)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(repertoire)
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

			log.Println("repertoire created successfully!:", repertoire)

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(repertoire)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	log.Println("server ready to serve! http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", nil))
}
