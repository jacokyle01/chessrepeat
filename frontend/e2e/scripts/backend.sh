#!/usr/bin/env bash
# Boots the Go server for the `authed` Playwright project against a fresh
# database. Expects a reachable Postgres superuser URL in E2E_POSTGRES_URL
# (default matches `npm run test:e2e:db`); the e2e database is dropped and
# recreated from backend/schema.sql on every run so tests start clean.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
backend="$here/../../../backend"
tmp="$here/../.tmp"
mkdir -p "$tmp"

admin_url="${E2E_POSTGRES_URL:-postgres://e2e:e2e@localhost:5433/postgres?sslmode=disable}"
db="chessrepeat_e2e"
# Same server, different database: swap the path component.
db_url="$(printf '%s' "$admin_url" | sed -E "s#/[^/?]*(\?|$)#/$db\1#")"

echo "e2e: resetting $db"
psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db"
psql "$db_url" -v ON_ERROR_STOP=1 -q -f "$backend/schema.sql"

echo "e2e: building server"
(cd "$backend" && go build -o "$tmp/server" ./cmd/server)

export POSTGRES_URL="$db_url"
export FIREBASE_PROJECT_ID="chessrepeat-e2e"
export FIREBASE_CERTS_URL="http://localhost:${E2E_CERTS_PORT:-8090}/"
export ALLOWED_ORIGINS="http://localhost:${E2E_WEB_PORT:-5179}"
export LISTEN_ADDR=":${E2E_API_PORT:-8089}"
export COOKIE_SECURE="false"
export HINT_COOKIE_DOMAIN=""

# Run from .tmp so a developer's backend/.env can't leak into the test
# server (config.Load reads .env from the working directory).
cd "$tmp"
exec ./server
