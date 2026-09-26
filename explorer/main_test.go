package main

import (
	"testing"

	"github.com/corentings/chess"
)

// Imports key positions built move-by-move (corentings always sets the ep
// square after a double push); queries arrive as client FENs from chessops,
// which only include ep when a capture is legal and may carry "-" castling.
// All must map to the same key.
func TestPositionKeyMatchesFrontendFens(t *testing.T) {
	game := chess.NewGame()
	for _, m := range []string{"e4", "d5", "e5", "f5"} {
		if err := game.MoveStr(m); err != nil {
			t.Fatal(err)
		}
	}
	imported := positionKey(game.Position())

	for _, fen := range []string{
		"rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3", // ep capture legal
		"rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
		"rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w - f6 0 3", // frontend node with lost castling
		"rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w - - 0 3",
	} {
		var pos chess.Position
		if err := pos.UnmarshalText([]byte(fen)); err != nil {
			t.Fatalf("parse %q: %v", fen, err)
		}
		if got := positionKey(&pos); got != imported {
			t.Errorf("key for %q = %q, want %q", fen, got, imported)
		}
	}

	// After 1. c3, as the frontend sends it (no castling rights).
	game = chess.NewGame()
	if err := game.MoveStr("c3"); err != nil {
		t.Fatal(err)
	}
	var pos chess.Position
	if err := pos.UnmarshalText([]byte("rnbqkbnr/pppppppp/8/8/8/2P5/PP1PPPPP/RNBQKBNR b - - 0 1")); err != nil {
		t.Fatal(err)
	}
	if got, want := positionKey(&pos), positionKey(game.Position()); got != want {
		t.Errorf("key after 1. c3 = %q, want %q", got, want)
	}
}
