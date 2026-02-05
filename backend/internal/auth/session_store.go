package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SessionStore struct {
	DB *pgxpool.Pool
}

func (s *SessionStore) CreateSession(ctx context.Context, userID uuid.UUID, ttl time.Duration) (uuid.UUID, time.Time, error) {
	sid := uuid.New()
	exp := time.Now().Add(ttl)

	_, err := s.DB.Exec(ctx, `
		insert into sessions(id, user_id, expires_at)
		values ($1,$2,$3)
	`, sid, userID, exp)

	return sid, exp, err
}

func (s *SessionStore) GetUserID(ctx context.Context, sessionID uuid.UUID) (uuid.UUID, bool, error) {
	var uid uuid.UUID
	var exp time.Time
	err := s.DB.QueryRow(ctx, `
		select user_id, expires_at
		from sessions
		where id=$1
	`, sessionID).Scan(&uid, &exp)
	if err != nil {
		return uuid.Nil, false, nil
	}
	if time.Now().After(exp) {
		return uuid.Nil, false, nil
	}
	return uid, true, nil
}
