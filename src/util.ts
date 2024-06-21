import { TrainingData } from 'chess-srs/types';
// import { Chess, SQUARES } from 'chess.js';
import { Dests, Key } from 'chessground/types';
import { Chess, parseUci } from 'chessops';
import { chessgroundDests, chessgroundMove } from 'chessops/compat';
import { parseFen } from 'chessops/fen';
import { ChildNode } from 'chessops/pgn';
import { makeSan, parseSan } from 'chessops/san';

// export const toColor = (chess: Chess): Color => {
//   return chess.turn() === 'w' ? 'white' : 'black';
// }

// export const toDests = (chess: Chess): Map<Key, Key[]> => {
//   const dests = new Map();
//   SQUARES.forEach((s) => {
//     const ms = chess.moves({ square: s, verbose: true });
//     if (ms.length)
//       dests.set(
//         s,
//         ms.map((m) => m.to),
//       );
//   });
//   return dests;
// }

export const stringifyPath = (path: ChildNode<TrainingData>[]): string[] => {
  return path.map((node) => node.data.san);
};

// leverages chessops library and its compatability module to transform a fen string into a legal move dictionary
export const fenToDests = (fen: string): Dests => {
  return chessgroundDests(Chess.fromSetup(parseFen(fen).unwrap()).unwrap());
}

// TODO allow 2-move AND rook castling.
// * current only allowing rook castling
export const calcTarget = (fen: string, san: string): Key[] => {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const move = parseSan(pos, san);
  return chessgroundMove(move!);
  // const [from, to] = chessgroundMove(move!);

  // return toDestMap()
//   const map = new Map();
//   map.set(from, to);
//   return map;
// }
}

export const toDestMap = (from: Key, to: Key): Dests => {
  const map = new Map();
  map.set(from, to);
  return map;
}


// TODO shouldn't need position context to determine SAN string from UCI
export const chessgroundToSan = (fen: string, from: Key, to: Key): string => {
  const move = parseUci(from + to);
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const san = makeSan(pos, move!);
  return san;
}