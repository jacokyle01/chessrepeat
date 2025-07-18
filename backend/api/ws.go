package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/jacokyle01/chessrepeat-backend/model"
	"github.com/jacokyle01/chessrepeat-backend/service"

	"github.com/gorilla/websocket"
)

type Message struct {
	Type    string   `json:"type"`
	GameID  string   `json:"gameId"`
	Path    []string `json:"path"`
	NewMove string   `json:"newMove"`
	NewID   string   `json:"newId"`
}

var upgrader = websocket.Upgrader{}

func HandleWS(svc *service.GameService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("Incoming message")
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("Upgrade error:", err)
			return
		}
		defer conn.Close()

		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				log.Println("Read error:", err)
				break
			}
			var m Message
			err = json.Unmarshal(msg, &m)
			if err != nil {
				log.Println("Unmarshal error:", err)
				continue
			}

			game, _ := svc.LoadOrCreateGame(m.GameID)
			log.Println("Message type: %s\n", m.Type)
			switch m.Type {
			case "add_move":
				log.Println("Entering add_move")
				parent := game.Root.FindByPath(m.Path)
				if parent != nil {
					parent.Children = append(parent.Children, &model.MoveNode{
						ID:   m.NewID,
						Move: m.NewMove,
					})
				}
				svc.SaveGame(m.GameID)

			case "delete_move":
				game.Root.DeleteNode(m.Path)
				svc.SaveGame(m.GameID)

			case "replace_move":
				game.Root.ReplaceNode(m.Path, &model.MoveNode{
					ID:   m.NewID,
					Move: m.NewMove,
				})
				svc.SaveGame(m.GameID)
			}

			conn.WriteJSON(game)
		}
	}
}
