package domain

// ChapterTreeNode is used when rebuilding a chapter's move tree from the
// flattened rows persisted in the moves table.
type ChapterTreeNode struct {
	Data     TrainingData      `json:"data"`
	Children []ChapterTreeNode `json:"children"`
}

// ChapterTreeResponse is the JSON sent to clients when reading a chapter.
// Counts (enabled/unseen/due) are no longer persisted server-side — the
// client computes them from the move tree + per-user training cards.
type ChapterTreeResponse struct {
	UUID    string          `json:"uuid"`
	Name    string          `json:"name"`
	TrainAs string          `json:"trainAs"`
	Root    ChapterTreeNode `json:"root"`
}
