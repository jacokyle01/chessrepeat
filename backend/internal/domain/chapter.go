package domain

// ChapterTreeNode is used when rebuilding a chapter's move tree from the
// flattened map persisted in the chapters collection.
type ChapterTreeNode struct {
	Data     TrainingData      `json:"data"`
	Children []ChapterTreeNode `json:"children"`
}

// ChapterTreeResponse is the JSON sent to clients when reading a chapter.
type ChapterTreeResponse struct {
	UUID         string          `json:"uuid"`
	RepertoireID string          `json:"repertoireId"`
	Name         string          `json:"name"`
	TrainAs      string          `json:"trainAs"`
	EnabledCount int             `json:"enabledCount"`
	UnseenCount  int             `json:"unseenCount"`
	Root         ChapterTreeNode `json:"root"`
}
