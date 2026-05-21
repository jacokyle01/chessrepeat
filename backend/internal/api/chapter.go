package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"chessrepeat/internal/auth"
	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

// maxChapterBody bounds the POST /chapter request body. A chapter tree
// is far larger than the 64 KiB WebSocket frame cap (that's why it's on
// HTTP), but it still must not be unbounded — a multi-MB body would let
// an authenticated client burn DB/CPU. 4 MiB comfortably fits the
// largest realistic repertoire chapter.
const maxChapterBody = 4 << 20

// RepertoireNotifier is the slice of the WS server the chapter handler
// needs: after a chapter is persisted over HTTP, nudge everyone in the
// owner's room to re-fetch. *ws.Server satisfies this.
type RepertoireNotifier interface {
	NotifyRepertoireChanged(ownerID string)
}

// PostChapter persists a full chapter tree over HTTP (the tree is too
// large for the WS frame cap) and then notifies the owner's connected
// peers to resync. Edit-class permission on the target repertoire is
// required. Owner is resolved the same way GET /repertoire does:
// ?owner=<username>, else the caller's own repertoire — never trusted
// from the body.
func PostChapter(db *store.DB, notifier RepertoireNotifier) http.HandlerFunc {
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
			log.Println("post chapter: owner lookup failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if owner == nil {
			w.WriteHeader(http.StatusNotFound)
			return
		}

		// Creating a chapter is an edit-class op; train-only
		// collaborators (and non-collaborators) are rejected. Mirrors
		// the ws authorizeRoomEdit gate.
		perm, err := db.EffectivePermissionOnRepertoire(r.Context(), owner.TokenID, sess.UserID)
		if err != nil {
			log.Println("post chapter: permission check failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		if !domain.CanEdit(perm) {
			w.WriteHeader(http.StatusForbidden)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxChapterBody)
		var event domain.ChapterEvent
		if err := json.NewDecoder(r.Body).Decode(&event); err != nil {
			http.Error(w, "invalid chapter payload", http.StatusBadRequest)
			return
		}
		// Stamp owner from the resolved repertoire, never the body.
		event.OwnerID = owner.TokenID

		if err := db.CreateChapter(r.Context(), event); err != nil {
			if errors.Is(err, store.ErrChapterMoveLimit) {
				http.Error(w, "chapter exceeds move limit", http.StatusRequestEntityTooLarge)
				return
			}
			log.Println("post chapter: create failed:", err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}

		// Persisted: tell every connected peer in the owner's room to
		// re-fetch. The tree never travels over the socket.
		notifier.NotifyRepertoireChanged(owner.TokenID)
		w.WriteHeader(http.StatusCreated)
	}
}

// RegisterChapterRoute wires POST /chapter. Kept separate from
// api.Register because it needs the concrete *store.DB (chapter/perm
// methods aren't on the Repo interface) and the WS notifier — neither
// of which the Repo-only HTTP handlers carry.
func RegisterChapterRoute(mux *http.ServeMux, db *store.DB, notifier RepertoireNotifier) {
	mux.HandleFunc("POST /chapter", PostChapter(db, notifier))
}
