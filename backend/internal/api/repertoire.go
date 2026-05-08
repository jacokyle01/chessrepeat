package api

import (
	"encoding/json"
	"log"
	"net/http"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

// GetRepertoire returns the caller's own repertoire (resolved from the
// session cookie) or, if owner=<username> is set, that user's repertoire.
// The response shape is {user, chapters} — each user IS their repertoire,
// so the owner's profile doubles as repertoire metadata.
func GetRepertoire(db store.Repo) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sess, ok := auth.RequireSession(db, w, r)
		if !ok {
			return
		}

		var (
			owner *domain.User
			err   error
		)
		if q := r.URL.Query().Get("owner"); q != "" {
			owner, err = db.FetchUserByUsername(r.Context(), q)
		} else {
			owner, err = db.FetchUser(r.Context(), sess.UserID)
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

		canView, err := db.CanViewRepertoire(r.Context(), owner.TokenID, sess.UserID)
		if err != nil {
			log.Println("view auth check failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if !canView {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		chapters, err := db.FetchChaptersByOwner(r.Context(), owner.TokenID)
		if err != nil {
			log.Println("failed to fetch chapters:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		resp := struct {
			User     domain.User                  `json:"user"`
			Chapters []domain.ChapterTreeResponse `json:"chapters"`
		}{
			User:     *owner,
			Chapters: chapters,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}
}
