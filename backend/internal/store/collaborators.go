package store

import (
	"context"
	"errors"

	"chessrepeat/internal/domain"
	"github.com/jackc/pgx/v5"
)

// AddCollaborator grants `collaboratorID` access to `ownerID`'s chapters.
// The collaborators table is keyed by (owner_id, collaborator_id), so
// re-adding the same pair is a no-op via ON CONFLICT.
//
// TODO add a permissions column later (e.g. read/write/admin).
func (db *DB) AddCollaborator(ownerID string, collaboratorID string) error {
	_, err := db.pool.Exec(context.TODO(), `
		INSERT INTO collaborators (owner_id, collaborator_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, ownerID, collaboratorID)
	return err
}

func (db *DB) RemoveCollaborator(ownerID string, collaboratorID string) error {
	_, err := db.pool.Exec(context.TODO(), `
		DELETE FROM collaborators
		WHERE owner_id = $1 AND collaborator_id = $2
	`, ownerID, collaboratorID)
	return err
}

// FetchOutgoingCollaborators returns the users I have added as
// collaborators on my chapters.
func (db *DB) FetchOutgoingCollaborators(ownerID string) ([]domain.CollaboratorView, error) {
	return db.queryCollaboratorViews(`
		SELECT u.username, u.picture
		FROM collaborators c
		JOIN users u ON u.token_id = c.collaborator_id
		WHERE c.owner_id = $1 AND u.username IS NOT NULL
	`, ownerID)
}

// FetchIncomingCollaborators returns the owners who have granted me
// access to their chapters.
func (db *DB) FetchIncomingCollaborators(userID string) ([]domain.CollaboratorView, error) {
	return db.queryCollaboratorViews(`
		SELECT u.username, u.picture
		FROM collaborators c
		JOIN users u ON u.token_id = c.owner_id
		WHERE c.collaborator_id = $1 AND u.username IS NOT NULL
	`, userID)
}

func (db *DB) queryCollaboratorViews(sql string, arg string) ([]domain.CollaboratorView, error) {
	rows, err := db.pool.Query(context.TODO(), sql, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.CollaboratorView, 0)
	for rows.Next() {
		var v domain.CollaboratorView
		if err := rows.Scan(&v.Username, &v.Picture); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// CanViewRepertoire returns true if viewer is the owner or has been
// granted collaborator access. Drives the /repertoire?owner= auth check.
func (db *DB) CanViewRepertoire(ownerID string, viewerID string) (bool, error) {
	if ownerID == viewerID {
		return true, nil
	}
	var exists bool
	err := db.pool.QueryRow(context.TODO(), `
		SELECT EXISTS (
			SELECT 1 FROM collaborators
			WHERE owner_id = $1 AND collaborator_id = $2
		)
	`, ownerID, viewerID).Scan(&exists)
	return exists, err
}

// CanCollaborateOnRepertoire returns true if userID may write to chapters
// owned by ownerID. Currently identical to CanViewRepertoire; kept as
// its own function so a future read-only collaborator role can diverge
// here without loosening the view path.
func (db *DB) CanCollaborateOnRepertoire(ownerID, userID string) (bool, error) {
	return db.CanViewRepertoire(ownerID, userID)
}

// CanCollaborateOnChapter returns true if userID may mutate the chapter
// identified by chapterID. The check is anchored on the chapter's own
// owner_id (not the WebSocket room), so a client cannot bypass authz by
// joining one room and submitting a chapterId from another: they're
// authorized if and only if they own, or have been added as a
// collaborator on, the user that actually owns the chapter.
//
// A missing chapter returns (false, nil) so callers can treat "not
// found" the same as "forbidden" without leaking which one it was.
func (db *DB) CanCollaborateOnChapter(chapterID, userID string) (bool, error) {
	var allowed bool
	err := db.pool.QueryRow(context.TODO(), `
		SELECT
			c.owner_id = $2
			OR EXISTS (
				SELECT 1 FROM collaborators
				WHERE owner_id = c.owner_id AND collaborator_id = $2
			)
		FROM chapters c
		WHERE c.uuid = $1
	`, chapterID, userID).Scan(&allowed)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return allowed, nil
}
