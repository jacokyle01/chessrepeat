// /api/http.go
package api

import (
	"encoding/json"
	"github.com/jacokyle01/chessrepeat/backend/model"
	"github.com/jacokyle01/chessrepeat/backend/service"
	"net/http"
)

type AddAndSetGameRequest struct {
	ID   string               `json:"id"`
	Name string               `json:"name"`
	Tree *model.MoveNode      `json:"tree"`
	Meta model.RepertoireMeta `json:"meta"`
}

//TODO accept PGN / game tree 
func HandleCreateChapter(svc *service.GameService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var chapter model.RepertoireEntry
		if err := json.NewDecoder(r.Body).Decode(&chapter); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		if err := svc.CreateChapter(&chapter); err != nil {
			http.Error(w, "Failed to create chapter: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(chapter)
	}
}

func HandleSwitchChapter (svc *service.GameService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		chapterID := r.Header.Get("X-Chapter-ID")
		if chapterID == "" {
			http.Error(w, "Missing X-Chapter-ID header", http.StatusBadRequest)
			return
		}

		err := svc.SwitchChapter(chapterID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		w.WriteHeader(http.StatusNoContent) // Success, nothing to return
	}
}