import { TrainingData } from 'chess-srs/types';
import { Chess, SQUARES } from 'chess.js';
import { Color, Key } from 'chessground/types';
import { ChildNode } from 'chessops/pgn';

export const toColor = (chess: Chess): Color => {
  return chess.turn() === 'w' ? 'white' : 'black';
}

export const toDests = (chess: Chess): Map<Key, Key[]> => {
  const dests = new Map();
  SQUARES.forEach((s) => {
    const ms = chess.moves({ square: s, verbose: true });
    if (ms.length)
      dests.set(
        s,
        ms.map((m) => m.to),
      );
  });
  return dests;
}

export const stringifyPath = (path: ChildNode<TrainingData>[]): string[] => {
  return path.map((node) => node.data.san);
};
