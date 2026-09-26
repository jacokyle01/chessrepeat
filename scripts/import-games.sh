#!/usr/bin/env bash
# Import a PGN file into the opening explorer.
#
# Parses the PGN and PUTs each game to the explorer's /import endpoint.
# The explorer is internal-only, so this runs against its loopback port
# on the VPS (or wherever the explorer publishes 127.0.0.1:8090).
#
# Usage:
#   scripts/import-games.sh <pgn-file> [endpoint]
#
# Examples:
#   scripts/import-games.sh games.pgn
#   scripts/import-games.sh games.pgn http://127.0.0.1:8090/import
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: $0 <pgn-file> [endpoint]" >&2
  exit 1
fi

PGN="$1"
ENDPOINT="${2:-http://127.0.0.1:8090/import}"

if [ ! -f "$PGN" ]; then
  echo "error: PGN file not found: $PGN" >&2
  exit 1
fi

# Resolve paths so the script works from any cwd. The importer is the Go
# CLI that ships with the explorer module.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPLORER_DIR="$SCRIPT_DIR/../explorer"
PGN_ABS="$(cd "$(dirname "$PGN")" && pwd)/$(basename "$PGN")"

echo "importing $PGN_ABS -> $ENDPOINT"
cd "$EXPLORER_DIR"
go run ./cmd/import-pgn "$PGN_ABS" "$ENDPOINT"
echo "done"
