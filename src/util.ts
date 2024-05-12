import { Chess, SQUARES } from "chess.js";
import { Color, Key } from "chessground/types";


export function toColor(chess: Chess): Color {
    return (chess.turn() === 'w') ? 'white' : 'black';
  }

  export function toDests(chess: Chess): Map<Key, Key[]> {
    const dests = new Map();
    SQUARES.forEach(s => {
      const ms = chess.moves({square: s, verbose: true});
      if (ms.length) dests.set(s, ms.map(m => m.to));
    });
    return dests;
  }