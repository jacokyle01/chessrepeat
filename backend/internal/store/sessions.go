package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// Session is a server-side authenticated session record.
type Session struct {
	SessionID string    `json:"sessionId"`
	UserID    string    `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// CreateSession persists a new session bound to a user. The caller owns
// session-id generation so the auth package can keep crypto-random
// concerns in one place.
// TODO what if we already have a session
func (db *DB) CreateSession(ctx context.Context, id string, userID string) (Session, error) {
	now := time.Now().UTC()
	sess := Session{
		SessionID: id,
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(30 * 24 * time.Hour),
	}
	_, err := db.pool.Exec(ctx, `
		INSERT INTO sessions (session_id, user_id, created_at, expires_at)
		VALUES ($1, $2, $3, $4)
	`, sess.SessionID, sess.UserID, sess.CreatedAt, sess.ExpiresAt)
	if err != nil {
		return Session{}, err
	}
	return sess, nil
}

// FetchSession returns the session for the given id if it exists and has
// not expired. A nil session with nil error means "not found or expired".
// TODO session invalidation?
func (db *DB) FetchSession(ctx context.Context, sessionID string) (*Session, error) {
	var sess Session
	err := db.pool.QueryRow(ctx, `
		SELECT session_id, user_id, created_at, expires_at
		FROM sessions
		WHERE session_id = $1
	`, sessionID).Scan(&sess.SessionID, &sess.UserID, &sess.CreatedAt, &sess.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if time.Now().UTC().After(sess.ExpiresAt) {
		return nil, nil
	}
	return &sess, nil
}

func (db *DB) DeleteSession(ctx context.Context, sessionID string) error {
	_, err := db.pool.Exec(ctx,
		`DELETE FROM sessions WHERE session_id = $1`, sessionID)
	return err
}
