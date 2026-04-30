package store

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

// Session is a server-side authenticated session record.
type Session struct {
	SessionID string    `bson:"_id"        json:"sessionId"`
	UserID    string    `bson:"user_id"    json:"userId"`
	CreatedAt time.Time `bson:"created_at" json:"createdAt"`
	ExpiresAt time.Time `bson:"expires_at" json:"expiresAt"`
}

// CreateSession persists a new session bound to a user. The caller owns
// session-id generation so the auth package can keep crypto-random
// concerns in one place.
// TODO what if we already have a session
func (db *DB) CreateSession(id string, userID string) (Session, error) {
	now := time.Now().UTC()
	sess := Session{
		SessionID: id,
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(30 * 24 * time.Hour),
	}
	coll := db.db.Collection("sessions")
	if _, err := coll.InsertOne(context.TODO(), sess); err != nil {
		return Session{}, err
	}
	return sess, nil
}

// FetchSession returns the session for the given id if it exists and has
// not expired. A nil session with nil error means "not found or expired".
// TODO session invalidation?
func (db *DB) FetchSession(sessionID string) (*Session, error) {
	coll := db.db.Collection("sessions")
	var sess Session
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

func (db *DB) DeleteSession(sessionID string) error {
	coll := db.db.Collection("sessions")
	_, err := coll.DeleteOne(context.TODO(), bson.M{"_id": sessionID})
	return err
}
