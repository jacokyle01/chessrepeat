package store

import (
	"context"
	"sort"

	"chessrepeat/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// chapterDoc is the MongoDB document for a chapter.
// Moves is a flat map keyed by id-path (concatenation of each ancestor's
// TrainingData.ID from root to that node). The root node lives at key "".
// Chapters reference their parent repertoire; the repertoireDoc also
// maintains a Chapters[] array as the canonical ordered list.
type chapterDoc struct {
	UUID         string                         `json:"uuid"          bson:"_id"`
	RepertoireID string                         `json:"repertoireId"  bson:"repertoire_id"`
	Name         string                         `json:"name"          bson:"name"`
	TrainAs      string                         `json:"trainAs"       bson:"train_as"`
	EnabledCount int                            `json:"enabledCount"  bson:"enabled_count"`
	UnseenCount  int                            `json:"unseenCount"   bson:"unseen_count"`
	Moves        map[string]domain.TrainingData `json:"moves"         bson:"moves"`
}

// CreateChapter flattens the incoming move tree, inserts the chapter, and
// appends the chapter ID to its parent repertoire's Chapters array.
func (db *DB) CreateChapter(event domain.ChapterEvent) error {
	rep, err := db.ensureRepertoire(event.OwnerID)
	if err != nil {
		return err
	}
	doc := chapterDoc{
		UUID:         event.ChapterID,
		RepertoireID: rep.RepertoireID,
		Name:         event.Name,
		TrainAs:      event.TrainAs,
		EnabledCount: event.EnabledCount,
		UnseenCount:  event.UnseenCount,
		Moves:        flattenTree(event.Root),
	}
	coll := db.db.Collection("chapters")
	if _, err := coll.InsertOne(context.TODO(), doc); err != nil {
		return err
	}
	reps := db.db.Collection("repertoires")
	_, err = reps.UpdateOne(
		context.TODO(),
		bson.M{"_id": rep.RepertoireID},
		bson.M{"$addToSet": bson.M{"chapters": event.ChapterID}},
	)
	return err
}

// AddMoveToChapter adds a single move to a chapter's flattened move map.
// The key is the move's path (parent path + move ID).
// TODO shouldn't have to read entire chapter to put move in there.
// different data structure for moves?
func (db *DB) AddMoveToChapter(event domain.MoveEvent) error {
	coll := db.db.Collection("chapters")
	movePath := event.Path + event.Move.ID

	var doc chapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": event.ChapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	if doc.Moves == nil {
		doc.Moves = make(map[string]domain.TrainingData)
	}
	doc.Moves[movePath] = event.Move

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": event.ChapterID}, doc)
	return err
}

// UpdateTrainingState sets a single user's training card on a specific node.
func (db *DB) UpdateTrainingState(event domain.TrainingUpdatedEvent) error {
	coll := db.db.Collection("chapters")

	var doc chapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": event.ChapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	move, ok := doc.Moves[event.Path]
	if !ok {
		return nil // node not found, nothing to update
	}

	if move.Training == nil {
		move.Training = make(map[string]*domain.CardData)
	}
	move.Training[event.UserSub] = &event.Card
	doc.Moves[event.Path] = move

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": event.ChapterID}, doc)
	return err
}

// DeleteNodeFromChapter removes a node and all its descendants from a
// chapter's flat move map. A descendant is any key that starts with the
// target path.
func (db *DB) DeleteNodeFromChapter(event domain.NodeDeleteEvent) error {
	coll := db.db.Collection("chapters")

	var doc chapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": event.ChapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	for key := range doc.Moves {
		if key == event.Path || (len(key) > len(event.Path) && key[:len(event.Path)] == event.Path) {
			delete(doc.Moves, key)
		}
	}

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": event.ChapterID}, doc)
	return err
}

// SetEnabledRecursive sets the Enabled field on a node and all its
// descendants in the chapter's flat move map. "Descendants" are entries
// whose key starts with the target path.
func (db *DB) SetEnabledRecursive(chapterID string, path string, enabled bool) error {
	coll := db.db.Collection("chapters")

	var doc chapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": chapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	for key, move := range doc.Moves {
		if key == path || (len(key) > len(path) && key[:len(path)] == path) {
			move.Enabled = enabled
			doc.Moves[key] = move
		}
	}

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": chapterID}, doc)
	return err
}

