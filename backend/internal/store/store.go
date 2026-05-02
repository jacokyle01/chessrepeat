package store

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// DB wraps the Mongo client and the named database we operate on.
type DB struct {
	client *mongo.Client
	db     *mongo.Database
}

// Connect dials Mongo and pings to fail-fast on bad config. The caller
// is responsible for loading any .env file before invoking this.
func Connect(uri, dbName string) *DB {
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

	return &DB{
		client: client,
		db:     client.Database(dbName),
	}
}
