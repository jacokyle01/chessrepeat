package store

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ChapterStore persists chapters + moves.
type ChapterStore struct {
	DB *pgxpool.Pool
}

type ChapterDTO struct {
	ID            string    `json:"id"` // client chapter id
	Name          string    `json:"name"`
	LastDueCount  int       `json:"lastDueCount"`
	TrainAs       string    `json:"trainAs"`
	EnabledCount  int       `json:"enabledCount"`
	LargestMoveId int 			`json:"largestMoveId"`
	BucketEntries []int     `json:"bucketEntries"`
	Moves         []MoveDTO `json:"moves"`
}

type MoveDTO struct {
	ID       string `json:"id"`       // string id (stable key from client; e.g. "n123")
	IDX      int64  `json:"idx"`      // numeric index used for fast ops / parent links
	ParentIDX *int64 `json:"parentIdx"` // nil=root; refers to parent's IDX
	Ord      int    `json:"ord"`      // sibling ordering under parent

	Fen     string `json:"fen"`
	Ply     int    `json:"ply"`
	San     string `json:"san"`
	Comment string `json:"comment"`

	Training struct {
		Disabled bool  `json:"disabled"`
		Seen     bool  `json:"seen"`
		Group    int   `json:"group"`
		DueAt    int64 `json:"dueAt"`
	} `json:"training"`
}

// CreateChapter inserts a chapter row (owned by userID) and inserts all move rows.
// No move validation here (frontend owns correctness); DB constraints can catch hard failures.
func (s *ChapterStore) CreateChapter(ctx context.Context, userID uuid.UUID, ch ChapterDTO) error {
	// ---- minimal validation ----
	if ch.ID == "" {
		return fmt.Errorf("chapter.id required")
	}
	if ch.Name == "" {
		return fmt.Errorf("chapter.name required")
	}
	if ch.TrainAs == "" {
		return fmt.Errorf("chapter.trainAs required")
	}
	if len(ch.Moves) == 0 {
		return fmt.Errorf("chapter must include moves")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Insert chapter; return DB UUID (used to insert moves).
	var chapterDBID uuid.UUID
	err = tx.QueryRow(ctx, `
		insert into chapters (
			user_id, id,
			name, train_as, last_due_count,
			enabled_count, bucket_entries,
			revision
		)
		values ($1,$2,$3,$4,$5,$6,$7,0)
		returning id
	`, userID, ch.ID, ch.Name, ch.TrainAs, ch.LastDueCount, ch.EnabledCount, ch.BucketEntries).Scan(&chapterDBID)
	if err != nil {
		return err
	}

	// Insert moves.
	// Assumes your moves table has columns: (chapter_id, id, idx, parent_idx, ord, fen, ply, san, comment, disabled, seen, train_group, due_at)
	for _, m := range ch.Moves {
		_, err := tx.Exec(ctx, `
			insert into moves (
				chapter_id, id, idx, parent_idx, ord,
				fen, ply, san, comment,
				disabled, seen, train_group, due_at
			)
			values (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9,
				$10, $11, $12, $13
			)
		`,
			chapterDBID,
			m.ID,
			m.IDX,
			m.ParentIDX,
			m.Ord,
			m.Fen,
			m.Ply,
			m.San,
			m.Comment,
			m.Training.Disabled,
			m.Training.Seen,
			m.Training.Group,
			m.Training.DueAt,
		)
		if err != nil {
			return err
		}
	}

	// Touch updated_at
	_, _ = tx.Exec(ctx, `update chapters set updated_at=now() where id=$1`, chapterDBID)

	return tx.Commit(ctx)
}


// get chapterDTOs from querying DB 
// TODO optimizations here? 
func (s *ChapterStore) ListChapters(ctx context.Context, userID uuid.UUID) ([]ChapterDTO, error) {
	// 1) fetch chapter rows
	rows, err := s.DB.Query(ctx, `
		select
			id,            -- client chapter id (string)
			name,
			last_due_count,
			train_as,
			enabled_count,
			coalesce(bucket_entries, '{}'::int[]),
			coalesce(largest_move_id, 0)
		from chapters
		where user_id = $1
		order by updated_at desc
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type chapMeta struct {
		dto ChapterDTO
	}
	chapters := make([]ChapterDTO, 0, 32)
	byClientID := make(map[string]*ChapterDTO)

	for rows.Next() {
		var ch ChapterDTO
		if err := rows.Scan(
			&ch.ID,
			&ch.Name,
			&ch.LastDueCount,
			&ch.TrainAs,
			&ch.EnabledCount,
			&ch.BucketEntries,
			&ch.LargestMoveId,
		); err != nil {
			return nil, err
		}
		ch.Moves = []MoveDTO{}
		chapters = append(chapters, ch)
		byClientID[ch.ID] = &chapters[len(chapters)-1]
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(chapters) == 0 {
		return chapters, nil
	}

	// 2) fetch moves for all chapters for this user (join on chapters.user_id)
	moveRows, err := s.DB.Query(ctx, `
		select
			c.id as chapter_client_id,
			m.id,
			m.idx,
			m.parent_idx,
			m.ord,
			m.fen,
			m.ply,
			m.san,
			coalesce(m.comment, ''),
			m.disabled,
			m.seen,
			m.train_group,
			m.due_at
		from moves m
		join chapters c on c.id = m.chapter_id
		where c.user_id = $1
		order by c.updated_at desc, m.idx asc
	`, userID)
	if err != nil {
		return nil, err
	}
	defer moveRows.Close()

	for moveRows.Next() {
		var chapterClientID string
		var m MoveDTO
		var disabled, seen bool
		var group int
		var dueAt int64

		if err := moveRows.Scan(
			&chapterClientID,
			&m.ID,
			&m.IDX,
			&m.ParentIDX,
			&m.Ord,
			&m.Fen,
			&m.Ply,
			&m.San,
			&m.Comment,
			&disabled,
			&seen,
			&group,
			&dueAt,
		); err != nil {
			return nil, err
		}

		m.Training.Disabled = disabled
		m.Training.Seen = seen
		m.Training.Group = group
		m.Training.DueAt = dueAt

		ch := byClientID[chapterClientID]
		if ch == nil {
			return nil, fmt.Errorf("move references unknown chapter client id %q", chapterClientID)
		}
		ch.Moves = append(ch.Moves, m)
	}
	if err := moveRows.Err(); err != nil {
		return nil, err
	}

	return chapters, nil
}