package main

import "os"
import "log"
import "database/sql"
import "github.com/google/uuid"
import "github.com/go-sql-driver/mysql"
import "github.com/joho/godotenv"

type repertoireJson struct {
	RepertoireId string `json:"id"`
	OwnerID      string `json:"ownerId"`
	Description  string `json:"description"`
}

func connectDb() *sql.DB {
	var err error
	log.Println("loading .env file...")

	err = godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	log.Println("fetching config...")

	dbuser := os.Getenv("DBUSER")
	dbpass := os.Getenv("DBPASS")

	cfg := mysql.NewConfig()
	cfg.User = dbuser
	cfg.Passwd = dbpass
	cfg.Net = "unix"
	cfg.Addr = "/tmp/mysql.sock"
	cfg.DBName = "chessrepeat"

	log.Println("setting up connection...")

	var db *sql.DB
	db, err = sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		log.Fatal(err)
	}

	log.Println("testing connection...")

	pingErr := db.Ping()
	if pingErr != nil {
		log.Fatal(pingErr)
	}

	log.Println("connected to database!")

	return db
}

func fetchRepertoire(db *sql.DB, id uuid.UUID) (repertoireJson, error) {
	row := db.QueryRow("SELECT repertoire_id, owner_id, description FROM repertoire WHERE repertoire_id=?", id)
	var repertoire repertoireJson
	err := row.Scan(&repertoire.RepertoireId, &repertoire.OwnerID, &repertoire.Description)
	return repertoire, err
}

func createRepertoire(db *sql.DB, repertoire repertoireJson) (repertoireJson, error) {
	_, err := db.Exec(
		"INSERT INTO repertoire(repertoire_id, owner_id, description) VALUES (?, ?, ?)",
		repertoire.RepertoireId, repertoire.OwnerID, repertoire.Description,
	)
	return repertoire, err
}

func createChapter(db *sql.DB, event ChapterEvent) error {
	_, err := db.Exec(
		`INSERT INTO chapter (chapter_id, repertoire_id) VALUES (?, ?)`,
		event.ChapterID, event.RepertoireID,
	)
	return err
}

func createMove(db *sql.DB, event MoveEvent) error {
	_, err := db.Exec(
		`INSERT INTO move (move_id, chapter_id, prev_moves, san) VALUES (?, ?, ?, ?)`,
		event.Move.ID, event.ChapterID, event.Path, event.Move.SAN,
	)
	return err
}

type userJson struct {
	TokenID string `json:"tokenId"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Picture string `json:"picture"`
}

type loginResponse struct {
	User       userJson         `json:"user"`
	Repertoire *repertoireJson  `json:"repertoire"`
}

func upsertUser(db *sql.DB, user userJson) error {
	_, err := db.Exec(
		`INSERT INTO user (token_id, name, email, picture)
		 VALUES (?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email), picture=VALUES(picture)`,
		user.TokenID, user.Name, user.Email, user.Picture,
	)
	return err
}

func fetchRepertoireByUser(db *sql.DB, tokenID string) (*repertoireJson, error) {
	row := db.QueryRow("SELECT repertoire_id, owner_id, description FROM repertoire WHERE owner_id=?", tokenID)
	var repertoire repertoireJson
	err := row.Scan(&repertoire.RepertoireId, &repertoire.OwnerID, &repertoire.Description)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &repertoire, err
}

func createRepertoireForUser(db *sql.DB, tokenID string) (repertoireJson, error) {
	id := uuid.New().String()
	repertoire := repertoireJson{
		RepertoireId: id,
		OwnerID:      tokenID,
		Description:  "",
	}
	_, err := db.Exec(
		"INSERT INTO repertoire(repertoire_id, owner_id, description) VALUES (?, ?, ?)",
		repertoire.RepertoireId, repertoire.OwnerID, repertoire.Description,
	)
	return repertoire, err
}
