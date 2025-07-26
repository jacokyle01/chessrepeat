package service

import (
	"fmt"
	"errors"
	"github.com/jacokyle01/chessrepeat/backend/model"
	"github.com/jacokyle01/chessrepeat/backend/repo"
	"github.com/jacokyle01/chessrepeat/backend/internal"
	"github.com/jacokyle01/chessrepeat/backend/utils"
)

type GameService struct {
	store *internal.SessionStore
	repo  *repo.MongoRepo
}

func NewGameService(store *internal.SessionStore, repo *repo.MongoRepo) *GameService {
	return &GameService{store, repo}
}

// func (s *GameService) LoadOrCreateGame(id string) (*model.RepertoireEntry, error) {
// 	if game, ok := s.store.Get(id); ok {
// 		return game, nil
// 	}
// 	game, err := s.repo.Load(id)
// 	if err != nil {
// 		// create a new empty game
// 		game = &model.RepertoireEntry{ID: id, Root: &model.MoveNode{ID: "start", Children: []*model.MoveNode{}}}
// 	}
// 	s.store.Set(id, game)
// 	return game, nil
// }

func (s *GameService) LoadGame(id string) (*model.RepertoireEntry, error) {
	if game, ok := s.store.Get(id); ok {
		return game, nil
	}
	return nil, fmt.Errorf("game with ID %s not in session store", id)
}

func (s *GameService) CreateChapter(chapter *model.RepertoireEntry) error {
	if chapter.ID == "" {
		chapter.ID = utils.GenerateID()
}

	// Save to DB
	return s.repo.Save(chapter)
}

// func (s *GameService) CreateEntry(game *model.RepertoireEntry) error {
// 	return s.repo.Create(game)
// }

// func (s *GameService) SetActiveEntry(id string) error {
// 	game, err := s.repo.FindByID(id)
// 	if err != nil {
// 		return err
// 	}
// 	s.store.Set(id, game)
// 	return nil
// }

func (s *GameService) SwitchChapter(id string) error {
	// Check if it's already loaded
	if _, ok := s.store.Get(id); ok {
		return nil // Already in memory
	}

	// Fetch from DB
	chapter, err := s.repo.GetByID(id)
	if err != nil {
		return errors.New("chapter not found")
	}

	// Store in memory for future access via WebSocket
	s.store.Set(id, chapter)
	return nil
}

func (s *GameService) SaveGame(id string) error {
    game, ok := s.store.Get(id)
    if !ok {
        return fmt.Errorf("game not in memory")
    }
    return s.repo.Save(game)
}


