package domain

// MoveEvent is the WebSocket message envelope for move creation events.
type MoveEvent struct {
	Type      string       `json:"type"`      // "move_created"
	ChapterID string       `json:"chapterId"` // websocket connections will be per-repertoire, need to know which chapter
	Move      TrainingData `json:"move"`
	Path      string       `json:"path"`
}

// NodeDeleteEvent is the WebSocket message envelope for node deletion events.
type NodeDeleteEvent struct {
	Type      string `json:"type"` // "node_deleted"
	ChapterID string `json:"chapterId"`
	Path      string `json:"path"`
}

// TrainingUpdatedEvent is the WebSocket message envelope for training state changes (learn/recall).
//
// Username is informational on the wire — the server overrides it with
// the sender's session-bound username before persisting or broadcasting,
// so a client cannot write training state under another user's name.
type TrainingUpdatedEvent struct {
	Type      string   `json:"type"` // "training_updated"
	ChapterID string   `json:"chapterId"`
	Path      string   `json:"path"`     // path to the node (parent path, not including node id)
	Username  string   `json:"username"` // which user's training state changed
	Card      CardData `json:"card"`     // the updated card
}

// NodeToggleEvent is the WebSocket message envelope for enable/disable events.
type NodeToggleEvent struct {
	Type      string `json:"type"` // "node_enabled" or "node_disabled"
	ChapterID string `json:"chapterId"`
	Path      string `json:"path"`
}

// ChapterDeleteEvent is the WebSocket message envelope for chapter
// deletion events. The chapter is removed from its owning repertoire on
// the server, then the raw envelope is rebroadcast to peers so they can
// drop it from their in-memory state.
type ChapterDeleteEvent struct {
	Type      string `json:"type"`      // "chapter_deleted"
	ChapterID string `json:"chapterId"`
}

// ChapterEvent is the WebSocket message envelope for chapter creation events.
type ChapterEvent struct {
	Type         string          `json:"type"`      // "chapter_created"
	ChapterID    string          `json:"chapterId"` // TODO uuid? //TODO create server-side??
	OwnerID      string          `json:"ownerId"`
	Name         string          `json:"name"`
	TrainAs      string          `json:"trainAs"`
	Root         ChapterTreeNode `json:"root"`
	EnabledCount int             `json:"enabledCount"`
	UnseenCount  int             `json:"unseenCount"`
}
