package store

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// DB wraps the Mongo client and the named database we operate on.
type DB struct {
	client *mongo.Client
	db     *mongo.Database
}

// Connect loads .env, dials Mongo, and pings to fail-fast on bad config.
func Connect() *DB {
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
