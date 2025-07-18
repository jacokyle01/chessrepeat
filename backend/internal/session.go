package internal

import (
	"sync"
	"github.com/jacokyle01/chessrepeat-backend/model"
)

type SessionStore struct {
	sync.RWMutex
	sessions map[string]*model.RepertoireEntry
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*model.RepertoireEntry),
	}
}

func (s *SessionStore) Get(id string) (*model.RepertoireEntry, bool) {
	s.RLock()
	defer s.RUnlock()
	game, ok := s.sessions[id]
	return game, ok
}

func (s *SessionStore) Set(id string, game *model.RepertoireEntry) {
	s.Lock()
	defer s.Unlock()
	s.sessions[id] = game
}

func (s *SessionStore) Delete(id string) {
	s.Lock()
	defer s.Unlock()
	delete(s.sessions, id)
}
