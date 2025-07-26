// /api/http.go
// TODO change name to handlers/* ? 
package api

import (
	"encoding/json"
	"github.com/jacokyle01/chessrepeat/backend/model"
	"github.com/jacokyle01/chessrepeat/backend/service"
	"net/http"
	"io"
	"log"
)

type AddAndSetGameRequest struct {
	ID   string               `json:"id"`
	Name string               `json:"name"`
	Tree *model.MoveNode      `json:"tree"`
	Meta model.RepertoireMeta `json:"meta"`
}

func enableCors(w http.ResponseWriter) {
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

//TODO accept PGN / game tree 
func HandleCreateChapter(svc *service.GameService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(w)

		// Read and log the raw request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			log.Printf("Failed to read request body: %v", err)
			http.Error(w, "Unable to read request body", http.StatusBadRequest)
			return
		}
		log.Printf("Received JSON:\n%s\n", string(body))

		// Decode from the raw body
		var chapter model.RepertoireEntry
		if err := json.Unmarshal(body, &chapter); err != nil {
			log.Printf("JSON unmarshal error: %v", err)
			http.Error(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}

		// Create the chapter
		if err := svc.CreateChapter(&chapter); err != nil {
			log.Printf("Failed to create chapter: %v", err)
			http.Error(w, "Failed to create chapter: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// Success response
		w.WriteHeader(http.StatusCreated)
		if err := json.NewEncoder(w).Encode(chapter); err != nil {
			log.Printf("Failed to write response: %v", err)
		}
	}
}


func HandleSwitchChapter (svc *service.GameService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCors(w);
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