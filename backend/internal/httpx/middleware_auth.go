package httpx

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"github.com/jacokyle01/chessrepeat/backend/internal/auth"
)

type ctxKeyUser struct{}

type AuthedUser struct {
	UserID uuid.UUID
}

// WithAuth is a chi middleware factory.
// It reads the "chessrepeat_session" cookie, resolves it to a userID,
// and stores AuthedUser in request context.
func WithAuth(sessions *auth.SessionStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			c, err := r.Cookie("chessrepeat_session")
			if err != nil || c.Value == "" {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			sid, err := uuid.Parse(c.Value)
			if err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			uid, ok, err := sessions.GetUserID(r.Context(), sid)
			if err != nil || !ok {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyUser{}, AuthedUser{UserID: uid})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// MustUser pulls the authenticated user from context.
// Use this in handlers that are guaranteed to be behind WithAuth.
func MustUser(r *http.Request) AuthedUser {
	u, ok := r.Context().Value(ctxKeyUser{}).(AuthedUser)
	if !ok {
		panic("missing user in ctx (did you forget WithAuth middleware?)")
	}
	return u
}
