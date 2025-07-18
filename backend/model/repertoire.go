package model

import chess "github.com/jacokyle01/chessrepeat-backend/chess"

type RepertoireMeta struct {
	TrainAs       chess.Color `bson:"trainAs" json:"trainAs"`
	NodeCount     int         `bson:"nodeCount" json:"nodeCount"`
	BucketEntries []int       `bson:"bucketEntries" json:"bucketEntries"`
}

type TrainingData struct {
	// TODO use union? or find way to save space, more optimal trainingData 
	Disabled bool `bson:"disabled" json:"disabled"`
	Seen bool `bson:"seen" json:"seen"`
	Group int `bson:"group" json:"group"`
	DueAt int32 `bson:"dueAt" json:"dueAt"`
}

// export interface TrainingData extends PgnNodeData {
//   training: {
//     id: number;
//     disabled: boolean;
//     seen: boolean;
//     group: number;
//     dueAt: number;
//   };
//   fen: string
// }

type MoveNode struct {
	ID       string      `bson:"id" json:"id"`
	Move     string      `bson:"move" json:"move"`
	Comments []string    `bson:"comments" json:"comments"`
	Training TrainingData
	Children []*MoveNode `bson:"children" json:"children"`
}

type RepertoireEntry struct {
	ID   string    `bson:"_id" json:"id"`
	Name string    `bson:"name" json:"name"`
	Root *MoveNode `bson:"tree" json:"tree"`
	Meta RepertoireMeta
}
