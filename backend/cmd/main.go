package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jacokyle01/chessrepeat-backend/api"
	"github.com/jacokyle01/chessrepeat-backend/internal"
	"github.com/jacokyle01/chessrepeat-backend/repo"
	"github.com/jacokyle01/chessrepeat-backend/service"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoURI := "mongodb://localhost:27017"
	clientOpts := options.Client().ApplyURI(mongoURI)
	//TODO are we not properly handling a cass where mongoDB isnt running? 
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Disconnect(ctx)

	collection := client.Database("chessdb").Collection("games")
	repo := repo.NewMongoRepo(collection)
	sessions := internal.NewSessionStore()
	svc := service.NewGameService(sessions, repo)
	wsHandler := api.HandleWS(svc)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: wsHandler,
	}

	go func() {
		log.Println("Starting WebSocket server on :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("ListenAndServe:", err)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("Shutting down server...")
	ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelShutdown()

	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatal("Server Shutdown:", err)
	}

	log.Println("Server gracefully stopped")
}
