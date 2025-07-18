package service

import (
	"github.com/jacokyle01/chessrepeat-backend/model"
	"github.com/jacokyle01/chessrepeat-backend/repo"
	"github.com/jacokyle01/chessrepeat-backend/internal"
)

type GameService struct {
	store *internal.SessionStore
	repo  *repo.MongoRepo
}

func NewGameService(store *internal.SessionStore, repo *repo.MongoRepo) *GameService {
	return &GameService{store, repo}
}

func (s *GameService) LoadOrCreateGame(id string) (*model.RepertoireEntry, error) {
	if game, ok := s.store.Get(id); ok {
		return game, nil
	}
	game, err := s.repo.Load(id)
	if err != nil {
		// create a new empty game
		game = &model.RepertoireEntry{ID: id, Root: &model.MoveNode{ID: "start", Children: []*model.MoveNode{}}}
	}
	s.store.Set(id, game)
	return game, nil
}

func (s *GameService) SaveGame(id string) error {
	game, ok := s.store.Get(id)
	if !ok {
		return nil
	}
	return s.repo.Save(game)
}
