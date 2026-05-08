package store

import (
	"context"
	"errors"

	"chessrepeat/internal/domain"
	"github.com/jackc/pgx/v5"
)

// AddCollaborator grants `collaboratorID` access to `ownerID`'s chapters
// at the given permission level ('edit' or 'train'). The (owner, collab)
// pair is unique, so re-adding updates the permission rather than
// inserting a duplicate.
func (db *DB) AddCollaborator(ctx context.Context, ownerID, collaboratorID, permission string) error {
	_, err := db.pool.Exec(ctx, `
		INSERT INTO collaborators (owner_id, collaborator_id, permission)
		VALUES ($1, $2, $3)
		ON CONFLICT (owner_id, collaborator_id) DO UPDATE SET
			permission = EXCLUDED.permission
	`, ownerID, collaboratorID, permission)
	return err
}

func (db *DB) RemoveCollaborator(ctx context.Context, ownerID string, collaboratorID string) error {
	_, err := db.pool.Exec(ctx, `
		DELETE FROM collaborators
		WHERE owner_id = $1 AND collaborator_id = $2
	`, ownerID, collaboratorID)
	return err
}

// FetchOutgoingCollaborators returns the users I have added as
// collaborators on my chapters, with their per-row permission.
func (db *DB) FetchOutgoingCollaborators(ctx context.Context, ownerID string) ([]domain.CollaboratorView, error) {
	return db.queryCollaboratorViews(ctx, `
		SELECT u.username, u.picture, c.permission
		FROM collaborators c
		JOIN users u ON u.token_id = c.collaborator_id
		WHERE c.owner_id = $1 AND u.username IS NOT NULL
	`, ownerID)
}

// FetchIncomingCollaborators returns the owners who have granted me
// access to their chapters, with the permission they granted me.
func (db *DB) FetchIncomingCollaborators(ctx context.Context, userID string) ([]domain.CollaboratorView, error) {
	return db.queryCollaboratorViews(ctx, `
		SELECT u.username, u.picture, c.permission
		FROM collaborators c
		JOIN users u ON u.token_id = c.owner_id
		WHERE c.collaborator_id = $1 AND u.username IS NOT NULL
	`, userID)
}

func (db *DB) queryCollaboratorViews(ctx context.Context, sql string, arg string) ([]domain.CollaboratorView, error) {
	rows, err := db.pool.Query(ctx, sql, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]domain.CollaboratorView, 0)
	for rows.Next() {
		var v domain.CollaboratorView
		if err := rows.Scan(&v.Username, &v.Picture, &v.Permission); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// CanViewRepertoire returns true if viewer is the owner or has any
// collaborator row (regardless of permission — both 'edit' and 'train'
// can view). Drives the /repertoire?owner= auth check and the
// WebSocket handshake.
func (db *DB) CanViewRepertoire(ctx context.Context, ownerID string, viewerID string) (bool, error) {
	perm, err := db.EffectivePermissionOnRepertoire(ctx, ownerID, viewerID)
	if err != nil {
		return false, err
	}
	return perm != "", nil
}

// EffectivePermissionOnRepertoire resolves what userID is allowed to do
// against ownerID's repertoire: PermissionOwner if they're the owner,
// the row's stored permission (PermissionEdit / PermissionTrain) if a
// collaborator row exists, or "" if neither.
func (db *DB) EffectivePermissionOnRepertoire(ctx context.Context, ownerID, userID string) (string, error) {
	if ownerID == userID {
		return domain.PermissionOwner, nil
	}
	var perm string
	err := db.pool.QueryRow(ctx, `
		SELECT permission FROM collaborators
		WHERE owner_id = $1 AND collaborator_id = $2
	`, ownerID, userID).Scan(&perm)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return perm, nil
}

// EffectivePermissionOnChapter resolves what userID is allowed to do
// against the chapter identified by chapterID. Anchored on the chapter's
// own owner_id rather than the WebSocket room, so a client cannot bypass
// authz by joining one room and submitting a chapterId from another.
//
// Returns "" for both "chapter not found" and "no permission" so callers
// don't have to distinguish (and so we don't leak which one it was).
func (db *DB) EffectivePermissionOnChapter(ctx context.Context, chapterID, userID string) (string, error) {
	var (
		ownerID string
		perm    *string
	)
	err := db.pool.QueryRow(ctx, `
		SELECT c.owner_id, col.permission
		FROM chapters c
		LEFT JOIN collaborators col
		  ON col.owner_id = c.owner_id AND col.collaborator_id = $2
		WHERE c.uuid = $1
	`, chapterID, userID).Scan(&ownerID, &perm)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if ownerID == userID {
		return domain.PermissionOwner, nil
	}
	if perm == nil {
		return "", nil
	}
	return *perm, nil
}
