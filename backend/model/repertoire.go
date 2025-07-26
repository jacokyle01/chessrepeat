package model

import chess "github.com/jacokyle01/chessrepeat/backend/chess"

type RepertoireMeta struct {
	TrainAs       chess.Color `bson:"trainAs" json:"trainAs"`
	NodeCount     int         `bson:"nodeCount" json:"nodeCount"`
	BucketEntries []int       `bson:"bucketEntries" json:"bucketEntries"`
}

type Training struct {
	ID       int     `bson:"id" json:"id"`
	Disabled bool    `bson:"disabled" json:"disabled"`
	Seen     bool    `bson:"seen" json:"seen"`
	Group    int     `bson:"group" json:"group"`
	DueAt    float64 `bson:"dueAt" json:"dueAt"` // JSON sends Infinity => float64
}

// TODO union type or method for not storing so much per-move 
type TrainingData struct {
	SAN              string    `bson:"san" json:"san"`
	StartingComments []string  `bson:"startingComments,omitempty" json:"startingComments,omitempty"`
	Comments         []string  `bson:"comments,omitempty" json:"comments,omitempty"`
	NAGs             []int     `bson:"nags,omitempty" json:"nags,omitempty"`
	FEN              string    `bson:"fen" json:"fen"`
	Training         Training  `bson:"training" json:"training"`
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
	ID       string       `bson:"id" json:"id"`
	Data     *NodeData    `bson:"data,omitempty" json:"data,omitempty"`
	Children []*MoveNode  `bson:"children,omitempty" json:"children,omitempty"`
}

type NodeData struct {
	Move     string       `bson:"move,omitempty" json:"san,omitempty"` // match naming
	Comments []string     `bson:"comments,omitempty" json:"comments,omitempty"`
	Training TrainingData `bson:"training" json:"training"`
	FEN      string       `bson:"fen" json:"fen"`
}


type RepertoireEntry struct {
	ID   string         `bson:"_id,omitempty" json:"id"`
	Name string         `bson:"name" json:"name"`
	Root *MoveNode      `bson:"tree" json:"tree"`
	Meta RepertoireMeta `bson:"meta" json:"meta"`
}