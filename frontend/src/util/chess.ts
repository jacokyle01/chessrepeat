//TODO should be a in a chess directory?
// how to organize functions?

import { Dests, Key } from 'chessground/types';
import { Chess, Color, parseSquare, parseUci, Position, PositionError } from 'chessops';
import { chessgroundDests, chessgroundMove, scalachessCharPair } from 'chessops/compat';
import { parseFen, makeFen, FenError } from 'chessops/fen';
import { makeSan, makeSanAndPlay, parseSan } from 'chessops/san';

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
// util/chess.ts (patch)

type PromoRole = 'queen' | 'rook' | 'bishop' | 'knight';

function promoLetter(role: PromoRole) {
  switch (role) {
    case 'queen':
      return 'q';
    case 'rook':
      return 'r';
    case 'bishop':
      return 'b';
    case 'knight':
      return 'n';
  }
}

// TODO shouldn't need position context to determine SAN string from UCI
// util/chess.ts (patch)
export function chessgroundToSan(
  fen: string,
  from: Key,
  to: Key,
  promoteTo?: 'queen' | 'rook' | 'bishop' | 'knight',
): string {
  const setup = parseFen(fen);
  if (!setup.isOk) throw new Error('Invalid FEN');

  const pos = Chess.fromSetup(setup.value).unwrap();

  const promoLetter =
    promoteTo === 'queen'
      ? 'q'
      : promoteTo === 'rook'
        ? 'r'
        : promoteTo === 'bishop'
          ? 'b'
          : promoteTo === 'knight'
            ? 'n'
            : '';

  const uci = `${from}${to}${promoLetter}`;

  // ✅ parseUci ONLY parses, does not validate
  const move = parseUci(uci);
  if (!move) throw new Error(`Invalid UCI: ${uci}`);

  // ✅ makeSanAndPlay validates + mutates pos
  return makeSanAndPlay(pos, move);
}
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

export const colorFromPly = (ply: number): Color => {
  return ply % 2 == 1 ? 'white' : 'black';
};

export function isPromotionMove(fen: string, from: Key, to: Key): boolean {
  const setup = parseFen(fen);
  if (!setup.isOk) return false;

  const pos = Chess.fromSetup(setup.value).unwrap();
  const board = pos.board;

  // chessops squares are like 'e7' too
  const piece = board.get(parseSquare(from));
  if (!piece || piece.role !== 'pawn') return false;

  const destRank = to[1];
  return destRank === '8' || destRank === '1';
}

export function promotionColorFromFen(fen: string): 'white' | 'black' {
  const setup = parseFen(fen);
  if (!setup.isOk) return 'white';
  const pos = Chess.fromSetup(setup.value).unwrap();
  return pos.turn; // who is moving
}
