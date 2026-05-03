package store

import (
	"context"
	"errors"

	"chessrepeat/internal/domain"
	"github.com/jackc/pgx/v5"
)

// UpsertUser inserts or updates a user keyed by their Google sub
// (token_id). Username may be empty during the first login before the
// user has picked one — that's allowed by the schema (UNIQUE permits
// multiple NULLs only if you use NULLS NOT DISTINCT off; we store ""
// instead, so callers must ensure at most one user has username = "").
func (db *DB) UpsertUser(user domain.User) error {
	_, err := db.pool.Exec(context.TODO(), `
		INSERT INTO users (token_id, username, email, picture)
		VALUES ($1, NULLIF($2, ''), $3, $4)
		ON CONFLICT (token_id) DO UPDATE SET
			username = EXCLUDED.username,
			email    = EXCLUDED.email,
			picture  = EXCLUDED.picture
	`, user.TokenID, user.Username, user.Email, user.Picture)
	return err
}

func (db *DB) FetchUser(tokenID string) (*domain.User, error) {
	return db.fetchUserBy(`token_id = $1`, tokenID)
}

func (db *DB) FetchUserByUsername(username string) (*domain.User, error) {
	return db.fetchUserBy(`username = $1`, username)
}

func (db *DB) fetchUserBy(where string, arg string) (*domain.User, error) {
	var u domain.User
	var username *string
	err := db.pool.QueryRow(context.TODO(),
		`SELECT token_id, username, email, picture FROM users WHERE `+where,
		arg,
	).Scan(&u.TokenID, &username, &u.Email, &u.Picture)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if username != nil {
		u.Username = *username
	}
	return &u, nil
}

// resolveUsersToViews fetches users by id and projects them to the
// CollaboratorView shape. Callers in the collaborator layer use this
// when converting collaborator id lists into something safe to send to
// the client.
func (db *DB) resolveUsersToViews(userIDs []string) ([]domain.CollaboratorView, error) {
	out := make([]domain.CollaboratorView, 0, len(userIDs))
	if len(userIDs) == 0 {
		return out, nil
	}
	rows, err := db.pool.Query(context.TODO(), `
		SELECT username, picture
		FROM users
		WHERE token_id = ANY($1) AND username IS NOT NULL
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var v domain.CollaboratorView
		if err := rows.Scan(&v.Username, &v.Picture); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
