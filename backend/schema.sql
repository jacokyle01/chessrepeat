--   psql "$POSTGRES_URL" -f schema.sql

CREATE TABLE users (
    token_id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT NOT NULL,
    picture TEXT NOT NULL DEFAULT '',
    limit_multiplier INT NOT NULL DEFAULT 1
);

CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (token_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- 'edit' = full CRUD on chapters, moves, training cards.
-- 'train' = read-only on repetroires, write/update for personal training stat
CREATE TABLE collaborators (
    owner_id TEXT NOT NULL REFERENCES users (token_id) ON DELETE CASCADE,
    collaborator_id TEXT NOT NULL REFERENCES users (token_id) ON DELETE CASCADE,
    permission TEXT NOT NULL DEFAULT 'edit' CHECK (
        permission IN ('edit', 'train')
    ),
    PRIMARY KEY (owner_id, collaborator_id)
);

CREATE INDEX collaborators_collaborator ON collaborators (collaborator_id);

CREATE TABLE chapters (
    uuid TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users (token_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    train_as TEXT NOT NULL
);

CREATE INDEX chapters_owner ON chapters (owner_id);

CREATE TABLE moves (
    chapter_id TEXT NOT NULL REFERENCES chapters (uuid) ON DELETE CASCADE,
    path TEXT NOT NULL,
    id TEXT NOT NULL,
    fen TEXT NOT NULL,
    ply INT NOT NULL,
    san TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    enabled BOOL NOT NULL,
    PRIMARY KEY (chapter_id, path)
);
x
CREATE INDEX moves_chapter_path_prefix ON moves (
    chapter_id,
    path text_pattern_ops
);

CREATE TABLE training_cards (
    chapter_id TEXT NOT NULL,
    path TEXT NOT NULL,
    username TEXT NOT NULL,
    due TEXT NOT NULL,
    stability DOUBLE PRECISION NOT NULL,
    difficulty DOUBLE PRECISION NOT NULL,
    elapsed_days INT NOT NULL,
    scheduled_days INT NOT NULL,
    reps INT NOT NULL,
    lapses INT NOT NULL,
    state INT NOT NULL,
    last_review TEXT NOT NULL,
    PRIMARY KEY (chapter_id, path, username),
    FOREIGN KEY (chapter_id, path) REFERENCES moves (chapter_id, path) ON DELETE CASCADE
);