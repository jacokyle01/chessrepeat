package main

import "net/http"
import "encoding/json"
import "log"
import "os"
import "database/sql"
import "github.com/go-sql-driver/mysql"
import "github.com/google/uuid"
import "github.com/joho/godotenv"

func connectDb() *sql.DB {
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
	var err error
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

func isValidName(name string) bool {
	return name != ""
}

func isValidTrainAs(trainAs string) bool {
	return trainAs == "white" || trainAs == "black"
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func main() {

	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
  
	log.Println("starting server...")

	var db = connectDb()
	cs := newChatServer()

	
	http.HandleFunc("/repertoire/{id}", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			unparsedId := r.PathValue("id")
			var id, err = uuid.Parse(unparsedId)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			type repertoireJson struct {
				RepertoireId *string `json:"id"`
				Name         *string `json:"name"`
				TrainAs      *string `json:"trainAs"`
			}

			log.Println("fetching repertoire for id:", id)

			row := db.QueryRow("SELECT * FROM repertoire WHERE repertoire_id=?", id)

			var repertoire repertoireJson
			err = row.Scan(&repertoire.RepertoireId, &repertoire.Name, &repertoire.TrainAs)
			if err != nil {
				// TODO(ben): make not found 404s
				w.WriteHeader(http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(repertoire)

			w.WriteHeader(http.StatusOK)
		} else if r.Method == "POST" {
			unparsedId := r.PathValue("id")
			var id, err = uuid.Parse(unparsedId)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			type repertoireJson struct {
				Name    *string `json:"name"`
				TrainAs *string `json:"trainAs"`
			}

			decoder := json.NewDecoder(r.Body)
			var repertoire repertoireJson
			err = decoder.Decode(&repertoire)
			if err != nil {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			if !isValidName(*repertoire.Name) {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			if !isValidTrainAs(*repertoire.TrainAs) {
				w.WriteHeader(http.StatusBadRequest)
				return
			}

			log.Println("creating repertoire for id:", id)

			tx, err := db.Begin()
			if err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			stmt, err := tx.Prepare("INSERT INTO repertoire(repertoire_id, name, train_as) VALUES (?, ?, ?)")
			if err != nil {
				tx.Rollback()
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			_, err = stmt.Exec(id, *repertoire.Name, *repertoire.TrainAs)
			if err != nil {
				tx.Rollback()
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			err = tx.Commit()
			if err != nil {
				tx.Rollback()
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			stmt.Close()

			w.WriteHeader(http.StatusOK)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	http.Handle("/subscribe", cs)
	http.Handle("/publish", cs)

	log.Println("server ready to serve! http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", withCORS(http.DefaultServeMux)))
	
}
