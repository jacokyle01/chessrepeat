package ws

import (
	"context"
	"encoding/json"
	"errors"

	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

// reloadMessage tells a single client to discard its in-memory tree and
// re-fetch the repertoire over HTTP. Sent when that client's mutation
// referenced a path the server doesn't have (its tree drifted), so the
// bad op is never fanned out to the rest of the room.
var reloadMessage = []byte(`{"type":"reload"}`)

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
			switch {
			case errors.Is(err, store.ErrPathNotFound):
				// Client added a move under a path the server doesn't
				// have: its tree has drifted. Tell just that client to
				// resync; don't fan the bad op out to the room.
				s.logf("move_created from user %s targets missing path %q in chapter %s; requesting reload",
					sub.userID, event.Path, event.ChapterID)
				s.sendTo(sub, reloadMessage)
			case errors.Is(err, store.ErrChapterMoveLimit):
				// Chapter is at the move cap. Reject and resync the
				// originating client so it drops the local move.
				s.logf("move_created from user %s exceeds move cap on chapter %s; requesting reload",
					sub.userID, event.ChapterID)
				s.sendTo(sub, reloadMessage)
			default:
				s.logf("persist move (user %s): %v", sub.userID, err)
			}
			return
		}
		s.publishRoom(sub.room, raw, sub)

	case "set_comment":
		var event domain.CommentEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid set_comment from user %s: %v", sub.userID, err)
			return
		}
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		// Truncate over-long comments rather than rejecting: the
		// frontend already caps the textarea, this is defense in depth.
		// Count by runes so multi-byte characters aren't sliced mid-glyph.
		if r := []rune(event.Comment); len(r) > store.MaxCommentChars {
			event.Comment = string(r[:store.MaxCommentChars])
		}
		// Re-marshal so peers receive the canonical (possibly-truncated)
		// comment, not the oversized original.
		out, err := json.Marshal(event)
		if err != nil {
			s.logf("marshal set_comment (user %s): %v", sub.userID, err)
			return
		}
		if err := s.db.SetComment(ctx, event.ChapterID, event.Path, event.Comment); err != nil {
			if errors.Is(err, store.ErrPathNotFound) {
				// Commenting on a node the server doesn't have:
				// sender's tree drifted. Reload just that client.
				s.logf("set_comment from user %s targets missing path %q in chapter %s; requesting reload",
					sub.userID, event.Path, event.ChapterID)
				s.sendTo(sub, reloadMessage)
				return
			}
			s.logf("set comment (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, out, sub)

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
			if errors.Is(err, store.ErrPathNotFound) {
				// Training update targets a node the server doesn't
				// have: sender's tree drifted. Resync just that client;
				// don't broadcast a no-op.
				s.logf("training_updated from user %s targets missing path %q in chapter %s; requesting reload",
					sub.userID, event.Path, event.ChapterID)
				s.sendTo(sub, reloadMessage)
				return
			}
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
			if errors.Is(err, store.ErrPathNotFound) {
				// Node to delete isn't on the server: sender's tree
				// drifted. Resync just that client; don't broadcast.
				s.logf("node_deleted from user %s targets missing path %q in chapter %s; requesting reload",
					sub.userID, event.Path, event.ChapterID)
				s.sendTo(sub, reloadMessage)
				return
			}
			s.logf("delete node (user %s): %v", sub.userID, err)
			return
		}
		s.publishRoom(sub.room, raw, sub)

	// node_enabled / node_disabled are intentionally absent: the
	// enable/disable WS ops were removed. Enable/disable state changes
	// ride along with the move tree (move_created upserts the enabled
	// flag) and chapter-level resyncs.

	// chapter_created is intentionally absent: chapters are created via
	// HTTP POST /chapter (the tree exceeds the WS frame cap). The HTTP
	// handler persists and then broadcasts a reload to the owner's room.

	case "chapter_renamed":
		var event domain.ChapterRenameEvent
		if err := json.Unmarshal(raw, &event); err != nil {
			s.logf("invalid chapter_renamed from user %s: %v", sub.userID, err)
			return
		}
		if !s.authorizeChapter(ctx, sub, event.ChapterID, true) {
			return
		}
		if err := s.db.RenameChapter(ctx, event.ChapterID, event.Name); err != nil {
			s.logf("rename chapter (user %s): %v", sub.userID, err)
			return
		}
		// Same model as chapter_deleted: structural change, peers
		// resync; sender already updated optimistically so it's excluded.
		s.publishRoom(sub.room, reloadMessage, sub)

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
		// Structural change: tell peers to resync rather than patching
		// the delete locally, matching the chapter-create flow. The
		// deleting client already removed it optimistically, so exclude
		// it (sender) to skip a redundant refetch on that tab.
		s.publishRoom(sub.room, reloadMessage, sub)

	default:
		s.logf("unknown ws op %q from user %s", env.Type, sub.userID)
	}
}
