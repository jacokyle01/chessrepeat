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
	// Enforce the per-chapter move cap before opening a transaction.
	// flattenTree includes the root placeholder at path ''; that's not
	// a move, so it doesn't count toward the cap.
	moves := flattenTree(event.Root)
	moveCount := len(moves)
	println(moveCount)
	if _, hasRoot := moves[""]; hasRoot {
		moveCount--
	}
	if moveCount > MaxMovesPerChapter {
		return ErrChapterMoveLimit
	}

	tx, err := db.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO chapters
			(uuid, owner_id, name, train_as)
		VALUES ($1, $2, $3, $4)
	`,
		event.ChapterID, event.OwnerID, event.Name, event.TrainAs,
	)
	if err != nil {
		return err
	}

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

// RenameChapter updates a chapter's display name. Idempotent and a
// no-op if the chapter doesn't exist (the next reload reconciles), same
// soft-failure mode as DeleteChapter.
func (db *DB) RenameChapter(ctx context.Context, chapterID, name string) error {
	_, err := db.pool.Exec(ctx,
		`UPDATE chapters SET name = $2 WHERE uuid = $1`,
		chapterID, name)
	return err
}

// DeleteChapter removes a chapter row. Moves and training_cards cascade
// via FK ON DELETE CASCADE.
func (db *DB) DeleteChapter(ctx context.Context, chapterID string) error {
	_, err := db.pool.Exec(ctx,
		`DELETE FROM chapters WHERE uuid = $1`, chapterID)
	return err
}

// ErrPathNotFound is returned by tree-mutating store ops when the anchor
// path they target has no move row — i.e. the client's in-memory tree
// has drifted from the server's. The ws dispatch layer surfaces this to
// the originating client as a reload signal so it can resync.
var ErrPathNotFound = errors.New("store: path not found")

// MaxMovesPerChapter caps how many real moves a single chapter may hold
// (the root placeholder row at path ” is not a move and doesn't count).
// Enforced server-side on every move/chapter insert; the offending
// client is told to reload so it discards the rejected local mutation.
// Single tunable knob — raise/lower here.
const MaxMovesPerChapter = 12000

// ErrChapterMoveLimit is returned when an insert would push a chapter
// past MaxMovesPerChapter. Surfaced to the originating client as a
// reload, same as ErrPathNotFound.
var ErrChapterMoveLimit = errors.New("store: chapter move limit exceeded")

// MaxCommentChars caps a single move's comment. Enforced server-side by
// truncating (in the ws dispatch layer, which then broadcasts the
// canonical truncated text); the frontend mirrors the limit at the
// textarea so users hit it before round-trip.
const MaxCommentChars = 1000

// chapterMoveCount returns the number of real moves in a chapter. The
// root placeholder (path ”) is excluded so the count lines up with the
// "at most X moves" cap as a user would count moves.
func (db *DB) chapterMoveCount(ctx context.Context, chapterID string) (int, error) {
	var n int
	err := db.pool.QueryRow(ctx,
		`SELECT count(*) FROM moves WHERE chapter_id = $1 AND path <> ''`,
		chapterID).Scan(&n)
	return n, err
}

// AddMoveToChapter upserts a single move. The key is the move's path
// (parent path + move ID).
//
// The parent we attach to is event.Path; an empty parent path is the
// chapter root, which always exists (it has no move row). For any deeper
// parent we require the row to exist first: without that guard a move
// added under a path the server never saw would be silently inserted as
// an orphan, permanently diverging this client from everyone else.
func (db *DB) AddMoveToChapter(ctx context.Context, event domain.MoveEvent) error {
	if event.Path != "" {
		ok, err := db.pathExists(ctx, event.ChapterID, event.Path)
		if err != nil {
			return err
		}
		if !ok {
			return ErrPathNotFound
		}
	}
	movePath := event.Path + event.Move.ID

	// Enforce the per-chapter cap, but only for a genuinely new move.
	// Re-sending an existing path is an idempotent upsert (e.g. a
	// comment edit or enabled toggle) and must not be rejected just
	// because the chapter is already at the cap. Like the path guards
	// above this is check-then-write, not transactional, so concurrent
	// adds could overshoot by a few — acceptable for a soft cap.
	exists, err := db.pathExists(ctx, event.ChapterID, movePath)
	if err != nil {
		return err
	}
	if !exists {
		n, err := db.chapterMoveCount(ctx, event.ChapterID)
		if err != nil {
			return err
		}
		if n >= MaxMovesPerChapter {
			return ErrChapterMoveLimit
		}
	}

	_, err = db.pool.Exec(ctx, `
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
// The INSERT...SELECT WHERE EXISTS guard means a missing move row makes
// the statement affect zero rows instead of raising an FK error. We
// treat that as ErrPathNotFound so the caller can tell the originating
// client its tree drifted and to resync, rather than silently dropping
// the training update.
func (db *DB) UpdateTrainingState(ctx context.Context, event domain.TrainingUpdatedEvent) error {
	c := event.Card
	tag, err := db.pool.Exec(ctx, `
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
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrPathNotFound
	}
	return nil
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
	if err != nil {
		return err
	}
	if !ok {
		// Empty path is the chapter root — a deliberate no-op (clients
		// send chapter_deleted instead). A non-empty path that doesn't
		// exist means the client's tree drifted from the server's;
		// surface that so the caller can be told to resync.
		if event.Path == "" {
			return nil
		}
		return ErrPathNotFound
	}
	_, err = db.pool.Exec(ctx, `
		DELETE FROM moves
		WHERE chapter_id = $1
		  AND (path = $2 OR path LIKE $3 || '%' ESCAPE '\')
	`, event.ChapterID, event.Path, escapeLike(event.Path))
	return err
}

// SetComment writes a node's comment. Caller is responsible for
// enforcing MaxCommentChars (the dispatch layer truncates before
// calling, so we can broadcast the canonical text). A missing move row
// returns ErrPathNotFound so the caller can reload the sender — mirrors
// the path guard used by AddMoveToChapter and friends.
func (db *DB) SetComment(ctx context.Context, chapterID, path, comment string) error {
	tag, err := db.pool.Exec(ctx, `
		UPDATE moves SET comment = $3
		WHERE chapter_id = $1 AND path = $2
	`, chapterID, path, comment)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrPathNotFound
	}
	return nil
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
		SELECT uuid, name, train_as
		FROM chapters
		WHERE owner_id = $1
	`, ownerID)
	if err != nil {
		return nil, err
	}
	type chapterRow struct {
		uuid          string
		name, trainAs string
	}
	var chRowsBuf []chapterRow
	for chRows.Next() {
		var r chapterRow
		if err := chRows.Scan(&r.uuid, &r.name, &r.trainAs); err != nil {
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
			UUID:    r.uuid,
			Name:    r.name,
			TrainAs: r.trainAs,
			Root:    buildTree(movesByChapter[r.uuid]),
		})
	}
	return chapters, nil
}

