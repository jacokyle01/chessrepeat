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

// calcTarget returns the chessground (from, to) for the trainable move.
// chessops encodes castling as king→rook (e1h1, e1a1); callers that
// expose this as a clickable destination should also accept the king
// king→two-squares form via castlingKingTwoSquare below.
export const calcTarget = (fen: string, san: string): Key[] => {
  const pos = Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
  const move = parseSan(pos, san);
  return chessgroundMove(move!);
};

// castlingKingTwoSquare returns the "king moves two squares" destination
// (e.g. g1 for e1→h1, c1 for e1→a1) when (from, to) describes a castle
// on the given position, or null otherwise. Lets the dests map accept
// both the chessops king→rook form and the king→two-squares form most
// chess UIs default to. Works for chess960 too since we check the piece
// on `to` is a same-color rook rather than the corner square.

//TODO hack
export function castlingKingTwoSquare(fen: string, from: Key, to: Key): Key | null {
  const setup = parseFen(fen);
  if (!setup.isOk) return null;
  const pos = Chess.fromSetup(setup.value).unwrap();
  const fromPiece = pos.board.get(parseSquare(from));
  if (!fromPiece || fromPiece.role !== 'king') return null;
  const toPiece = pos.board.get(parseSquare(to));
  if (!toPiece || toPiece.role !== 'rook' || toPiece.color !== fromPiece.color) return null;
  const dir = to.charCodeAt(0) > from.charCodeAt(0) ? 2 : -2;
  const kingFile = String.fromCharCode(from.charCodeAt(0) + dir);
  return (kingFile + from[1]) as Key;
}

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
