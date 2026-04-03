package main

import "net/http"
import "log"
import "fmt"

func main() {
  fmt.Println("starting server...")

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