// FetchChaptersByOwner returns every chapter belonging to a user's
// repertoire. Uses the repertoire doc as the source of truth — chapters
// whose IDs appear in rep.Chapters are fetched in one $in query.
func (db *DB) FetchChaptersByOwner(ownerID string) ([]domain.ChapterTreeResponse, error) {
	rep, err := db.ensureRepertoire(ownerID)
	if err != nil {
		return nil, err
	}
	chapters := make([]domain.ChapterTreeResponse, 0)
	if len(rep.Chapters) == 0 {
		return chapters, nil
	}
	coll := db.db.Collection("chapters")
	cursor, err := coll.Find(context.TODO(), bson.M{"_id": bson.M{"$in": rep.Chapters}})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(context.TODO())

	for cursor.Next(context.TODO()) {
		var doc chapterDoc
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		chapters = append(chapters, domain.ChapterTreeResponse{
			UUID:         doc.UUID,
			RepertoireID: doc.RepertoireID,
			Name:         doc.Name,
			TrainAs:      doc.TrainAs,
			UnseenCount:  doc.UnseenCount,
			EnabledCount: doc.EnabledCount,
			Root:         buildTree(doc.Moves),
		})
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return chapters, nil
}

// ReadChapterAsTree fetches a chapter and rebuilds the move tree from the
// flat map. Each key in the Moves map is an id-path: the concatenation of
// each node's TrainingData.ID from root to that node. Since each ID is a
// fixed-length 2-char string (from scalachessCharPair), the parent of
// path P is P[:len(P)-2].
// TODO should include "flat"
func (db *DB) ReadChapterAsTree(chapterID string) (*domain.ChapterTreeResponse, error) {
	coll := db.db.Collection("chapters")
	var doc chapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": chapterID}).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	return &domain.ChapterTreeResponse{
		UUID:         doc.UUID,
		RepertoireID: doc.RepertoireID,
		Name:         doc.Name,
		TrainAs:      doc.TrainAs,
		UnseenCount:  doc.UnseenCount,
		EnabledCount: doc.EnabledCount,
		Root:         buildTree(doc.Moves),
	}, nil
}

// flattenTree walks a ChapterTreeNode tree and produces a flat
// path->TrainingData map. Each node's key is parentPath + node.Data.ID
// (root is always "").
func flattenTree(root domain.ChapterTreeNode) map[string]domain.TrainingData {
	moves := make(map[string]domain.TrainingData)
	var walk func(node domain.ChapterTreeNode, path string)
	walk = func(node domain.ChapterTreeNode, path string) {
		moves[path] = node.Data
		for _, child := range node.Children {
			walk(child, path+child.Data.ID)
		}
	}
	walk(root, "")
	return moves
}

// buildTree reconstructs a tree of ChapterTreeNode from a flat
// path->TrainingData map. Paths are sorted by length so parents are
// always created before children.
func buildTree(moves map[string]domain.TrainingData) domain.ChapterTreeNode {
	paths := make([]string, 0, len(moves))
	for p := range moves {
		paths = append(paths, p)
	}
	sort.Slice(paths, func(i, j int) bool {
		return len(paths[i]) < len(paths[j])
	})

	nodeMap := make(map[string]*domain.ChapterTreeNode, len(moves))

	rootData := moves[""]
	root := domain.ChapterTreeNode{Data: rootData, Children: []domain.ChapterTreeNode{}}
	nodeMap[""] = &root

	for _, p := range paths {
		if p == "" {
			continue
		}
		data := moves[p]
		node := domain.ChapterTreeNode{Data: data, Children: []domain.ChapterTreeNode{}}

		parentPath := p[:len(p)-2]
		parent, ok := nodeMap[parentPath]
		if !ok {
			parent = &root
		}
		parent.Children = append(parent.Children, node)
		nodeMap[p] = &parent.Children[len(parent.Children)-1]
	}

	return root
}
