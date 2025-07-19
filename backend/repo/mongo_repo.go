package repo

import (
	"context"

	"github.com/jacokyle01/chessrepeat/backend/model"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoRepo struct {
	coll *mongo.Collection
}

func NewMongoRepo(coll *mongo.Collection) *MongoRepo {
	return &MongoRepo{coll}
}

// func (r *MongoRepo) Save(game *model.RepertoireEntry) error {
// 	opts := options.Replace().SetUpsert(true)
// 	_, err := r.coll.ReplaceOne(context.TODO(), bson.M{"_id": game.ID}, game, opts)
// 	return err
// }

func (r *MongoRepo) GetByID(id string) (*model.RepertoireEntry, error) {
	var game model.RepertoireEntry
	err := r.coll.FindOne(context.TODO(), bson.M{"_id": id}).Decode(&game)
	if err != nil {
		return nil, err
	}
	return &game, nil
}

func (r *MongoRepo) Create(game *model.RepertoireEntry) error {
	_, err := r.coll.InsertOne(context.TODO(), game)
	return err
}

func (r *MongoRepo) Save(game *model.RepertoireEntry) error {
	opts := options.Replace().SetUpsert(true)
	_, err := r.coll.ReplaceOne(
		context.TODO(),
		bson.M{"_id": game.ID},
		game,
		opts,
	)
	return err
}


func (r *MongoRepo) LoadById(id string) (*model.RepertoireEntry, error) {
	var game model.RepertoireEntry
	err := r.coll.FindOne(context.TODO(), bson.M{"_id": id}).Decode(&game)
	return &game, err
}

func (r *MongoRepo) DeleteById(id string) error {
	_, err := r.coll.DeleteOne(context.TODO(), bson.M{"_id": id})
	return err
}
