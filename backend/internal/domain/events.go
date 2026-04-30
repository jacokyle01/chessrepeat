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
type TrainingUpdatedEvent struct {
	Type      string   `json:"type"` // "training_updated"
	ChapterID string   `json:"chapterId"`
	Path      string   `json:"path"`    // path to the node (parent path, not including node id)
	UserSub   string   `json:"userSub"` // which user's training state changed
	Card      CardData `json:"card"`    // the updated card
}

// NodeToggleEvent is the WebSocket message envelope for enable/disable events.
type NodeToggleEvent struct {
	Type      string `json:"type"` // "node_enabled" or "node_disabled"
	ChapterID string `json:"chapterId"`
	Path      string `json:"path"`
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
