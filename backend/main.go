package main

import "net/http"
import "fmt"

func main() {
  fmt.Println("starting server...")

  http.HandleFunc("/bar", func(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
  })

  fmt.Println("server ready to serve!")
}

