package store

import "chessrepeat/internal/domain"

// Repo is the persistence-layer contract used by every HTTP handler
// and by the auth helpers. *DB satisfies it via the methods defined in
// users.go / sessions.go / collaborators.go / chapters.go; tests
// substitute an in-memory fake.
//
// The WS layer keeps using *DB directly — its surface area is wider
// (move/training/chapter mutations) and it isn't covered by the unit
// suite, so there's no point bloating this interface with methods the
// HTTP handlers never call.
type Repo interface {
	UpsertUser(user domain.User) error
	FetchUser(tokenID string) (*domain.User, error)
	FetchUserByUsername(username string) (*domain.User, error)

	CreateSession(id string, userID string) (Session, error)
	FetchSession(sessionID string) (*Session, error)
	DeleteSession(sessionID string) error

	FetchChaptersByOwner(ownerID string) ([]domain.ChapterTreeResponse, error)

	AddCollaborator(ownerID, collaboratorID string) error
	RemoveCollaborator(ownerID, collaboratorID string) error
	FetchOutgoingCollaborators(ownerID string) ([]domain.CollaboratorView, error)
	FetchIncomingCollaborators(userID string) ([]domain.CollaboratorView, error)

	CanViewRepertoire(ownerID, viewerID string) (bool, error)
}
