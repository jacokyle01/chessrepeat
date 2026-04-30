package store

import (
	"context"

	"chessrepeat/internal/domain"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

func (db *DB) UpsertUser(user domain.User) error {
	coll := db.db.Collection("users")
	opts := options.Replace().SetUpsert(true)
	_, err := coll.ReplaceOne(context.TODO(), bson.M{"_id": user.TokenID}, user, opts)
	return err
}

func (db *DB) FetchUser(tokenID string) (*domain.User, error) {
	coll := db.db.Collection("users")
	var user domain.User
	err := coll.FindOne(context.TODO(), bson.M{"_id": tokenID}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (db *DB) FetchUserByUsername(username string) (*domain.User, error) {
	coll := db.db.Collection("users")
	var user domain.User
	err := coll.FindOne(context.TODO(), bson.M{"username": username}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// resolveUsersToViews fetches users by id and projects them to the
// CollaboratorView shape. Callers in the repertoire layer use this when
// converting collaborator id lists into something safe to send to the
// client.
func (db *DB) resolveUsersToViews(userIDs []string) ([]domain.CollaboratorView, error) {
	out := make([]domain.CollaboratorView, 0, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	coll := db.db.Collection("users")
	cursor, err := coll.Find(context.TODO(), bson.M{"_id": bson.M{"$in": userIDs}})
	if err != nil {
		return nil, err
	}
	var users []domain.User
	if err := cursor.All(context.TODO(), &users); err != nil {
		return nil, err
	}
	for _, u := range users {
		if u.Username == "" {
			continue
		}
		out = append(out, domain.CollaboratorView{Username: u.Username, Picture: u.Picture})
	}
	return out, nil
}
