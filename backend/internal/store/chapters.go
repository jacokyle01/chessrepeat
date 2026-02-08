package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
			enabled_count, bucket_entries, largest_move_id,
			revision
		)
		values ($1,$2,$3,$4,$5,$6,$7, $8, 0)
		returning id
	`, userID, ch.ID, ch.Name, ch.TrainAs, ch.LastDueCount, ch.EnabledCount, ch.BucketEntries, ch.LargestMoveId).Scan(&chapterDBID)
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


// GetChapter returns a single chapter (owned by userID) with all moves.
func (s *ChapterStore) GetChapter(ctx context.Context, userID uuid.UUID, chapterID string) (ChapterDTO, error) {
	chID, err := uuid.Parse(chapterID)
	if err != nil {
		return ChapterDTO{}, fmt.Errorf("invalid chapterId: %w", err)
	}

	var ch ChapterDTO
	err = s.DB.QueryRow(ctx, `
		select
			id,
			name,
			last_due_count,
			train_as,
			enabled_count,
			coalesce(bucket_entries, '{}'::int[]),
			coalesce(largest_move_id, 0)
		from chapters
		where user_id = $1 and id = $2
	`, userID, chID).Scan(
		&ch.ID,
		&ch.Name,
		&ch.LastDueCount,
		&ch.TrainAs,
		&ch.EnabledCount,
		&ch.BucketEntries,
		&ch.LargestMoveId,
	)
	if err != nil {
		return ChapterDTO{}, err
	}

	rows, err := s.DB.Query(ctx, `
		select
			id,
			idx,
			parent_idx,
			ord,
			fen,
			ply,
			san,
			coalesce(comment, ''),
			disabled,
			seen,
			train_group,
			due_at
		from moves
		where chapter_id = $1
		order by idx asc
	`, chID)
	if err != nil {
		return ChapterDTO{}, err
	}
	defer rows.Close()

	ch.Moves = make([]MoveDTO, 0, 256)
	for rows.Next() {
		var m MoveDTO
		var disabled, seen bool
		var group int
		var dueAt int64

		if err := rows.Scan(
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
			return ChapterDTO{}, err
		}

		m.Training.Disabled = disabled
		m.Training.Seen = seen
		m.Training.Group = group
		m.Training.DueAt = dueAt

		ch.Moves = append(ch.Moves, m)
	}
	if err := rows.Err(); err != nil {
		return ChapterDTO{}, err
	}

	return ch, nil
}

// AddMove inserts a move into a chapter owned by userID.
// Also bumps chapters.largest_move_id if needed and touches updated_at.
func (s *ChapterStore) AddMove(ctx context.Context, userID uuid.UUID, chapterID string, m MoveDTO) (MoveDTO, error) {
	chID, err := uuid.Parse(chapterID)
	if err != nil {
		return MoveDTO{}, fmt.Errorf("invalid chapterId: %w", err)
	}

	// minimal validation
	if m.ID == "" {
		return MoveDTO{}, fmt.Errorf("move.id required")
	}
	if m.Fen == "" {
		return MoveDTO{}, fmt.Errorf("move.fen required")
	}
	if m.San == "" {
		return MoveDTO{}, fmt.Errorf("move.san required")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return MoveDTO{}, err
	}
	defer tx.Rollback(ctx)

	// ownership check (lock row to serialize concurrent edits)
	var exists bool
	if err := tx.QueryRow(ctx, `
		select true
		from chapters
		where user_id = $1 and id = $2
		for update
	`, userID, chID).Scan(&exists); err != nil {
		return MoveDTO{}, err
	}

	_, err = tx.Exec(ctx, `
		insert into moves (
			chapter_id, id, idx, parent_idx, ord,
			fen, ply, san, comment,
			disabled, seen, train_group, due_at
		)
		values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
	`, chID,
		m.ID, m.IDX, m.ParentIDX, m.Ord,
		m.Fen, m.Ply, m.San, m.Comment,
		m.Training.Disabled, m.Training.Seen, m.Training.Group, m.Training.DueAt,
	)
	if err != nil {
		return MoveDTO{}, err
	}

	// bump largest_move_id if idx is larger (you can choose idx or derive from ID)
	//TODO idx should always be larger, don't need greatest calculation
	
	_, _ = tx.Exec(ctx, `
		update chapters
		set largest_move_id = greatest(coalesce(largest_move_id, 0), $3),
		    updated_at = now()
		where user_id = $1 and id = $2
	`, userID, chID, int(m.IDX))

	return m, tx.Commit(ctx)
}




// PATCH payload type (pointers = "optional fields")
type MoveTrainingPatch struct {
	Disabled *bool  `json:"disabled"`
	Seen     *bool  `json:"seen"`
	Group    *int   `json:"group"`
	DueAt    *int64 `json:"dueAt"`
}

// UpdateMoveTraining patches training columns on a move, enforcing chapter ownership.
// Returns the updated move (full row) so client can stay in sync.

//TODO dont need to update chapter... 
func (s *ChapterStore) UpdateMoveTraining(
	ctx context.Context,
	userID uuid.UUID,
	chapterID string,
	idx int64, //TODO moveID 
	patch MoveTrainingPatch,
) (MoveDTO, error) {
	chID, err := uuid.Parse(chapterID)
	if err != nil {
		return MoveDTO{}, fmt.Errorf("invalid chapterId: %w", err)
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return MoveDTO{}, err
	}
	defer tx.Rollback(ctx)

	// Ensure chapter belongs to user (also serializes concurrent updates on the chapter)
	var ok bool
	err = tx.QueryRow(ctx, `
		select true
		from chapters
		where user_id = $1 and id = $2
		for update
	`, userID, chID).Scan(&ok)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) { //TODO dont need pgx.. ? 
			return MoveDTO{}, fmt.Errorf("chapter not found")
		}
		return MoveDTO{}, err
	}

	// Read existing training values so PATCH semantics work
	var disabled, seen bool
	var group int
	var dueAt int64
	err = tx.QueryRow(ctx, `
		select disabled, seen, train_group, due_at
		from moves
		where chapter_id = $1 and idx = $2
	`, chID, idx).Scan(&disabled, &seen, &group, &dueAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return MoveDTO{}, fmt.Errorf("move not found")
		}
		return MoveDTO{}, err
	}

	// Apply patch
	if patch.Disabled != nil {
		disabled = *patch.Disabled
	}
	if patch.Seen != nil {
		seen = *patch.Seen
	}
	if patch.Group != nil {
		group = *patch.Group
	}
	if patch.DueAt != nil {
		dueAt = *patch.DueAt
	}

	// Update training columns
	_, err = tx.Exec(ctx, `
		update moves
		set disabled = $3,
		    seen = $4,
		    train_group = $5,
		    due_at = $6
		where chapter_id = $1 and idx = $2
	`, chID, idx, disabled, seen, group, dueAt)
	if err != nil {
		return MoveDTO{}, err
	}

	// Touch chapter updated_at (optional but useful)
	_, _ = tx.Exec(ctx, `
		update chapters set updated_at = now()
		where user_id = $1 and id = $2
	`, userID, chID)

	// Return full move row (keeps frontend canonical)
	var m MoveDTO
	var parentIdx *int64
	err = tx.QueryRow(ctx, `
		select id, idx, parent_idx, ord, fen, ply, san, coalesce(comment,''),
		       disabled, seen, train_group, due_at
		from moves
		where chapter_id = $1 and idx = $2
	`, chID, idx).Scan(
		&m.ID, &m.IDX, &parentIdx, &m.Ord, &m.Fen, &m.Ply, &m.San, &m.Comment,
		&m.Training.Disabled, &m.Training.Seen, &m.Training.Group, &m.Training.DueAt,
	)
	if err != nil {
		return MoveDTO{}, err
	}
	m.ParentIDX = parentIdx

	if err := tx.Commit(ctx); err != nil {
		return MoveDTO{}, err
	}
	return m, nil
}












//











//








// TODO we just need one API call to edit moves.. 
// can remove all others!

// MoveEdit identifies a move by IDX (not ID) and applies a partial patch.
// If the move at IDX doesn't exist, we INSERT it (upsert) using fields from the patch.
// For create, patch must include: id, ord, fen, ply, san (parentIdx optional). idx is implied by MoveEdit.Idx.
type MoveEdit struct {
	Idx   int64     `json:"idx"`
	Patch MovePatch `json:"patch"`
}

type MovePatch struct {
	// Required on create (when idx doesn't exist)
	ID  *string `json:"id,omitempty"`  // stable client id (string), not used as identifier for edits
	Ord *int    `json:"ord,omitempty"`

	Fen     *string `json:"fen,omitempty"`
	Ply     *int    `json:"ply,omitempty"`
	San     *string `json:"san,omitempty"`
	Comment *string `json:"comment,omitempty"`

	// Optional on create/update
	ParentIDX *int64        `json:"parentIdx,omitempty"`
	Training  *TrainingPatch `json:"training,omitempty"`
}

type TrainingPatch struct {
	Disabled *bool  `json:"disabled,omitempty"`
	Seen     *bool  `json:"seen,omitempty"`
	Group    *int   `json:"group,omitempty"`
	DueAt    *int64 `json:"dueAt,omitempty"`
}

// store/types.go (or wherever you keep these)
type EditMovesRequest struct {
  Edits []MoveEdit `json:"edits"`
}

// EditMoves upserts by (chapter_id, idx). IDX is the identifier for edits.
// ID is just another editable field.
func (s *ChapterStore) EditMoves(ctx context.Context, userID uuid.UUID, chapterID string, edits []MoveEdit) ([]MoveDTO, error) {
	if len(edits) == 0 {
		return []MoveDTO{}, nil
	}

	chID, err := uuid.Parse(chapterID)
	if err != nil {
		return nil, fmt.Errorf("invalid chapterId: %w", err)
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// ownership + serialize edits
	var ok bool
	err = tx.QueryRow(ctx, `
		select true
		from chapters
		where user_id = $1 and id = $2
		for update
	`, userID, chID).Scan(&ok)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("chapter not found")
		}
		return nil, err
	}

	affectedIdxs := make([]int64, 0, len(edits))

	for _, e := range edits {
		if e.Idx <= 0 {
			return nil, fmt.Errorf("idx required")
		}
		affectedIdxs = append(affectedIdxs, e.Idx)

		// does move exist at this idx?
		var exists bool
		if err := tx.QueryRow(ctx, `
			select exists(select 1 from moves where chapter_id=$1 and idx=$2)
		`, chID, e.Idx).Scan(&exists); err != nil {
			return nil, err
		}

		var cur MoveDTO
		if exists {
			// load current row
			var disabled, seen bool
			var group int
			var dueAt int64

			err = tx.QueryRow(ctx, `
				select
					id, idx, parent_idx, ord,
					fen, ply, san, coalesce(comment,''),
					disabled, seen, train_group, due_at
				from moves
				where chapter_id=$1 and idx=$2
			`, chID, e.Idx).Scan(
				&cur.ID, &cur.IDX, &cur.ParentIDX, &cur.Ord,
				&cur.Fen, &cur.Ply, &cur.San, &cur.Comment,
				&disabled, &seen, &group, &dueAt,
			)
			if err != nil {
				return nil, err
			}
			cur.Training.Disabled = disabled
			cur.Training.Seen = seen
			cur.Training.Group = group
			cur.Training.DueAt = dueAt

			// apply patch (IDX stays the identifier; allow patching ID)
			applyMovePatch(&cur, e.Patch)

			// IMPORTANT: idx identifier is e.Idx; ignore any attempt to patch idx
			cur.IDX = e.Idx
		} else {
			// create: require minimum fields (idx implied by edit)
			if e.Patch.ID == nil || e.Patch.Ord == nil || e.Patch.Fen == nil || e.Patch.Ply == nil || e.Patch.San == nil {
				return nil, fmt.Errorf("create move at idx=%d requires id, ord, fen, ply, san", e.Idx)
			}

			cur = MoveDTO{
				ID:        *e.Patch.ID,
				IDX:       e.Idx,
				ParentIDX: e.Patch.ParentIDX,
				Ord:       *e.Patch.Ord,
				Fen:       *e.Patch.Fen,
				Ply:       *e.Patch.Ply,
				San:       *e.Patch.San,
				Comment:   "",
			}
			if e.Patch.Comment != nil {
				cur.Comment = *e.Patch.Comment
			}

			// training defaults
			cur.Training.Disabled = false
			cur.Training.Seen = false
			cur.Training.Group = 0
			cur.Training.DueAt = 0
			if e.Patch.Training != nil {
				if e.Patch.Training.Disabled != nil {
					cur.Training.Disabled = *e.Patch.Training.Disabled
				}
				if e.Patch.Training.Seen != nil {
					cur.Training.Seen = *e.Patch.Training.Seen
				}
				if e.Patch.Training.Group != nil {
					cur.Training.Group = *e.Patch.Training.Group
				}
				if e.Patch.Training.DueAt != nil {
					cur.Training.DueAt = *e.Patch.Training.DueAt
				}
			}
		}

		// upsert by (chapter_id, idx)
		_, err = tx.Exec(ctx, `
			insert into moves (
				chapter_id, idx, id, parent_idx, ord,
				fen, ply, san, comment,
				disabled, seen, train_group, due_at
			)
			values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
			on conflict (chapter_id, idx) do update set
				id = excluded.id,
				parent_idx = excluded.parent_idx,
				ord = excluded.ord,
				fen = excluded.fen,
				ply = excluded.ply,
				san = excluded.san,
				comment = excluded.comment,
				disabled = excluded.disabled,
				seen = excluded.seen,
				train_group = excluded.train_group,
				due_at = excluded.due_at
		`, chID,
			cur.IDX, cur.ID, cur.ParentIDX, cur.Ord,
			cur.Fen, cur.Ply, cur.San, cur.Comment,
			cur.Training.Disabled, cur.Training.Seen, cur.Training.Group, cur.Training.DueAt,
		)
		if err != nil {
			return nil, err
		}

		// keep chapter metadata consistent
		_, _ = tx.Exec(ctx, `
			update chapters
			set largest_move_id = greatest(largest_move_id, $3),
			    updated_at = now()
			where user_id=$1 and id=$2
		`, userID, chID, int(cur.IDX))
	}

	// return canonical affected moves by idx
	rows, err := tx.Query(ctx, `
		select
			id, idx, parent_idx, ord,
			fen, ply, san, coalesce(comment,''),
			disabled, seen, train_group, due_at
		from moves
		where chapter_id=$1 and idx = any($2::bigint[])
		order by idx asc
	`, chID, affectedIdxs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]MoveDTO, 0, len(edits))
	for rows.Next() {
		var m MoveDTO
		var disabled, seen bool
		var group int
		var dueAt int64

		if err := rows.Scan(
			&m.ID, &m.IDX, &m.ParentIDX, &m.Ord,
			&m.Fen, &m.Ply, &m.San, &m.Comment,
			&disabled, &seen, &group, &dueAt,
		); err != nil {
			return nil, err
		}
		m.Training.Disabled = disabled
		m.Training.Seen = seen
		m.Training.Group = group
		m.Training.DueAt = dueAt
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return out, nil
}

func applyMovePatch(m *MoveDTO, p MovePatch) {
	// ID is now just another editable field
	if p.ID != nil {
		m.ID = *p.ID
	}
	if p.ParentIDX != nil {
		m.ParentIDX = p.ParentIDX
	}
	if p.Ord != nil {
		m.Ord = *p.Ord
	}
	if p.Fen != nil {
		m.Fen = *p.Fen
	}
	if p.Ply != nil {
		m.Ply = *p.Ply
	}
	if p.San != nil {
		m.San = *p.San
	}
	if p.Comment != nil {
		m.Comment = *p.Comment
	}
	if p.Training != nil {
		if p.Training.Disabled != nil {
			m.Training.Disabled = *p.Training.Disabled
		}
		if p.Training.Seen != nil {
			m.Training.Seen = *p.Training.Seen
		}
		if p.Training.Group != nil {
			m.Training.Group = *p.Training.Group
		}
		if p.Training.DueAt != nil {
			m.Training.DueAt = *p.Training.DueAt
		}
	}
}
