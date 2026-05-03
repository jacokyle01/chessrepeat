package api

import (
	"encoding/json"
	"log"
	"net/http"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

func GetOutgoingCollaborators(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess, ok := auth.RequireSession(db, w, r)
		if !ok {
			return
		}
		collabs, err := db.FetchOutgoingCollaborators(sess.UserID)
		if err != nil {
			log.Println("failed to fetch outgoing collaborators:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"collaborators": collabs})
	}
}

func GetIncomingCollaborators(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess, ok := auth.RequireSession(db, w, r)
		if !ok {
			return
		}
		collabs, err := db.FetchIncomingCollaborators(sess.UserID)
		if err != nil {
			log.Println("failed to fetch incoming collaborators:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"collaborators": collabs})
	}
}

func AddCollaborator(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess, ok := auth.RequireSession(db, w, r)
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
		target, err := db.FetchUserByUsername(body.Username)
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
		if err := db.AddCollaborator(sess.UserID, target.TokenID); err != nil {
			log.Println("failed to add collaborator:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(domain.CollaboratorView{
			Username: target.Username,
			Picture:  target.Picture,
		})
	}
}

func RemoveCollaborator(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess, ok := auth.RequireSession(db, w, r)
		if !ok {
			return
		}
		username := r.PathValue("username")
		if username == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		target, err := db.FetchUserByUsername(username)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if target == nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if err := db.RemoveCollaborator(sess.UserID, target.TokenID); err != nil {
			log.Println("failed to remove collaborator:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
