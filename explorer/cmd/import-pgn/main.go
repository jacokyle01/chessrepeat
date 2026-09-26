package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/corentings/chess"
)

// Payload is the per-game body sent to the /import endpoint.
type Payload struct {
	Winner chess.Color `json:"winner"`
	Moves  []string    `json:"moves"`
}

// winner maps a game outcome to the winning color, or NoColor for a draw/no result.
func winner(o chess.Outcome) chess.Color {
	switch o {
	case chess.WhiteWon:
		return chess.White
	case chess.BlackWon:
		return chess.Black
	default:
		return chess.NoColor
	}
}

// batchSize is how many games go in each PUT. The server aggregates a
// batch in memory and commits it with a single fsync, so larger batches
// mean far fewer syncs; 1000 games is ~a few hundred KB of JSON.
const batchSize = 1000

// importResult mirrors the server's ImportResult.
type importResult struct {
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
}

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: import-pgn <pgn-file> <api-url>")
		os.Exit(1)
	}

	pgnPath := os.Args[1]
	apiPath := os.Args[2]

	f, err := os.Open(pgnPath)
	if err != nil {
		panic(err)
	}
	defer f.Close()

	client := &http.Client{}
	notation := chess.AlgebraicNotation{}
	var total importResult

	send := func(batch []Payload) {
		jsonData, err := json.Marshal(batch)
		if err != nil {
			fmt.Printf("Error marshaling payload: %v\n", err)
			os.Exit(1)
		}
		req, err := http.NewRequest("PUT", apiPath, bytes.NewBuffer(jsonData))
		if err != nil {
			fmt.Printf("Error creating request: %v\n", err)
			os.Exit(1)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			fmt.Printf("Error sending request: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			fmt.Printf("Import failed: %s %s\n", resp.Status, body)
			os.Exit(1)
		}
		var res importResult
		if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
			fmt.Printf("Error decoding response: %v\n", err)
			os.Exit(1)
		}
		total.Imported += res.Imported
		total.Skipped += res.Skipped
		fmt.Printf("imported %d games (%d skipped)\n", total.Imported, total.Skipped)
	}

	batch := make([]Payload, 0, batchSize)
	scanner := chess.NewScanner(f)
	// for each game
	for scanner.Scan() {
		game := scanner.Next()
		if game == nil {
			continue
		}

		// Encode each move in the game's notation (SAN), matching what the
		// server decodes with game.MoveStr.
		moves := game.Moves()
		positions := game.Positions()
		notated := make([]string, len(moves))
		for i, m := range moves {
			notated[i] = notation.Encode(positions[i], m)
		}

		// can also add filtering step here...
		batch = append(batch, Payload{Winner: winner(game.Outcome()), Moves: notated})
		if len(batch) == batchSize {
			send(batch)
			batch = batch[:0]
		}
	}
	if len(batch) > 0 {
		send(batch)
	}
}
