package main

import "os"
import "log"
import "database/sql"
import "github.com/google/uuid"
import "github.com/go-sql-driver/mysql"
import "github.com/joho/godotenv"

type repertoireJson struct {
	RepertoireId string `json:"id"`
	Name         string `json:"name"`
	TrainAs      string `json:"trainAs"`
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
	row := db.QueryRow("SELECT * FROM repertoire WHERE repertoire_id=?", id)
	var repertoire repertoireJson
	err := row.Scan(&repertoire.RepertoireId, &repertoire.Name, &repertoire.TrainAs)
	return repertoire, err
}

func createRepertoire(db *sql.DB, repertoire repertoireJson) (repertoireJson, error) {
	tx, err := db.Begin()
	if err != nil {
		return repertoire, err
	}
	stmt, err := tx.Prepare("INSERT INTO repertoire(repertoire_id, name, train_as) VALUES (?, ?, ?)")
	if err != nil {
		tx.Rollback()
		return repertoire, err
	}
	_, err = stmt.Exec(repertoire.RepertoireId, repertoire.Name, repertoire.TrainAs)
	if err != nil {
		tx.Rollback()
		return repertoire, err
	}
	err = tx.Commit()
	if err != nil {
		tx.Rollback()
		return repertoire, err
	}
	stmt.Close()
	return repertoire, err
}
