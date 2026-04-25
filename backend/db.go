package main

import (
	"context"
	"log"
	"os"
	"sort"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ── document types ──

// Users are identified by their Google OAuth subject. Their repertoire is
// tracked in a sibling `repertoires` collection (see repertoireDoc) — the
// repertoire carries chapter pointers and the list of collaborators.
type userJson struct {
	TokenID  string `json:"tokenId"            bson:"_id"`
	Username string `json:"username,omitempty" bson:"username,omitempty"`
	Email    string `json:"email"              bson:"email"`
	Picture  string `json:"picture"            bson:"picture"`
}

// sessionDoc is a server-side authenticated session record.
type sessionDoc struct {
	SessionID string    `bson:"_id"        json:"sessionId"`
	UserID    string    `bson:"user_id"    json:"userId"`
	CreatedAt time.Time `bson:"created_at" json:"createdAt"`
	ExpiresAt time.Time `bson:"expires_at" json:"expiresAt"`
}

// ChapterDoc is the MongoDB document for a chapter.
// Moves is a flat map keyed by id-path (concatenation of each ancestor's
// TrainingData.ID from root to that node).  The root node lives at key "".
// Chapters reference their parent repertoire; the repertoireDoc also
// maintains a Chapters[] array as the canonical ordered list.
type ChapterDoc struct {
	UUID         string                  `json:"uuid"          bson:"_id"`
	RepertoireID string                  `json:"repertoireId"  bson:"repertoire_id"`
	Name         string                  `json:"name"          bson:"name"`
	TrainAs      string                  `json:"trainAs"       bson:"train_as"`
	EnabledCount int                     `json:"enabledCount" bson:"enabled_count"`
	UnseenCount  int                     `json:"unseenCount"  bson:"unseen_count"`
	Moves        map[string]TrainingData `json:"moves"        bson:"moves"`
}

// ChapterTreeNode is used when rebuilding the tree from the flat map.
type ChapterTreeNode struct {
	Data     TrainingData      `json:"data"`
	Children []ChapterTreeNode `json:"children"`
}

// ChapterTreeResponse is the JSON sent to clients when reading a chapter.
//TODO does this need to be duplicated?
type ChapterTreeResponse struct {
	UUID         string          `json:"uuid"`
	RepertoireID string          `json:"repertoireId"`
	Name         string          `json:"name"`
	TrainAs      string          `json:"trainAs"`
	EnabledCount int					 `json:"enabledCount"`
	UnseenCount  int					 `json:"unseenCount"`
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

// repertoireDoc is the top-level container for one user's repertoire. It
// holds pointers to the user's chapters and a list of other users granted
// read access (collaborators). There is exactly one repertoire per user —
// the schema keeps a separate _id so we can extend to multiple
// repertoires per user later without reshaping the chapter collection.
type repertoireDoc struct {
	RepertoireID  string    `bson:"_id"           json:"repertoireId"`
	OwnerID       string    `bson:"owner_id"      json:"ownerId"`
	Chapters      []string  `bson:"chapters"      json:"chapters"`
	Collaborators []string  `bson:"collaborators" json:"collaborators"`
	CreatedAt     time.Time `bson:"created_at"    json:"createdAt"`
}

// ── sessions ──

// createSession issues a new session for the given user and persists it.
// TODO what if we already have a sesison
func createSession(db *DB, userID string) (sessionDoc, error) {
	id, err := newSessionID()
	if err != nil {
		return sessionDoc{}, err
	}
	now := time.Now().UTC()
	sess := sessionDoc{
		SessionID: id,
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(30 * 24 * time.Hour),
	}
	coll := db.db.Collection("sessions")
	if _, err := coll.InsertOne(context.TODO(), sess); err != nil {
		return sessionDoc{}, err
	}
	return sess, nil
}

// fetchSession returns the session for the given id if it exists and has not
// expired. A nil session with nil error means "not found or expired".
// TODO session invalidation?
func fetchSession(db *DB, sessionID string) (*sessionDoc, error) {
	coll := db.db.Collection("sessions")
	var sess sessionDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": sessionID}).Decode(&sess)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if time.Now().UTC().After(sess.ExpiresAt) {
		return nil, nil
	}
	return &sess, nil
}

func deleteSession(db *DB, sessionID string) error {
	coll := db.db.Collection("sessions")
	_, err := coll.DeleteOne(context.TODO(), bson.M{"_id": sessionID})
	return err
}

// ── users ──

func upsertUser(db *DB, user userJson) error {
	coll := db.db.Collection("users")
	opts := options.Replace().SetUpsert(true)
	_, err := coll.ReplaceOne(context.TODO(), bson.M{"_id": user.TokenID}, user, opts)
	return err
}

func fetchUser(db *DB, tokenID string) (*userJson, error) {
	coll := db.db.Collection("users")
	var user userJson
	err := coll.FindOne(context.TODO(), bson.M{"_id": tokenID}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func fetchUserByUsername(db *DB, username string) (*userJson, error) {
	coll := db.db.Collection("users")
	var user userJson
	err := coll.FindOne(context.TODO(), bson.M{"username": username}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// ── repertoires ──

// CollaboratorView is the per-side shape returned to the client. Usernames
// + pictures are resolved against the users collection at read time.
type CollaboratorView struct {
	Username string `json:"username"`
	Picture  string `json:"picture,omitempty"`
}

// ensureRepertoire returns the caller's repertoire doc, creating one if
// the user hasn't had a repertoire provisioned yet. Exactly one doc per
// user (by owner_id) is maintained.
func ensureRepertoire(db *DB, ownerID string) (*repertoireDoc, error) {
	coll := db.db.Collection("repertoires")
	var rep repertoireDoc
	err := coll.FindOne(context.TODO(), bson.M{"owner_id": ownerID}).Decode(&rep)
	if err == nil {
		return &rep, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, err
	}
	id, err := newSessionID()
	if err != nil {
		return nil, err
	}
	rep = repertoireDoc{
		RepertoireID:  id,
		OwnerID:       ownerID,
		Chapters:      []string{},
		Collaborators: []string{},
		CreatedAt:     time.Now().UTC(),
	}
	if _, err := coll.InsertOne(context.TODO(), rep); err != nil {
		return nil, err
	}
	return &rep, nil
}

// addCollaborator appends the user to the owner's repertoire. $addToSet
// is idempotent so POSTing twice is a no-op.
func addCollaborator(db *DB, ownerID string, collaboratorID string) error {
	if _, err := ensureRepertoire(db, ownerID); err != nil {
		return err
	}
	coll := db.db.Collection("repertoires")
	_, err := coll.UpdateOne(
		context.TODO(),
		bson.M{"owner_id": ownerID},
		bson.M{"$addToSet": bson.M{"collaborators": collaboratorID}},
	)
	return err
}

func removeCollaborator(db *DB, ownerID string, collaboratorID string) error {
	coll := db.db.Collection("repertoires")
	_, err := coll.UpdateOne(
		context.TODO(),
		bson.M{"owner_id": ownerID},
		bson.M{"$pull": bson.M{"collaborators": collaboratorID}},
	)
	return err
}

// fetchOutgoingCollaborators returns the users I have added as
// collaborators on my repertoire.
func fetchOutgoingCollaborators(db *DB, ownerID string) ([]CollaboratorView, error) {
	rep, err := ensureRepertoire(db, ownerID)
	if err != nil {
		return nil, err
	}
	return resolveUsersToViews(db, rep.Collaborators)
}

// fetchIncomingCollaborators returns the owners of repertoires that have
// me listed as a collaborator.
func fetchIncomingCollaborators(db *DB, userID string) ([]CollaboratorView, error) {
	coll := db.db.Collection("repertoires")
	cursor, err := coll.Find(context.TODO(), bson.M{"collaborators": userID})
	if err != nil {
		return nil, err
	}
	var reps []repertoireDoc
	if err := cursor.All(context.TODO(), &reps); err != nil {
		return nil, err
	}
	ownerIDs := make([]string, 0, len(reps))
	for _, r := range reps {
		ownerIDs = append(ownerIDs, r.OwnerID)
	}
	return resolveUsersToViews(db, ownerIDs)
}

// canViewRepertoire returns true if viewer is the owner or a collaborator
// on the owner's repertoire. Drives the /repertoire?owner= auth check.
func canViewRepertoire(db *DB, ownerID string, viewerID string) (bool, error) {
	if ownerID == viewerID {
		return true, nil
	}
	rep, err := ensureRepertoire(db, ownerID)
	if err != nil {
		return false, err
	}
	for _, c := range rep.Collaborators {
		if c == viewerID {
			return true, nil
		}
	}
	return false, nil
}

func resolveUsersToViews(db *DB, userIDs []string) ([]CollaboratorView, error) {
	out := make([]CollaboratorView, 0, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	coll := db.db.Collection("users")
	cursor, err := coll.Find(context.TODO(), bson.M{"_id": bson.M{"$in": userIDs}})
	if err != nil {
		return nil, err
	}
	var users []userJson
	if err := cursor.All(context.TODO(), &users); err != nil {
		return nil, err
	}
	for _, u := range users {
		if u.Username == "" {
			continue
		}
		out = append(out, CollaboratorView{Username: u.Username, Picture: u.Picture})
	}
	return out, nil
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

// createChapter flattens the incoming move tree, inserts the chapter, and
// appends the chapter ID to its parent repertoire's Chapters array.
func createChapter(db *DB, event ChapterEvent) error {
	rep, err := ensureRepertoire(db, event.OwnerID)
	if err != nil {
		return err
	}
	doc := ChapterDoc{
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

// addMoveToChapter adds a single move to a chapter's flattened move map.
// The key is the move's path (parent path + move ID).
// TODO shouldn't have to read entire chapter to put move in there.
// different data structure for moves?
func addMoveToChapter(db *DB, event MoveEvent) error {
	coll := db.db.Collection("chapters")
	movePath := event.Path + event.Move.ID

	var doc ChapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": event.ChapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	if doc.Moves == nil {
		doc.Moves = make(map[string]TrainingData)
	}
	doc.Moves[movePath] = event.Move

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": event.ChapterID}, doc)
	return err
}

// updateTrainingState sets a single user's training card on a specific node.
func updateTrainingState(db *DB, event TrainingUpdatedEvent) error {
	coll := db.db.Collection("chapters")

	var doc ChapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": event.ChapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	move, ok := doc.Moves[event.Path]
	if !ok {
		return nil // node not found, nothing to update
	}

	if move.Training == nil {
		move.Training = make(map[string]*CardData)
	}
	move.Training[event.UserSub] = &event.Card
	doc.Moves[event.Path] = move

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": event.ChapterID}, doc)
	return err
}

// deleteNodeFromChapter removes a node and all its descendants from a chapter's
// flat move map.  A descendant is any key that starts with the target path.
func deleteNodeFromChapter(db *DB, event NodeDeleteEvent) error {
	coll := db.db.Collection("chapters")

	var doc ChapterDoc
	err := coll.FindOne(context.TODO(), bson.M{"_id": event.ChapterID}).Decode(&doc)
	if err != nil {
		return err
	}

	// delete the node at `path` and every descendant whose key has `path` as a prefix
	for key := range doc.Moves {
		if key == event.Path || (len(key) > len(event.Path) && key[:len(event.Path)] == event.Path) {
			delete(doc.Moves, key)
		}
	}

	_, err = coll.ReplaceOne(context.TODO(), bson.M{"_id": event.ChapterID}, doc)
	return err
}

// setEnabledRecursive sets the Enabled field on a node and all its descendants
// in the chapter's flat move map.  "Descendants" are entries whose key starts
// with the target path.
func setEnabledRecursive(db *DB, chapterID string, path string, enabled bool) error {
	coll := db.db.Collection("chapters")

	var doc ChapterDoc
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

// fetchChaptersByOwner returns every chapter belonging to a user's
// repertoire. Uses the repertoire doc as the source of truth — chapters
// whose IDs appear in rep.Chapters are fetched in one $in query.
func fetchChaptersByOwner(db *DB, ownerID string) ([]ChapterTreeResponse, error) {
	rep, err := ensureRepertoire(db, ownerID)
	if err != nil {
		return nil, err
	}
	chapters := make([]ChapterTreeResponse, 0)
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
		var doc ChapterDoc
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		chapters = append(chapters, ChapterTreeResponse{
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
//TODO should include "flat" 
func readChapterAsTree(db *DB, chapterID string) (*ChapterTreeResponse, error) {
	doc, err := readChapter(db, chapterID)
	if err != nil || doc == nil {
		return nil, err
	}

	root := buildTree(doc.Moves)

	return &ChapterTreeResponse{
		UUID:         doc.UUID,
		RepertoireID: doc.RepertoireID,
		Name:         doc.Name,
		TrainAs:      doc.TrainAs,
		UnseenCount:  doc.UnseenCount,
		EnabledCount: doc.EnabledCount,
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