// ReadChapterAsTree fetches one chapter and rebuilds the move tree.
func (db *DB) ReadChapterAsTree(ctx context.Context, chapterID string) (*domain.ChapterTreeResponse, error) {
	var resp domain.ChapterTreeResponse
	err := db.pool.QueryRow(ctx, `
		SELECT uuid, name, train_as
		FROM chapters
		WHERE uuid = $1
	`, chapterID).Scan(&resp.UUID, &resp.Name, &resp.TrainAs)
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
	var walk func(node *domain.ChapterTreeNode, path string)
	walk = func(node *domain.ChapterTreeNode, path string) {
		if node == nil {
			return
		}
		moves[path] = node.Data
		for _, child := range node.Children {
			walk(child, path+child.Data.ID)
		}
	}
	walk(&root, "")
	return moves
}

// buildTree reconstructs a tree of ChapterTreeNode from a flat
// path->TrainingData map. Paths are sorted by length so parents are
// always created before children. Each ID is a fixed-length 2-char
// string (from scalachessCharPair), so the parent of path P is
// P[:len(P)-2].
//
// Children are stored as []*ChapterTreeNode (see the type's doc): each
// node is heap-allocated once and nodeMap holds that stable pointer.
// An earlier version stored &parent.Children[i] into nodeMap, which
// silently dropped subtrees when a parent's slice reallocated and
// orphaned every previously-taken element pointer.
func buildTree(moves map[string]domain.TrainingData) domain.ChapterTreeNode {
	paths := make([]string, 0, len(moves))
	for p := range moves {
		paths = append(paths, p)
	}
	sort.Slice(paths, func(i, j int) bool {
		return len(paths[i]) < len(paths[j])
	})

	nodeMap := make(map[string]*domain.ChapterTreeNode, len(moves))

	root := &domain.ChapterTreeNode{
		Data:     moves[""],
		Children: []*domain.ChapterTreeNode{},
	}
	nodeMap[""] = root

	for _, p := range paths {
		if p == "" {
			continue
		}
		node := &domain.ChapterTreeNode{
			Data:     moves[p],
			Children: []*domain.ChapterTreeNode{},
		}

		parentPath := p[:len(p)-2]
		parent, ok := nodeMap[parentPath]
		if !ok {
			parent = root
		}
		parent.Children = append(parent.Children, node)
		nodeMap[p] = node
	}

	return *root
}
