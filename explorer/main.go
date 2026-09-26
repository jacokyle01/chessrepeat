package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/cockroachdb/pebble"
	"github.com/corentings/chess"
)

// positionKey is the pebble key for a position: piece placement and side
// to move only. It deliberately drops castling rights, the en passant
// square and the move counters from the FEN.
//
// Imports build positions move-by-move with corentings, while queries
// arrive as FENs built by the frontend (chessops), and the two disagree
// on everything past side to move:
//   - ep: corentings always sets it after a double push; chessops only
//     when a capture is legal.
//   - castling: the frontend's move tree can carry "-" where the import
//     has "KQkq" (nodes built from a board-only root FEN).
//
// Keying on the fields both sides agree on makes lookups match, and also
// lets transpositions aggregate, which is what an opening explorer wants.
func positionKey(pos *chess.Position) string {
	fields := strings.Fields(pos.String())
	if len(fields) >= 2 {
		return strings.Join(fields[:2], " ")
	}
	return pos.String()
}

func main() {
	// DB_PATH lets deployments point pebble at a mounted volume; defaults
	// to a relative "chess" dir for local runs.
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "chess"
	}
	// LISTEN_ADDR keeps the bind address configurable across environments.
	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = ":8090"
	}

	options := &pebble.Options{
		Merger: &pebble.Merger{
			Name: "chess.stats.merger",
			Merge: func(key, value []byte) (pebble.ValueMerger, error) {
				// pebble reuses value's buffer after Merge returns, so the
				// merger must own a copy or merged stats get corrupted.
				return &statsMerger{current: bytes.Clone(value)}, nil
			},
		},
	}
	db, err := pebble.Open(dbPath, options)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	mux := http.NewServeMux()
	// The explorer is an internal-only service (never routed from the
	// public internet), so there's no auth: reachability is the boundary.
	// Only the chessrepeat backend and the on-box import CLI can connect.
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("PUT /import", importHandler(db))
	mux.HandleFunc("GET /query", queryHandler(db))

	log.Printf("listening on %s", listenAddr)
	log.Fatal(http.ListenAndServe(listenAddr, mux))
}

type Payload struct {
	Winner chess.Color `json:"winner"`
	Moves  []string    `json:"moves"`
}

type PebbleKey struct {
	PositionHash string `json:"positionHash"`
}

// opening explorer will display this for each move played at some position type Result
type PebbleValue struct {
	Results []ResultSummary `json:"results"`
}

type ResultSummary struct {
	San       string `json:"san"`
	WhiteWins int    `json:"whiteWins"`
	BlackWins int    `json:"blackWins"`
	Draws     int    `json:"draw"`
}

// ImportResult reports how many games of a batch were indexed. Games with
// an illegal or unparseable move are skipped whole rather than failing the
// batch, so one bad game in a large PGN doesn't drop its neighbours.
type ImportResult struct {
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
}

