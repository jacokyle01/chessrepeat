import { Dests, Key } from 'chessground/types';
import { Chess, parseUci } from 'chessops';
import { chessgroundDests, chessgroundMove } from 'chessops/compat';
import { parseFen } from 'chessops/fen';
import { makeSan, parseSan } from 'chessops/san';

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