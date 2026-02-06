package httpx

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/jacokyle01/chessrepeat/backend/internal/store"
)

type ChapterHandlers struct {
	Chapters *store.ChapterStore
}

//TODO remove logs 
func (h *ChapterHandlers) Create(w http.ResponseWriter, r *http.Request) {
	u := MustUser(r)

	log.Printf(
		"[CreateChapter] user=%s method=%s path=%s content-type=%s",
		u.UserID, r.Method, r.URL.Path, r.Header.Get("Content-Type"),
	)

	// ---- read raw body for logging ----
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[CreateChapter] read body error: %v", err)
		http.Error(w, "read error", http.StatusBadRequest)
		return
	}

	log.Printf("[CreateChapter] raw body:\n%s", string(raw))

	// restore body so json.Decoder can read it
r.Body = io.NopCloser(bytes.NewReader(raw))

	// ---- decode JSON ----
	var req store.ChapterDTO
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[CreateChapter] json decode error: %v", err)
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}

	// ---- log decoded shape (safe summary) ----
	log.Printf(
		"[CreateChapter] decoded chapter id=%s name=%q moves=%d",
		req.ID, req.Name, len(req.Moves),
	)

	if len(req.Moves) > 0 {
		m := req.Moves[0]
		log.Printf(
			"[CreateChapter] first move id=%s parentIdx=%v ord=%d fen=%q",
			m.ID, m.ParentIDX, m.Ord, m.Fen,
		)
	}

	// ---- persist ----
	if err := h.Chapters.CreateChapter(r.Context(), u.UserID, req); err != nil {
		log.Printf("[CreateChapter] store error: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("[CreateChapter] success chapter=%s user=%s", req.ID, u.UserID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok": true,
		"id": req.ID,
	})
}


// TODO dont need as much logging
func (h *ChapterHandlers) List(w http.ResponseWriter, r *http.Request) {
	u := MustUser(r)

	log.Printf(
		"[ListChapters] user=%s method=%s path=%s",
		u.UserID, r.Method, r.URL.Path,
	)

	chs, err := h.Chapters.ListChapters(r.Context(), u.UserID)
	if err != nil {
		log.Printf("[ListChapters] store error: %v", err)
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	// safe summary logging
	totalMoves := 0
	for i := range chs {
		totalMoves += len(chs[i].Moves)
	}
	log.Printf("[ListChapters] success chapters=%d moves=%d user=%s", len(chs), totalMoves, u.UserID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"ok":       true,
		"chapters": chs,
	})
}
