package store

import (
	"context"

	"chessrepeat/internal/domain"
)

// Repo is the persistence-layer contract used by every HTTP handler
// and by the auth helpers. *DB satisfies it via the methods defined in
// users.go / sessions.go / collaborators.go / chapters.go; tests
// substitute an in-memory fake.
//
// Every method takes a context.Context as its first argument. Handlers
// pass r.Context() (optionally wrapped with a timeout) so a slow query
// is cancelled when the client disconnects or the request budget is
// exhausted, rather than holding a DB connection open indefinitely.
//
// The WS layer keeps using *DB directly — its surface area is wider
// (move/training/chapter mutations) and it isn't covered by the unit
// suite, so there's no point bloating this interface with methods the
// HTTP handlers never call.
type Repo interface {
	UpsertUser(ctx context.Context, user domain.User) error
	FetchUser(ctx context.Context, tokenID string) (*domain.User, error)
	FetchUserByUsername(ctx context.Context, username string) (*domain.User, error)

	CreateSession(ctx context.Context, id string, userID string) (Session, error)
	FetchSession(ctx context.Context, sessionID string) (*Session, error)
	DeleteSession(ctx context.Context, sessionID string) error

	FetchChaptersByOwner(ctx context.Context, ownerID string) ([]domain.ChapterTreeResponse, error)

	AddCollaborator(ctx context.Context, ownerID, collaboratorID, permission string) error
	RemoveCollaborator(ctx context.Context, ownerID, collaboratorID string) error
	FetchOutgoingCollaborators(ctx context.Context, ownerID string) ([]domain.CollaboratorView, error)
	FetchIncomingCollaborators(ctx context.Context, userID string) ([]domain.CollaboratorView, error)

	CanViewRepertoire(ctx context.Context, ownerID, viewerID string) (bool, error)
}
