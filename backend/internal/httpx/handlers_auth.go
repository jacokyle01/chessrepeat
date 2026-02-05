package httpx

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/jacokyle01/chessrepeat/backend/internal/auth"
)

type AuthHandlers struct {
	DB             *pgxpool.Pool
	Sessions       *auth.SessionStore
	GoogleClientID string
	CookieSecure   bool // false on localhost
}

func (h *AuthHandlers) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDToken string `json:"idToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.IDToken == "" {
		http.Error(w, "missing idToken", http.StatusBadRequest)
		return
	}

	claims, err := auth.VerifyGoogleIDToken(r.Context(), req.IDToken, h.GoogleClientID)
	if err != nil || claims.Sub == "" {
		log.Printf("CreateSession: invalid google token: %v", err)
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return
	}

	var userID uuid.UUID
	err = h.DB.QueryRow(r.Context(), `
		insert into users(google_sub, email, name, picture)
		values ($1,$2,$3,$4)
		on conflict (google_sub)
		do update set email=excluded.email, name=excluded.name, picture=excluded.picture
		returning id
	`, claims.Sub, claims.Email, claims.Name, claims.Picture).Scan(&userID)
	if err != nil {
		log.Printf("CreateSession: upsert user db error: %v", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	sid, exp, err := h.Sessions.CreateSession(r.Context(), userID, 14*24*time.Hour)
	if err != nil {
		log.Printf("CreateSession: create session db error: %v", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "chessrepeat_session",
		Value:    sid.String(),
		Path:     "/",
		Expires:  exp,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   h.CookieSecure, // must be false on http://localhost
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
