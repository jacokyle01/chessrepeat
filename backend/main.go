package main

import "net/http"
import "log"
import "fmt"
import "os"
import "database/sql"
import "github.com/go-sql-driver/mysql"

func connectDb() *sql.DB {
  fmt.Println("fetching config...")

  dbuser := os.Getenv("DBUSER")
  dbpass := os.Getenv("DBPASS")

  cfg := mysql.NewConfig()
  cfg.User = dbuser
  cfg.Passwd = dbpass
  cfg.Net = "unix"
  cfg.Addr = "/tmp/mysql.sock"
  cfg.DBName = "chessrepeat"

  fmt.Println("setting up connection...")

  var db *sql.DB
  var err error
  db, err = sql.Open("mysql", cfg.FormatDSN())
  if err != nil {
    log.Fatal(err)
  }

  fmt.Println("testing connection...")

  pingErr := db.Ping()
  if pingErr != nil {
    log.Fatal(pingErr)
  }

  fmt.Println("connected to database!")

  return db;
}

func main() {
  fmt.Println("starting server...")

  var _ = connectDb();

  http.HandleFunc("/{id}", func(w http.ResponseWriter, r *http.Request) {
    if (r.Method == "GET") {
      id := r.PathValue("id")
      fmt.Println("fetching repertoire for id:", id)
      w.WriteHeader(http.StatusOK)
    } else {
      w.WriteHeader(http.StatusMethodNotAllowed)
    }
  })

  fmt.Println("server ready to serve! http://localhost:8080")

  log.Fatal(http.ListenAndServe(":8080", nil))
}

