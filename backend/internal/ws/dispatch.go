package ws

import (
	"encoding/json"

	"chessrepeat/internal/domain"
)

// handleMessage matches the `type` field of an incoming WebSocket
// message to a server action. New ops are added by extending the switch.
func (s *Server) handleMessage(sub *subscriber, raw []byte) {
	var env struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		s.logf("invalid ws message from user %s: %v", sub.userID, err)
		return
	}

	switch env.Type {
	case "move_created":
		var event domain.MoveEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid move_created from user %s: %v", sub.userID, err)
			return
		}
		if err := s.db.AddMoveToChapter(event); err != nil {
			s.logf("persist move (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "training_updated":
		var event domain.TrainingUpdatedEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid training_updated from user %s: %v", sub.userID, err)
			return
		}
		if err := s.db.UpdateTrainingState(event); err != nil {
			s.logf("update training (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "node_deleted":
		var event domain.NodeDeleteEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid node_deleted from user %s: %v", sub.userID, err)
			return
		}
		if err := s.db.DeleteNodeFromChapter(event); err != nil {
			s.logf("delete node (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "node_disabled":
		var event domain.NodeToggleEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid node_disabled from user %s: %v", sub.userID, err)
			return
		}
		if err := s.db.SetEnabledRecursive(event.ChapterID, event.Path, false); err != nil {
			s.logf("disable node (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "node_enabled":
		var event domain.NodeToggleEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid node_enabled from user %s: %v", sub.userID, err)
			return
		}
		if err := s.db.SetEnabledRecursive(event.ChapterID, event.Path, true); err != nil {
			s.logf("enable node (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "chapter_created":
		var event domain.ChapterEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid chapter_created from user %s: %v", sub.userID, err)
			return
		}
		// stamp owner from the joined room rather than trusting the client
		event.OwnerID = sub.room.id
		if err := s.db.CreateChapter(event); err != nil {
			s.logf("persist chapter (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	default:
		s.logf("unknown ws op %q from user %s", env.Type, sub.userID)
	}
}
