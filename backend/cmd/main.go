package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"github.com/jacokyle01/chessrepeat/backend/api"
	"github.com/jacokyle01/chessrepeat/backend/internal"
	"github.com/jacokyle01/chessrepeat/backend/repo"
	"github.com/jacokyle01/chessrepeat/backend/service"
)

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Continue to actual handler
		next.ServeHTTP(w, r)
	})
}


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
	// wsHandler := api.HandleWS(svc)

	mux := http.NewServeMux()

	

	mux.HandleFunc("/games/add", api.HandleCreateChapter(svc))
	mux.HandleFunc("/games/select", api.HandleSwitchChapter(svc))

	mux.HandleFunc("/ws", api.HandleWebSocket(svc))

	// ✅ Log startup message
	log.Println("Starting HTTP server on :8080")

	handlerWithCORS := withCORS(mux)

	log.Println("Server listening on :8080")
	if err := http.ListenAndServe(":8080", handlerWithCORS); err != nil {
		log.Fatal(err)
	}


	// go func() {
	// 	log.Println("Starting WebSocket server on :8080")
	// 	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
	// 		log.Fatal("ListenAndServe:", err)
	// 	}
	// }()

	// // Graceful shutdown on SIGINT/SIGTERM
	// sigCh := make(chan os.Signal, 1)
	// signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	// <-sigCh

	// log.Println("Shutting down server...")
	// ctxShutdown, cancelShutdown := context.WithTimeout(context.Background(), 5*time.Second)
	// defer cancelShutdown()

	// if err := srv.Shutdown(ctxShutdown); err != nil {
	// 	log.Fatal("Server Shutdown:", err)
	// }

	// log.Println("Server gracefully stopped")
}
