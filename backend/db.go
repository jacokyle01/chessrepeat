package main

import (
	"context"
	"log"
	"os"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ── document types ──

type repertoireJson struct {
	RepertoireId string `json:"id"          bson:"_id"`
	OwnerID      string `json:"ownerId"     bson:"owner_id"`
	Description  string `json:"description" bson:"description"`
}

type userJson struct {
	TokenID string `json:"tokenId" bson:"_id"`
	Name    string `json:"name"    bson:"name"`
	Email   string `json:"email"   bson:"email"`
	Picture string `json:"picture" bson:"picture"`
}

type loginResponse struct {
	User       userJson        `json:"user"`
	Repertoire *repertoireJson `json:"repertoire"`
}

// ChapterDoc is the MongoDB document for a chapter.
// Moves is a flat map keyed by id-path (concatenation of each ancestor's
// TrainingData.ID from root to that node).  The root node lives at key "".
type ChapterDoc struct {
	ChapterID    string                  `json:"chapterId"    bson:"_id"`
	RepertoireID string                  `json:"repertoireId" bson:"repertoire_id"`
	Name         string                  `json:"name"         bson:"name"`
	TrainAs      string                  `json:"trainAs"      bson:"train_as"`
	Moves        map[string]TrainingData `json:"moves"        bson:"moves"`
}

// ChapterTreeNode is used when rebuilding the tree from the flat map.
type ChapterTreeNode struct {
	Data     TrainingData       `json:"data"`
	Children []ChapterTreeNode  `json:"children"`
}

// ChapterTreeResponse is the JSON sent to clients when reading a chapter.
type ChapterTreeResponse struct {
	ChapterID    string          `json:"chapterId"`
	RepertoireID string          `json:"repertoireId"`
	Name         string          `json:"name"`
	TrainAs      string          `json:"trainAs"`
	Root         ChapterTreeNode `json:"root"`
}

// ── connection ──

type DB struct {
	client *mongo.Client
	db     *mongo.Database
}

func connectDb() *DB {
	log.Println("loading .env file...")
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error loading .env file")
	}

	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}

	log.Println("connecting to MongoDB...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatal(err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatal(err)
	}

	log.Println("connected to MongoDB!")

	dbName := os.Getenv("MONGO_DB")
	if dbName == "" {
		dbName = "chessrepeat"
	}

	return &DB{
		client: client,
		db:     client.Database(dbName),
	}
}

// ── users ──

func upsertUser(db *DB, user userJson) error {
	coll := db.db.Collection("users")
	opts := options.Replace().SetUpsert(true)
	_, err := coll.ReplaceOne(context.TODO(), bson.M{"_id": user.TokenID}, user, opts)
	return err
}

// ── repertoires ──

func fetchRepertoire(db *DB, id string) (repertoireJson, error) {
	coll := db.db.Collection("repertoires")
	var rep repertoireJson
	err := coll.FindOne(context.TODO(), bson.M{"_id": id}).Decode(&rep)
	return rep, err
}

func fetchRepertoireByUser(db *DB, tokenID string) (*repertoireJson, error) {
	coll := db.db.Collection("repertoires")
	var rep repertoireJson
	err := coll.FindOne(context.TODO(), bson.M{"owner_id": tokenID}).Decode(&rep)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rep, nil
}

func createRepertoire(db *DB, rep repertoireJson) (repertoireJson, error) {
	coll := db.db.Collection("repertoires")
	_, err := coll.InsertOne(context.TODO(), rep)
	return rep, err
}

func createRepertoireForUser(db *DB, tokenID string) (repertoireJson, error) {
	rep := repertoireJson{
		RepertoireId: uuid.New().String(),
		OwnerID:      tokenID,
		Description:  "",
	}
	return createRepertoire(db, rep)
}

// ── chapters ──

// flattenTree walks a ChapterTreeNode tree and produces a flat path->TrainingData map.
// Each node's key is parentPath + node.Data.ID (root is always "").
func flattenTree(root ChapterTreeNode) map[string]TrainingData {
	moves := make(map[string]TrainingData)
	var walk func(node ChapterTreeNode, path string)
	walk = func(node ChapterTreeNode, path string) {
		moves[path] = node.Data
		for _, child := range node.Children {
			walk(child, path+child.Data.ID)
		}
	}
	walk(root, "")
	return moves
}

// createChapter flattens the incoming move tree and inserts the chapter document.
func createChapter(db *DB, event ChapterEvent) error {
	doc := ChapterDoc{
		ChapterID:    event.ChapterID,
		RepertoireID: event.RepertoireID,
		Name:         event.Name,
		TrainAs:      event.TrainAs,
		Moves:        flattenTree(event.Root),
	}
	coll := db.db.Collection("chapters")
	_, err := coll.InsertOne(context.TODO(), doc)
	return err
}

// addMoveToChapter adds a single move to a chapter's flattened move map.
// The key is the move's path (parent path + move ID).
func addMoveToChapter(db *DB, event MoveEvent) error {
	coll := db.db.Collection("chapters")
	movePath := event.Path + event.Move.ID
	fieldKey := "moves." + movePath
	_, err := coll.UpdateByID(
		context.TODO(),
		event.ChapterID,
		bson.M{"$set": bson.M{fieldKey: event.Move}},
	)
	return err
}

// readChapter fetches the raw chapter document.
func readChapter(db *DB, chapterID string) (*ChapterDoc, error) {
	coll := db.db.Collection("chapters")
	var doc ChapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": chapterID}).Decode(&doc)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &doc, nil
}

// readChapterAsTree fetches a chapter and rebuilds the move tree from the flat map.
// Each key in the Moves map is an id-path: the concatenation of each node's
// TrainingData.ID from root to that node.  Since each ID is a fixed-length
// 2-char string (from scalachessCharPair), the parent of path P is P[:len(P)-2].
func readChapterAsTree(db *DB, chapterID string) (*ChapterTreeResponse, error) {
	doc, err := readChapter(db, chapterID)
	if err != nil || doc == nil {
		return nil, err
	}

	root := buildTree(doc.Moves)

	return &ChapterTreeResponse{
		ChapterID:    doc.ChapterID,
		RepertoireID: doc.RepertoireID,
		Name:         doc.Name,
		TrainAs:      doc.TrainAs,
		Root:         root,
	}, nil
}

// buildTree reconstructs a tree of ChapterTreeNode from a flat path->TrainingData map.
// Paths are sorted by length so parents are always created before children.
func buildTree(moves map[string]TrainingData) ChapterTreeNode {
	// collect and sort paths shortest-first
	paths := make([]string, 0, len(moves))
	for p := range moves {
		paths = append(paths, p)
	}
	sort.Slice(paths, func(i, j int) bool {
		return len(paths[i]) < len(paths[j])
	})

	// map from path -> pointer to node in the tree
	nodeMap := make(map[string]*ChapterTreeNode, len(moves))

	// root must exist at ""
	rootData := moves[""]
	root := ChapterTreeNode{Data: rootData, Children: []ChapterTreeNode{}}
	nodeMap[""] = &root

	for _, p := range paths {
		if p == "" {
			continue
		}
		data := moves[p]
		node := ChapterTreeNode{Data: data, Children: []ChapterTreeNode{}}

		parentPath := p[:len(p)-2]
		parent, ok := nodeMap[parentPath]
		if !ok {
			// orphan — attach to root as fallback
			parent = &root
		}
		parent.Children = append(parent.Children, node)
		// pointer to the just-appended child
		nodeMap[p] = &parent.Children[len(parent.Children)-1]
	}

	return root
}
