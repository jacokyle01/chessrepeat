package store

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Schema lives in backend/schema.sql — apply it once before booting.

// DB wraps a pgx connection pool.
type DB struct {
	pool *pgxpool.Pool
}

// Connect dials Postgres and pings to fail-fast on bad config. The caller
// is responsible for loading any .env file before invoking this.
func Connect(url string) *DB {
	log.Println("connecting to Postgres...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		log.Fatal(err)
	}
	if err := pool.Ping(ctx); err != nil {
		log.Fatal(err)
	}

	log.Println("connected to Postgres!")
	return &DB{pool: pool}
}
