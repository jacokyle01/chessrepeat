package store

import (
	"context"
	"errors"
	"sort"
	"strings"

	"chessrepeat/internal/domain"
	"github.com/jackc/pgx/v5"
)

// CreateChapter inserts the chapter row and bulk-inserts its flattened
// move tree. Wrapped in a transaction so a partial failure can't leave a
// chapter with no moves.
func (db *DB) CreateChapter(ctx context.Context, event domain.ChapterEvent) error {
	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO chapters
			(uuid, owner_id, name, train_as, enabled_count, unseen_count)
		VALUES ($1, $2, $3, $4, $5, $6)
	`,
		event.ChapterID, event.OwnerID, event.Name, event.TrainAs,
		event.EnabledCount, event.UnseenCount,
	)
	if err != nil {
		return err
	}

	moves := flattenTree(event.Root)
	rows := make([][]any, 0, len(moves))
	for path, m := range moves {
		rows = append(rows, []any{
			event.ChapterID, path, m.ID, m.FEN, m.Ply, m.SAN, m.Comment, m.Enabled,
		})
	}
	if len(rows) > 0 {
		_, err = tx.CopyFrom(ctx,
			pgx.Identifier{"moves"},
			[]string{"chapter_id", "path", "id", "fen", "ply", "san", "comment", "enabled"},
			pgx.CopyFromRows(rows),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// DeleteChapter removes a chapter row. Moves and training_cards cascade
// via FK ON DELETE CASCADE.
func (db *DB) DeleteChapter(ctx context.Context, chapterID string) error {
	_, err := db.pool.Exec(ctx,
		`DELETE FROM chapters WHERE uuid = $1`, chapterID)
	return err
}

// AddMoveToChapter upserts a single move. The key is the move's path
// (parent path + move ID).
func (db *DB) AddMoveToChapter(ctx context.Context, event domain.MoveEvent) error {
	movePath := event.Path + event.Move.ID
	_, err := db.pool.Exec(ctx, `
		INSERT INTO moves
			(chapter_id, path, id, fen, ply, san, comment, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (chapter_id, path) DO UPDATE SET
			id      = EXCLUDED.id,
			fen     = EXCLUDED.fen,
			ply     = EXCLUDED.ply,
			san     = EXCLUDED.san,
			comment = EXCLUDED.comment,
			enabled = EXCLUDED.enabled
	`,
		event.ChapterID, movePath, event.Move.ID,
		event.Move.FEN, event.Move.Ply, event.Move.SAN,
		event.Move.Comment, event.Move.Enabled,
	)
	return err
}

// UpdateTrainingState upserts a single user's training card on a
// specific node. Per-user training is keyed by username so the
// (username, picture) public identity is the only thing peers need to
// render per-user progress — no Google sub on the wire.
//
// The INSERT...SELECT WHERE EXISTS guard mirrors the previous
// "node not found, nothing to update" Mongo behavior: if the move row
// doesn't exist, the insert is a no-op rather than an FK error.
func (db *DB) UpdateTrainingState(ctx context.Context, event domain.TrainingUpdatedEvent) error {
	c := event.Card
	_, err := db.pool.Exec(ctx, `
		INSERT INTO training_cards
			(chapter_id, path, username, due, stability, difficulty,
			 elapsed_days, scheduled_days, reps, lapses, state, last_review)
		SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
		WHERE EXISTS (
			SELECT 1 FROM moves WHERE chapter_id = $1 AND path = $2
		)
		ON CONFLICT (chapter_id, path, username) DO UPDATE SET
			due            = EXCLUDED.due,
			stability      = EXCLUDED.stability,
			difficulty     = EXCLUDED.difficulty,
			elapsed_days   = EXCLUDED.elapsed_days,
			scheduled_days = EXCLUDED.scheduled_days,
			reps           = EXCLUDED.reps,
			lapses         = EXCLUDED.lapses,
			state          = EXCLUDED.state,
			last_review    = EXCLUDED.last_review
	`,
		event.ChapterID, event.Path, event.Username,
		c.Due, c.Stability, c.Difficulty,
		c.ElapsedDays, c.ScheduledDays, c.Reps, c.Lapses,
		c.State, c.LastReview,
	)
	return err
}

// DeleteNodeFromChapter removes a node and all its descendants. A
// descendant is any path that starts with the target path. The
// text_pattern_ops index on (chapter_id, path) makes this index-eligible.
// training_cards cascade via the composite FK to moves.
//
// Empty path is rejected — that's the chapter root, and recursing from
// root would wipe every move (clients should send chapter_deleted
// instead). For non-empty paths we verify the row exists before issuing
// the delete; combined with escapeLike on the prefix pattern, this
// prevents a client from over-matching descendants by smuggling LIKE
// wildcards into the path.
func (db *DB) DeleteNodeFromChapter(ctx context.Context, event domain.NodeDeleteEvent) error {
	ok, err := db.pathExists(ctx, event.ChapterID, event.Path)
	if err != nil || !ok {
		return err
	}
	_, err = db.pool.Exec(ctx, `
		DELETE FROM moves
		WHERE chapter_id = $1
		  AND (path = $2 OR path LIKE $3 || '%' ESCAPE '\')
	`, event.ChapterID, event.Path, escapeLike(event.Path))
	return err
}

// SetEnabledRecursive sets the enabled flag on a node and all its
// descendants. Same prefix-match and same path-existence guard as
// DeleteNodeFromChapter.
func (db *DB) SetEnabledRecursive(ctx context.Context, chapterID string, path string, enabled bool) error {
	ok, err := db.pathExists(ctx, chapterID, path)
	if err != nil || !ok {
		return err
	}
	_, err = db.pool.Exec(ctx, `
		UPDATE moves
		SET enabled = $4
		WHERE chapter_id = $1
		  AND (path = $2 OR path LIKE $3 || '%' ESCAPE '\')
	`, chapterID, path, escapeLike(path), enabled)
	return err
}

// pathExists is the input-validation guard for the recursive subtree
// ops. It rejects the empty path (which is the chapter root —
// recursing from there would wipe every move) and confirms the anchor
// row actually exists before we issue a prefix-match. Combined with
// escapeLike on the LIKE pattern, this prevents a client from
// over-matching by smuggling wildcards into `path`.
func (db *DB) pathExists(ctx context.Context, chapterID, path string) (bool, error) {
	if path == "" {
		return false, nil
	}
	var exists bool
	err := db.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM moves WHERE chapter_id = $1 AND path = $2
		)
	`, chapterID, path).Scan(&exists)
	return exists, err
}

// escapeLike escapes the three wildcards Postgres' LIKE recognises so
// `path LIKE $n || '%' ESCAPE '\'` only matches the literal prefix.
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

// FetchChaptersByOwner returns every chapter belonging to a user. Loads
// chapters, moves, and training_cards in three queries, then assembles
// the trees in Go.
func (db *DB) FetchChaptersByOwner(ctx context.Context, ownerID string) ([]domain.ChapterTreeResponse, error) {
	chapters := make([]domain.ChapterTreeResponse, 0)

	chRows, err := db.pool.Query(ctx, `
		SELECT uuid, name, train_as, enabled_count, unseen_count
		FROM chapters
		WHERE owner_id = $1
	`, ownerID)
	if err != nil {
		return nil, err
	}
	type chapterRow struct {
		uuid                       string
		name, trainAs              string
		enabledCount, unseenCount  int
	}
	var chRowsBuf []chapterRow
	for chRows.Next() {
		var r chapterRow
		if err := chRows.Scan(&r.uuid, &r.name, &r.trainAs, &r.enabledCount, &r.unseenCount); err != nil {
			chRows.Close()
			return nil, err
		}
		chRowsBuf = append(chRowsBuf, r)
	}
	chRows.Close()
	if err := chRows.Err(); err != nil {
		return nil, err
	}
	if len(chRowsBuf) == 0 {
		return chapters, nil
	}

	chapterIDs := make([]string, len(chRowsBuf))
	for i, r := range chRowsBuf {
		chapterIDs[i] = r.uuid
	}

	movesByChapter, err := db.loadMoves(ctx, chapterIDs)
	if err != nil {
		return nil, err
	}
	cardsByChapter, err := db.loadCards(ctx, chapterIDs)
	if err != nil {
		return nil, err
	}

	for _, r := range chRowsBuf {
		mergeCardsIntoMoves(movesByChapter[r.uuid], cardsByChapter[r.uuid])
		chapters = append(chapters, domain.ChapterTreeResponse{
			UUID:         r.uuid,
			Name:         r.name,
			TrainAs:      r.trainAs,
			EnabledCount: r.enabledCount,
			UnseenCount:  r.unseenCount,
			Root:         buildTree(movesByChapter[r.uuid]),
		})
	}
	return chapters, nil
}

// ReadChapterAsTree fetches one chapter and rebuilds the move tree.
func (db *DB) ReadChapterAsTree(ctx context.Context, chapterID string) (*domain.ChapterTreeResponse, error) {
	var resp domain.ChapterTreeResponse
	err := db.pool.QueryRow(ctx, `
		SELECT uuid, name, train_as, enabled_count, unseen_count
		FROM chapters
		WHERE uuid = $1
	`, chapterID).Scan(&resp.UUID, &resp.Name, &resp.TrainAs, &resp.EnabledCount, &resp.UnseenCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	movesByChapter, err := db.loadMoves(ctx, []string{chapterID})
	if err != nil {
		return nil, err
	}
	cardsByChapter, err := db.loadCards(ctx, []string{chapterID})
	if err != nil {
		return nil, err
	}
	moves := movesByChapter[chapterID]
	mergeCardsIntoMoves(moves, cardsByChapter[chapterID])
	resp.Root = buildTree(moves)
	return &resp, nil
}

// loadMoves fetches all moves for the given chapters and groups them
// path -> TrainingData per chapter. Training maps are left nil here;
// loadCards / mergeCardsIntoMoves fill them in.
func (db *DB) loadMoves(ctx context.Context, chapterIDs []string) (map[string]map[string]domain.TrainingData, error) {
	out := make(map[string]map[string]domain.TrainingData, len(chapterIDs))
	for _, id := range chapterIDs {
		out[id] = make(map[string]domain.TrainingData)
	}
	rows, err := db.pool.Query(ctx, `
		SELECT chapter_id, path, id, fen, ply, san, comment, enabled
		FROM moves
		WHERE chapter_id = ANY($1)
	`, chapterIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			chID, path string
			td         domain.TrainingData
		)
		if err := rows.Scan(
			&chID, &path, &td.ID, &td.FEN, &td.Ply, &td.SAN, &td.Comment, &td.Enabled,
		); err != nil {
			return nil, err
		}
		out[chID][path] = td
	}
	return out, rows.Err()
}

// loadCards fetches all training cards for the given chapters and
// groups them chapter -> path -> username -> card.
func (db *DB) loadCards(ctx context.Context, chapterIDs []string) (map[string]map[string]map[string]*domain.CardData, error) {
	out := make(map[string]map[string]map[string]*domain.CardData, len(chapterIDs))
	for _, id := range chapterIDs {
		out[id] = make(map[string]map[string]*domain.CardData)
	}
	rows, err := db.pool.Query(ctx, `
		SELECT chapter_id, path, username,
		       due, stability, difficulty,
		       elapsed_days, scheduled_days, reps, lapses, state, last_review
		FROM training_cards
		WHERE chapter_id = ANY($1)
	`, chapterIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			chID, path, username string
			card                 domain.CardData
		)
		if err := rows.Scan(
			&chID, &path, &username,
			&card.Due, &card.Stability, &card.Difficulty,
			&card.ElapsedDays, &card.ScheduledDays, &card.Reps, &card.Lapses,
			&card.State, &card.LastReview,
		); err != nil {
			return nil, err
		}
		byPath := out[chID]
		if byPath[path] == nil {
			byPath[path] = make(map[string]*domain.CardData)
		}
		c := card
		byPath[path][username] = &c
	}
	return out, rows.Err()
}

func mergeCardsIntoMoves(
	moves map[string]domain.TrainingData,
	cards map[string]map[string]*domain.CardData,
) {
	for path, byUser := range cards {
		td, ok := moves[path]
		if !ok {
			continue
		}
		td.Training = byUser
		moves[path] = td
	}
}

// flattenTree walks a ChapterTreeNode tree and produces a flat
// path->TrainingData map. Each node's key is parentPath + node.Data.ID
// (root is always "").
func flattenTree(root domain.ChapterTreeNode) map[string]domain.TrainingData {
	moves := make(map[string]domain.TrainingData)
	var walk func(node domain.ChapterTreeNode, path string)
	walk = func(node domain.ChapterTreeNode, path string) {
		moves[path] = node.Data
		for _, child := range node.Children {
			walk(child, path+child.Data.ID)
		}
	}
	walk(root, "")
	return moves
}

// buildTree reconstructs a tree of ChapterTreeNode from a flat
// path->TrainingData map. Paths are sorted by length so parents are
// always created before children. Each ID is a fixed-length 2-char
// string (from scalachessCharPair), so the parent of path P is
// P[:len(P)-2].
func buildTree(moves map[string]domain.TrainingData) domain.ChapterTreeNode {
	paths := make([]string, 0, len(moves))
	for p := range moves {
		paths = append(paths, p)
	}
	sort.Slice(paths, func(i, j int) bool {
		return len(paths[i]) < len(paths[j])
	})

	nodeMap := make(map[string]*domain.ChapterTreeNode, len(moves))

	rootData := moves[""]
	root := domain.ChapterTreeNode{Data: rootData, Children: []domain.ChapterTreeNode{}}
	nodeMap[""] = &root

	for _, p := range paths {
		if p == "" {
			continue
		}
		data := moves[p]
		node := domain.ChapterTreeNode{Data: data, Children: []domain.ChapterTreeNode{}}

		parentPath := p[:len(p)-2]
		parent, ok := nodeMap[parentPath]
		if !ok {
			parent = &root
		}
		parent.Children = append(parent.Children, node)
		nodeMap[p] = &parent.Children[len(parent.Children)-1]
	}

	return root
}
