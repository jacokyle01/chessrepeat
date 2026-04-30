package api

import (
	"encoding/json"
	"log"
	"net/http"

	"chessrepeat/internal/store"
)

func GetChapter(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		id := r.PathValue("id")
		if id == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		tree, err := db.ReadChapterAsTree(id)
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
	}
}
