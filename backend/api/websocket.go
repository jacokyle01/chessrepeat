package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"github.com/jacokyle01/chessrepeat/backend/model"
	"github.com/jacokyle01/chessrepeat/backend/service"

	"github.com/gorilla/websocket"
)

type WSMessage struct {
	Type    string   `json:"type"`    // "add_move", "delete_move", "replace_move"
	GameID  string   `json:"gameId"`
	Path    []string `json:"path"`    // ID path to the node
	NewMove string   `json:"newMove"` // For add/replace
	NewID   string   `json:"newId"`   // For add/replace
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // allow any origin
}

func HandleWebSocket(svc *service.GameService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			http.Error(w, "WebSocket upgrade failed", http.StatusInternalServerError)
			return
		}
		defer conn.Close()

		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Read error: %v\n", err)
				break
			}

			var msg WSMessage
			if err := json.Unmarshal(data, &msg); err != nil {
				log.Printf("Unmarshal error: %v\n", err)
				continue
			}

			game, err := svc.LoadGame(msg.GameID)
			if err != nil {
				log.Printf("Game %s not in memory: %v\n", msg.GameID, err)
				conn.WriteJSON(map[string]string{
					"error": fmt.Sprintf("game %s not loaded", msg.GameID),
				})
				continue
			}

			switch msg.Type {
			case "add_move":
				parent := game.Root.FindByPath(msg.Path)
				if parent != nil {
					parent.Children = append(parent.Children, &model.MoveNode{
						ID:   msg.NewID,
						Move: msg.NewMove,
					})
				}
			case "delete_move":
				game.Root.DeleteNode(msg.Path)
			case "replace_move":
				game.Root.ReplaceNode(msg.Path, &model.MoveNode{
					ID:   msg.NewID,
					Move: msg.NewMove,
				})
			default:
				conn.WriteJSON(map[string]string{"error": "unknown message type"})
				continue
			}

			// ✅ Persist the updated game to DB
			if err := svc.SaveGame(msg.GameID); err != nil {
				log.Printf("Failed to persist game %s: %v\n", msg.GameID, err)
			}

			// 📨 Send updated game back to client
			if err := conn.WriteJSON(game); err != nil {
				log.Printf("Write error: %v\n", err)
			}
		}
	}
}
