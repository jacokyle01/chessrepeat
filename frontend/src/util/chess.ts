//TODO should be a in a chess directory?
// how to organize functions?

import { Dests, Key } from 'chessground/types';
import { Chess, parseUci, Position, PositionError } from 'chessops';
import { chessgroundDests, chessgroundMove, scalachessCharPair } from 'chessops/compat';
import { parseFen, makeFen, FenError } from 'chessops/fen';
import { makeSan, makeSanAndPlay, parseSan } from 'chessops/san';
import { Color } from '../types/training';

// leverages chessops library and its compatability module to transform a fen string into a legal move dictionary
export const fenToDests = (fen: string): Dests => {
  return chessgroundDests(Chess.fromSetup(parseFen(fen).unwrap()).unwrap());
};

// TODO allow 2-move AND rook castling.
// * current only allowing rook castling
export const calcTarget = (fen: string, san: string): Key[] => {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const move = parseSan(pos, san);
  return chessgroundMove(move!);
};

export const toDestMap = (from: Key, to: Key): Dests => {
  const map = new Map();
  map.set(from, to);
  return map;
};

// TODO shouldn't need position context to determine SAN string from UCI
export const chessgroundToSan = (fen: string, from: Key, to: Key): string => {
  const move = parseUci(from + to);
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const san = makeSan(pos, move!);
  return san;
};

export function uciLineToSan(fen: string, uciLine: string): string[] {
  const setup = parseFen(fen);
  if (!setup.isOk) throw new Error('Invalid FEN: ' + fen);

  let pos = Chess.fromSetup(setup.value).unwrap();
  const moves = uciLine.trim().split(' ');
  const sanMoves: string[] = [];

  for (const uci of moves) {
    const move = parseUci(uci);
    if (!move) break;

    sanMoves.push(makeSan(pos, move));
    pos.play(move);
  }

  return sanMoves;
}

export function positionFromFen(fen: string): [Chess, null] | [null, FenError | PositionError] {
  const [setup, error] = parseFen(fen).unwrap(
    (v) => [v, null],
    (e) => [null, e],
  );
  if (error) {
    return [null, error];
  }

  return Chess.fromSetup(setup).unwrap(
    (v) => [v, null],
    (e) => [null, e],
  );
}

export const currentTime = (): number => {
  return Math.round(Date.now() / 1000);
};

export const colorFromPly = (ply: number): Color => {
  return ply % 2 == 1 ? 'white' : 'black';
};