func importHandler(db *pebble.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var p []Payload
		if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
			http.Error(w, `{"error": "Invalid request payload"}`, http.StatusBadRequest)
			return
		}

		// Aggregate the whole batch in memory first: position key -> san ->
		// counts. Every game passes through the same opening positions, so
		// this collapses thousands of per-move merges into one per position.
		agg := map[string]map[string]*ResultSummary{}
		var result ImportResult
		for _, rawGame := range p {
			// Validate the game fully before touching agg, so a bad move
			// late in a game doesn't leave its earlier moves counted.
			keys, ok := gameKeys(rawGame.Moves)
			if !ok {
				result.Skipped++
				continue
			}
			result.Imported++
			for i, move := range rawGame.Moves {
				moves := agg[keys[i]]
				if moves == nil {
					moves = map[string]*ResultSummary{}
					agg[keys[i]] = moves
				}
				summary := moves[move]
				if summary == nil {
					summary = &ResultSummary{San: move}
					moves[move] = summary
				}
				switch rawGame.Winner {
				case chess.White:
					summary.WhiteWins++
				case chess.Black:
					summary.BlackWins++
				default:
					summary.Draws++
				}
			}
		}

		// One pebble batch and one fsync for the whole request.
		batch := db.NewBatch()
		defer batch.Close()
		for key, moves := range agg {
			value := PebbleValue{Results: make([]ResultSummary, 0, len(moves))}
			for _, summary := range moves {
				value.Results = append(value.Results, *summary)
			}
			valBytes, err := json.Marshal(value)
			if err != nil {
				http.Error(w, `{"error": "Failed to encode stats"}`, http.StatusInternalServerError)
				return
			}
			// Merge so repeated positions accumulate via statsMerger.
			if err := batch.Merge([]byte(key), valBytes, nil); err != nil {
				http.Error(w, `{"error": "Failed to store position"}`, http.StatusInternalServerError)
				return
			}
		}
		if err := batch.Commit(pebble.Sync); err != nil {
			http.Error(w, `{"error": "Failed to store position"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}
}

// gameKeys replays a game and returns, for each move, the key of the
// position the move is played FROM (so the explorer can map a position to
// the moves played from it). ok is false if any move is illegal.
//
// Replays on a bare Position rather than a chess.Game: Game checks for
// repetitions after every move by stringifying every earlier position,
// which is quadratic in game length and dominated import time.
func gameKeys(moves []string) (keys []string, ok bool) {
	pos := chess.StartingPosition()
	keys = make([]string, len(moves))
	for i, san := range moves {
		keys[i] = positionKey(pos)
		// Decode only matches legal moves in pos.
		m, err := chess.AlgebraicNotation{}.Decode(pos, san)
		if err != nil {
			return nil, false
		}
		pos = pos.Update(m)
	}
	return keys, true
}

func queryHandler(db *pebble.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. (Optional) Enforce the correct HTTP method
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// 2. Read the FEN from the query string (e.g. /query?fen=...)
		fen := r.URL.Query().Get("fen")
		if fen == "" {
			http.Error(w, "Missing 'fen' query parameter", http.StatusBadRequest)
			return
		}

		var pos chess.Position
		if err := pos.UnmarshalText([]byte(fen)); err != nil {
			http.Error(w, "Invalid FEN", http.StatusBadRequest)
			return
		}
		stats, err := GetPositionStats(db, PebbleKey{PositionHash: positionKey(&pos)})
		if err != nil {
			http.Error(w, "Error /w DB", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		// 4. Encode and send the response
		if err := json.NewEncoder(w).Encode(stats); err != nil {
			// If encoding fails, handle the error (optional since headers are already sent)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
}

// statsMerger implements pebble.ValueMerger
type statsMerger struct {
	current []byte
}

func (m *statsMerger) MergeNewer(value []byte) error {
	updated, err := mergeResultSummaries(m.current, value)
	if err != nil {
		return err
	}
	m.current = updated
	return nil
}

// MergeOlder is identical to MergeNewer: summing per-move counts is
// order-independent, so operand ordering does not matter.
func (m *statsMerger) MergeOlder(value []byte) error {
	updated, err := mergeResultSummaries(m.current, value)
	if err != nil {
		return err
	}
	m.current = updated
	return nil
}

func (m *statsMerger) Finish(bool) ([]byte, io.Closer, error) {
	return m.current, nil, nil
}

// look up stats for a position
func GetPositionStats(db *pebble.DB, key PebbleKey) (*PebbleValue, error) {
	valBytes, closer, err := db.Get([]byte(key.PositionHash))
	if err != nil {
		if errors.Is(err, pebble.ErrNotFound) {
			return nil, nil // Return nil if the position has no games played yet
		}
		return nil, fmt.Errorf("failed to get key from pebble: %w", err)
	}

	defer func() {
		if err := closer.Close(); err != nil {
		}
	}()

	// 3. Unmarshal the JSON bytes back into the PebbleValue struct
	var stats PebbleValue
	if err := json.Unmarshal(valBytes, &stats); err != nil {
		return nil, fmt.Errorf("failed to unmarshal value: %w", err)
	}

	return &stats, nil
}
