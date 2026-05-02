package store

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"time"

	"chessrepeat/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

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

func newRepertoireID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// ensureRepertoire returns the caller's repertoire doc, creating one if
// the user hasn't had a repertoire provisioned yet. Exactly one doc per
// user (by owner_id) is maintained.
func (db *DB) ensureRepertoire(ownerID string) (*repertoireDoc, error) {
	coll := db.db.Collection("repertoires")
	var rep repertoireDoc
	err := coll.FindOne(context.TODO(), bson.M{"owner_id": ownerID}).Decode(&rep)
	if err == nil {
		return &rep, nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, err
	}
	id, err := newRepertoireID()
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

// AddCollaborator appends the user to the owner's repertoire. $addToSet
// is idempotent so POSTing twice is a no-op.
func (db *DB) AddCollaborator(ownerID string, collaboratorID string) error {
	if _, err := db.ensureRepertoire(ownerID); err != nil {
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

func (db *DB) RemoveCollaborator(ownerID string, collaboratorID string) error {
	coll := db.db.Collection("repertoires")
	_, err := coll.UpdateOne(
		context.TODO(),
		bson.M{"owner_id": ownerID},
		bson.M{"$pull": bson.M{"collaborators": collaboratorID}},
	)
	return err
}

// FetchOutgoingCollaborators returns the users I have added as
// collaborators on my repertoire.
func (db *DB) FetchOutgoingCollaborators(ownerID string) ([]domain.CollaboratorView, error) {
	rep, err := db.ensureRepertoire(ownerID)
	if err != nil {
		return nil, err
	}
	return db.resolveUsersToViews(rep.Collaborators)
}

// FetchIncomingCollaborators returns the owners of repertoires that have
// me listed as a collaborator.
func (db *DB) FetchIncomingCollaborators(userID string) ([]domain.CollaboratorView, error) {
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
	return db.resolveUsersToViews(ownerIDs)
}

// CanViewRepertoire returns true if viewer is the owner or a collaborator
// on the owner's repertoire. Drives the /repertoire?owner= auth check.
func (db *DB) CanViewRepertoire(ownerID string, viewerID string) (bool, error) {
	if ownerID == viewerID {
		return true, nil
	}
	rep, err := db.ensureRepertoire(ownerID)
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

// CanCollaborateOnRepertoire returns true if userID may write to the
// repertoire owned by ownerID — i.e., is the owner or has been added as
// a collaborator. Used by chapter_created (which has no existing chapter
// id to resolve), and by CanCollaborateOnChapter once it has chased the
// chapter back to its owning repertoire.
//
// Currently identical to CanViewRepertoire; kept as its own function so
// a future read-only collaborator role can diverge here without
// loosening the view path.
func (db *DB) CanCollaborateOnRepertoire(ownerID, userID string) (bool, error) {
	return db.CanViewRepertoire(ownerID, userID)
}

// CanCollaborateOnChapter returns true if userID may mutate the chapter
// identified by chapterID. The check is anchored on the chapter's own
// repertoire_id (not the WebSocket room), so a client cannot bypass
// authz by joining one room and submitting a chapterId from another:
// they're authorized if and only if they own, or have been added as a
// collaborator on, the repertoire that actually contains the chapter.
//
// A missing chapter returns (false, nil) so callers can treat "not
// found" the same as "forbidden" without leaking which one it was.
func (db *DB) CanCollaborateOnChapter(chapterID, userID string) (bool, error) {
	chColl := db.db.Collection("chapters")
	var ch struct {
		RepertoireID string `bson:"repertoire_id"`
	}
	err := chColl.FindOne(context.TODO(), bson.M{"_id": chapterID}).Decode(&ch)
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	repColl := db.db.Collection("repertoires")
	var rep repertoireDoc
	err = repColl.FindOne(context.TODO(), bson.M{"_id": ch.RepertoireID}).Decode(&rep)
	if err == mongo.ErrNoDocuments {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if rep.OwnerID == userID {
		return true, nil
	}
	for _, c := range rep.Collaborators {
		if c == userID {
			return true, nil
		}
	}
	return false, nil
}
