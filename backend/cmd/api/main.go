package main

import (
  "context"
  "log"
  "net/http"
  "os"
  "strings"

  "github.com/go-chi/chi/v5"
  "github.com/go-chi/cors"
  "github.com/jackc/pgx/v5/pgxpool"

  "github.com/jacokyle01/chessrepeat/backend/internal/auth"
  "github.com/jacokyle01/chessrepeat/backend/internal/httpx"
  "github.com/jacokyle01/chessrepeat/backend/internal/store"
)

func mustEnv(k string) string {
  v := strings.TrimSpace(os.Getenv(k))
  if v == "" {
    log.Fatalf("missing env var %s", k)
  }
  return v
}

func main() {
  dbURL := mustEnv("DATABASE_URL")
  googleClientID := mustEnv("GOOGLE_CLIENT_ID")
  frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
  if frontendOrigin == "" {
    frontendOrigin = "http://localhost:5173"
  }

  db, err := pgxpool.New(context.Background(), dbURL)
  if err != nil {
    log.Fatal(err)
  }
  defer db.Close()

  sessions := &auth.SessionStore{DB: db}
  chapterStore := &store.ChapterStore{DB: db}

  authHandlers := &httpx.AuthHandlers{
    DB: db, Sessions: sessions,
    GoogleClientID: googleClientID,
    CookieSecure:   false, // localhost
  }
  chapterHandlers := &httpx.ChapterHandlers{Chapters: chapterStore}

  r := chi.NewRouter()

  // CORS for localhost + cookies
  r.Use(cors.Handler(cors.Options{
    AllowedOrigins:   []string{frontendOrigin},
    AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
    AllowCredentials: true,
    MaxAge:           300,
  }))

  r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })

  // Create cookie session from frontend's Google ID token
  r.Post("/api/auth/session", authHandlers.CreateSession)

  // Protected chapter routes (cookie-based)
  r.Group(func(pr chi.Router) {
    pr.Use(httpx.WithAuth(sessions))
    pr.Post("/api/chapters", chapterHandlers.Create) // MVP: Create only
  })

  log.Println("listening on :8080")
  log.Fatal(http.ListenAndServe(":8080", r))
}
