package ws

import (
	"encoding/json"

	"chessrepeat/internal/domain"
)

// canCollaborate is the per-message authorization gate for every
// chapter-mutating WebSocket op. The handshake's CanViewRepertoire only
// proves the subscriber may *read* the joined room; it doesn't prove
// they may write to whichever chapter they happen to name in a payload
// (chapter ids are passed by the client and could reference a foreign
// repertoire). For each op we therefore re-check, anchored on the
// chapter's own repertoire — the subscriber is allowed only if they own,
// or have been added as a collaborator on, the repertoire that contains
// the chapter (or, for chapter_created, the joined room's owner, since
// the chapter doesn't exist yet).
//
// On error or denial we log and return false; the caller drops the
// message silently rather than echoing details back to the client.
func (s *Server) canCollaborate(sub *subscriber, chapterID string) bool {
	ok, err := s.db.CanCollaborateOnChapter(chapterID, sub.userID)
	if err != nil {
		s.logf("authz check failed (user %s, chapter %s): %v", sub.userID, chapterID, err)
		return false
	}
	if !ok {
		s.logf("forbidden: user %s cannot collaborate on chapter %s", sub.userID, chapterID)
	}
	return ok
}

// canCollaborateOnRoom is the chapter_created variant: there is no
// existing chapter to resolve, so we authorize against the joined
// room's owning repertoire instead.
func (s *Server) canCollaborateOnRoom(sub *subscriber) bool {
	ok, err := s.db.CanCollaborateOnRepertoire(sub.room.id, sub.userID)
	if err != nil {
		s.logf("authz check failed (user %s, room %s): %v", sub.userID, sub.room.id, err)
		return false
	}
	if !ok {
		s.logf("forbidden: user %s cannot collaborate on room %s", sub.userID, sub.room.id)
	}
	return ok
}

// handleMessage matches the `type` field of an incoming WebSocket
// message to a server action. New ops are added by extending the switch.
// Every chapter-mutating branch must gate on canCollaborate before
// touching the store.
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
		if !s.canCollaborate(sub, event.ChapterID) {
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
		if !s.canCollaborate(sub, event.ChapterID) {
			return
		}
		// stamp the username from the session: a collaborator must not be
		// able to overwrite another user's training cards by spoofing the
		// field. re-marshal so peers receive the corrected envelope.
		event.Username = sub.username
		out, err := json.Marshal(event)
		if err != nil {
			s.logf("marshal training_updated (user %s): %v", sub.userID, err)
			return
		}
		if err := s.db.UpdateTrainingState(event); err != nil {
			s.logf("update training (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, out, sub)

	case "node_deleted":
		var event domain.NodeDeleteEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid node_deleted from user %s: %v", sub.userID, err)
			return
		}
		if !s.canCollaborate(sub, event.ChapterID) {
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
		if !s.canCollaborate(sub, event.ChapterID) {
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
		if !s.canCollaborate(sub, event.ChapterID) {
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
		// no chapter yet to resolve — authorize against the joined room.
		if !s.canCollaborateOnRoom(sub) {
			return
		}
		// stamp owner from the joined room rather than trusting the client
		event.OwnerID = sub.room.id
		if err := s.db.CreateChapter(event); err != nil {
			s.logf("persist chapter (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "chapter_deleted":
		var event domain.ChapterDeleteEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid chapter_deleted from user %s: %v", sub.userID, err)
			return
		}
		if !s.canCollaborate(sub, event.ChapterID) {
			return
		}
		if err := s.db.DeleteChapter(event.ChapterID); err != nil {
			s.logf("delete chapter (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	default:
		s.logf("unknown ws op %q from user %s", env.Type, sub.userID)
	}
}
