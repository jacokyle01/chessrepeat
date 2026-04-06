DROP TABLE IF EXISTS chapter;

DROP TABLE IF EXISTS repertoire_member;

DROP TABLE IF EXISTS repertoire;

DROP TABLE IF EXISTS move;

DROP TABLE IF EXISTS user;

CREATE TABLE user (
    token_id VARCHAR(255) PRIMARY KEY, -- use id token from oauth to identify user. problems w security,vendor lock,expire?
    name VARCHAR(255),
    email VARCHAR(255),
    picture VARCHAR(512)
);

CREATE TABLE move (
    move_id CHAR(36),
    prev_moves TEXT,
    repertoire_id CHAR(36),
    san VARCHAR(8) NOT NULL,
    PRIMARY KEY (repertoire_id, move_id)
);

-- each user one and only one repertoire

CREATE TABLE repertoire (
    repertoire_id CHAR(36) PRIMARY KEY,
    owner_id VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users (token_id) ON DELETE CASCADE
);

CREATE TABLE repertoire_member (
    repertoire_id CHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role ENUM('viewer', 'editor') NOT NULL,
    granted_by VARCHAR(255) NOT NULL,
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (repertoire_id, user_id),
    FOREIGN KEY (repertoire_id) REFERENCES repertoire (repertoire_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (token_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users (token_id)
);

CREATE TABLE chapter (
    chapter_id CHAR(36) PRIMARY KEY, -- generated client-side
    repertoire_id CHAR(36) NOT NULL,
    FOREIGN KEY (repertoire_id) REFERENCES repertoire (repertoire_id) ON DELETE CASCADE
    -- TODO revisions field? or something for conflicts
    -- TODO moves field
);