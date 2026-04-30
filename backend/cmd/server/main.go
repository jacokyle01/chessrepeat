package main

import (
	"log"
	"net/http"

	"chessrepeat/internal/api"
	"chessrepeat/internal/store"
	"chessrepeat/internal/ws"
)

func main() {
	log.Println("starting server...")

	db := store.Connect()
	wsServer := ws.NewServer(db)

	mux := http.NewServeMux()
	api.Register(mux, db)
	mux.HandleFunc("/subscribe/{username}", wsServer.SubscribeHandler)

	log.Println("server ready to serve! http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", api.WithCORS(mux)))
}
