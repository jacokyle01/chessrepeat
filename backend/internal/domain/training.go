package domain

// TrainingData mirrors the frontend node shape. Training is keyed by user
// sub so each collaborator has independent spaced-repetition state on the
// same move.
type TrainingData struct {
	ID       string               `json:"id"` // this is NOT really an ID in the sense that it's being used. TODO
	FEN      string               `json:"fen"`
	Ply      int                  `json:"ply"`
	SAN      string               `json:"san"`
	Comment  string               `json:"comment"`
	Enabled  bool                 `json:"enabled"`
	Training map[string]*CardData `json:"training"` // keyed by user sub; empty/nil if unseen
}

// CardData mirrors the ts-fsrs lib's card shape on the frontend.
type CardData struct {
	Due           string  `json:"due"`
	Stability     float64 `json:"stability"`
	Difficulty    float64 `json:"difficulty"`
	ElapsedDays   int     `json:"elapsed_days"`
	ScheduledDays int     `json:"scheduled_days"`
	Reps          int     `json:"reps"`
	Lapses        int     `json:"lapses"`
	State         int     `json:"state"`
	LastReview    string  `json:"last_review"`
}
