package ws

import (
	"context"
	"encoding/json"

	"chessrepeat/internal/domain"
)

// authorizeChapter is the per-message authorization gate for every
// chapter-anchored WebSocket op. The handshake's view check only proves
// the subscriber may *read* the joined room; it doesn't prove they may
// write to whichever chapter they happen to name in a payload (chapter
// ids come from the client and could reference a foreign repertoire).
// We re-resolve the permission against the chapter's own owner_id, so
// joining one room and submitting a chapterId from another doesn't
// elevate authz.
//
// requireEdit=true gates the call to edit-class permissions only;
// otherwise any non-empty permission (owner / edit / train) passes,
// which is what training_updated wants.
//
// On error or denial we log and return false; the caller drops the
// message silently rather than echoing details back to the client.
func (s *Server) authorizeChapter(ctx context.Context, sub *subscriber, chapterID string, requireEdit bool) bool {
	perm, err := s.db.EffectivePermissionOnChapter(ctx, chapterID, sub.userID)
	if err != nil {
		s.logf("authz check failed (user %s, chapter %s): %v", sub.userID, chapterID, err)
		return false
	}
	if perm == "" {
		s.logf("forbidden: user %s has no access to chapter %s", sub.userID, chapterID)
		return false
	}
	if requireEdit && !domain.CanEdit(perm) {
		s.logf("forbidden: user %s has %s on chapter %s, edit required", sub.userID, perm, chapterID)
		return false
	}
	return true
}

// authorizeRoomEdit is the chapter_created variant: there is no existing
// chapter to resolve, so we authorize against the joined room's owner.
// Always edit-class — train-only collaborators cannot create chapters.
func (s *Server) authorizeRoomEdit(ctx context.Context, sub *subscriber) bool {
	perm, err := s.db.EffectivePermissionOnRepertoire(ctx, sub.room.id, sub.userID)
	if err != nil {
		s.logf("authz check failed (user %s, room %s): %v", sub.userID, sub.room.id, err)
		return false
	}
	if !domain.CanEdit(perm) {
		s.logf("forbidden: user %s has %q on room %s, edit required", sub.userID, perm, sub.room.id)
		return false
	}
	return true
}

// handleMessage matches the `type` field of an incoming WebSocket
// message to a server action. New ops are added by extending the switch.
// Every chapter-mutating branch must gate on authorizeChapter before
// touching the store. ctx is bounded per-message so a slow query
// cancels rather than pinning a DB connection.
func (s *Server) handleMessage(ctx context.Context, sub *subscriber, raw []byte) {
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
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		if err := s.db.AddMoveToChapter(ctx, event); err != nil {
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
		// train-only collaborators are allowed here; that's the whole
		// point of the train role.
		if !s.authorizeChapter(ctx, sub, event.ChapterID, false) {
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
		if err := s.db.UpdateTrainingState(ctx, event); err != nil {
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
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		if err := s.db.DeleteNodeFromChapter(ctx, event); err != nil {
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
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		if err := s.db.SetEnabledRecursive(ctx, event.ChapterID, event.Path, false); err != nil {
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
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		if err := s.db.SetEnabledRecursive(ctx, event.ChapterID, event.Path, true); err != nil {
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
		if !s.authorizeRoomEdit(ctx, sub) {
			return
		}
		// stamp owner from the joined room rather than trusting the client
		event.OwnerID = sub.room.id
		if err := s.db.CreateChapter(ctx, event); err != nil {
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
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		if err := s.db.DeleteChapter(ctx, event.ChapterID); err != nil {
			s.logf("delete chapter (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	default:
		s.logf("unknown ws op %q from user %s", env.Type, sub.userID)
	}
}
