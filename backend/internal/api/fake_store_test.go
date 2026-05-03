package api

import (
	"sync"
	"time"

	"chessrepeat/internal/domain"
	"chessrepeat/internal/store"
)

// fakeStore is an in-memory store.Repo for unit tests. Every method
// mirrors the behaviour of the real Postgres-backed store; mutations
// are guarded by a mutex so a handler that runs concurrent reads/writes
// (the WS dispatch path doesn't, but it costs nothing) doesn't race.
type fakeStore struct {
	mu sync.Mutex

	usersByToken    map[string]domain.User
	usersByUsername map[string]string // username -> token id
	sessions        map[string]store.Session
	chapters        map[string][]domain.ChapterTreeResponse
	collaborators   map[collabKey]struct{}

	// errOn forces a method to return the given error on its next
	// call. Set via withErr; cleared after the call fires.
	errOn map[string]error
}

type collabKey struct{ owner, collaborator string }

func newFakeStore() *fakeStore {
	return &fakeStore{
		usersByToken:    map[string]domain.User{},
		usersByUsername: map[string]string{},
		sessions:        map[string]store.Session{},
		chapters:        map[string][]domain.ChapterTreeResponse{},
		collaborators:   map[collabKey]struct{}{},
		errOn:           map[string]error{},
	}
}

func (f *fakeStore) takeErr(name string) error {
	if e, ok := f.errOn[name]; ok {
		delete(f.errOn, name)
		return e
	}
	return nil
}

// withErr arms the next call to `name` to return err. Tests use this
// to drive the 500 paths without rewiring fakes per case.
func (f *fakeStore) withErr(name string, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.errOn[name] = err
}

func (f *fakeStore) UpsertUser(u domain.User) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("UpsertUser"); err != nil {
		return err
	}
	if prev, ok := f.usersByToken[u.TokenID]; ok && prev.Username != "" && prev.Username != u.Username {
		delete(f.usersByUsername, prev.Username)
	}
	f.usersByToken[u.TokenID] = u
	if u.Username != "" {
		f.usersByUsername[u.Username] = u.TokenID
	}
	return nil
}

func (f *fakeStore) FetchUser(tokenID string) (*domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("FetchUser"); err != nil {
		return nil, err
	}
	u, ok := f.usersByToken[tokenID]
	if !ok {
		return nil, nil
	}
	cp := u
	return &cp, nil
}

func (f *fakeStore) FetchUserByUsername(username string) (*domain.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("FetchUserByUsername"); err != nil {
		return nil, err
	}
	tok, ok := f.usersByUsername[username]
	if !ok {
		return nil, nil
	}
	u := f.usersByToken[tok]
	return &u, nil
}

func (f *fakeStore) CreateSession(id, userID string) (store.Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("CreateSession"); err != nil {
		return store.Session{}, err
	}
	now := time.Now().UTC()
	sess := store.Session{
		SessionID: id,
		UserID:    userID,
		CreatedAt: now,
		ExpiresAt: now.Add(30 * 24 * time.Hour),
	}
	f.sessions[id] = sess
	return sess, nil
}

func (f *fakeStore) FetchSession(id string) (*store.Session, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("FetchSession"); err != nil {
		return nil, err
	}
	sess, ok := f.sessions[id]
	if !ok {
		return nil, nil
	}
	if time.Now().UTC().After(sess.ExpiresAt) {
		return nil, nil
	}
	return &sess, nil
}

func (f *fakeStore) DeleteSession(id string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("DeleteSession"); err != nil {
		return err
	}
	delete(f.sessions, id)
	return nil
}

func (f *fakeStore) FetchChaptersByOwner(ownerID string) ([]domain.ChapterTreeResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("FetchChaptersByOwner"); err != nil {
		return nil, err
	}
	out := make([]domain.ChapterTreeResponse, len(f.chapters[ownerID]))
	copy(out, f.chapters[ownerID])
	return out, nil
}

func (f *fakeStore) AddCollaborator(ownerID, collaboratorID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("AddCollaborator"); err != nil {
		return err
	}
	f.collaborators[collabKey{ownerID, collaboratorID}] = struct{}{}
	return nil
}

func (f *fakeStore) RemoveCollaborator(ownerID, collaboratorID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("RemoveCollaborator"); err != nil {
		return err
	}
	delete(f.collaborators, collabKey{ownerID, collaboratorID})
	return nil
}

func (f *fakeStore) FetchOutgoingCollaborators(ownerID string) ([]domain.CollaboratorView, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("FetchOutgoingCollaborators"); err != nil {
		return nil, err
	}
	out := make([]domain.CollaboratorView, 0)
	for k := range f.collaborators {
		if k.owner != ownerID {
			continue
		}
		if u, ok := f.usersByToken[k.collaborator]; ok && u.Username != "" {
			out = append(out, domain.CollaboratorView{Username: u.Username, Picture: u.Picture})
		}
	}
	return out, nil
}

func (f *fakeStore) FetchIncomingCollaborators(userID string) ([]domain.CollaboratorView, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("FetchIncomingCollaborators"); err != nil {
		return nil, err
	}
	out := make([]domain.CollaboratorView, 0)
	for k := range f.collaborators {
		if k.collaborator != userID {
			continue
		}
		if u, ok := f.usersByToken[k.owner]; ok && u.Username != "" {
			out = append(out, domain.CollaboratorView{Username: u.Username, Picture: u.Picture})
		}
	}
	return out, nil
}

func (f *fakeStore) CanViewRepertoire(ownerID, viewerID string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := f.takeErr("CanViewRepertoire"); err != nil {
		return false, err
	}
	if ownerID == viewerID {
		return true, nil
	}
	_, ok := f.collaborators[collabKey{ownerID, viewerID}]
	return ok, nil
}

// Compile-time assertion: fakeStore satisfies store.Repo. If a method
// is added to Repo and not implemented here, the build breaks.
var _ store.Repo = (*fakeStore)(nil)
