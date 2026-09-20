import { describe, expect, test } from 'vitest';
import { INITIAL_BOARD_FEN } from 'chessops/fen';
import {
  calcTarget,
  castlingKingTwoSquare,
  chessgroundToSan,
  colorFromPly,
  fenToDests,
  isPromotionMove,
  positionFromFen,
  promotionColorFromFen,
  toDestMap,
  uciLineToSan,
} from './chess';

// White can castle both sides, black king on e8.
const CASTLE_FEN = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
// White pawn on e7 about to promote; black king tucked on a8 so e8 is empty.
const PROMO_FEN = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';

describe('fenToDests', () => {
  test('initial position has 20 legal moves', () => {
    const dests = fenToDests(INITIAL_BOARD_FEN);
    const total = [...dests.values()].reduce((n, v) => n + v.length, 0);
    expect(total).toBe(20);
    expect(dests.get('e2')).toEqual(expect.arrayContaining(['e3', 'e4']));
    expect(dests.get('e1')).toBeUndefined();
  });
});

describe('calcTarget', () => {
  test('maps a SAN to chessground from/to', () => {
    expect(calcTarget(INITIAL_BOARD_FEN, 'e4')).toEqual(['e2', 'e4']);
    expect(calcTarget(INITIAL_BOARD_FEN, 'Nf3')).toEqual(['g1', 'f3']);
  });

  test('castling is encoded king -> rook (chessops convention)', () => {
    expect(calcTarget(CASTLE_FEN, 'O-O')).toEqual(['e1', 'h1']);
    expect(calcTarget(CASTLE_FEN, 'O-O-O')).toEqual(['e1', 'a1']);
  });
});

describe('castlingKingTwoSquare', () => {
  test('translates king->rook into king-two-squares', () => {
    expect(castlingKingTwoSquare(CASTLE_FEN, 'e1', 'h1')).toBe('g1');
    expect(castlingKingTwoSquare(CASTLE_FEN, 'e1', 'a1')).toBe('c1');
  });

  test('is null for non-castling moves', () => {
    expect(castlingKingTwoSquare(CASTLE_FEN, 'e1', 'f1')).toBeNull();
    expect(castlingKingTwoSquare(CASTLE_FEN, 'a1', 'b1')).toBeNull();
    expect(castlingKingTwoSquare(INITIAL_BOARD_FEN, 'e2', 'e4')).toBeNull();
    expect(castlingKingTwoSquare('not a fen', 'e1', 'h1')).toBeNull();
  });
});

describe('chessgroundToSan', () => {
  test('plain moves', () => {
    expect(chessgroundToSan(INITIAL_BOARD_FEN, 'e2', 'e4')).toBe('e4');
    expect(chessgroundToSan(INITIAL_BOARD_FEN, 'g1', 'f3')).toBe('Nf3');
  });

  test('promotion suffix', () => {
    expect(chessgroundToSan(PROMO_FEN, 'e7', 'e8', 'queen')).toBe('e8=Q+');
    expect(chessgroundToSan(PROMO_FEN, 'e7', 'e8', 'knight')).toBe('e8=N');
  });

  test('castling from the king->rook form', () => {
    expect(chessgroundToSan(CASTLE_FEN, 'e1', 'h1')).toBe('O-O');
  });

  test('rejects a bad fen', () => {
    expect(() => chessgroundToSan('garbage', 'e2', 'e4')).toThrow(/Invalid FEN/);
  });
});

describe('uciLineToSan', () => {
  test('converts a line and plays it forward', () => {
    expect(uciLineToSan(INITIAL_BOARD_FEN, 'e2e4 e7e5 g1f3')).toEqual(['e4', 'e5', 'Nf3']);
  });

  test('stops at the first unparseable token', () => {
    expect(uciLineToSan(INITIAL_BOARD_FEN, 'e2e4 xx g1f3')).toEqual(['e4']);
  });
});

describe('positionFromFen', () => {
  test('ok', () => {
    const [pos, err] = positionFromFen(INITIAL_BOARD_FEN);
    expect(err).toBeNull();
    expect(pos?.turn).toBe('white');
  });

  test('error on malformed fen', () => {
    const [pos, err] = positionFromFen('nope');
    expect(pos).toBeNull();
    expect(err).not.toBeNull();
  });
});

describe('small helpers', () => {
  test('colorFromPly: odd ply is a white move', () => {
    expect(colorFromPly(1)).toBe('white');
    expect(colorFromPly(2)).toBe('black');
    expect(colorFromPly(0)).toBe('black');
  });

  test('isPromotionMove only for pawns reaching the last rank', () => {
    expect(isPromotionMove(PROMO_FEN, 'e7', 'e8')).toBe(true);
    expect(isPromotionMove(INITIAL_BOARD_FEN, 'e2', 'e4')).toBe(false);
    // king to the 8th rank is not a promotion
    expect(isPromotionMove('k7/8/8/8/8/8/8/4K3 w - - 0 1', 'e1', 'e2')).toBe(false);
    expect(isPromotionMove('bad', 'e7', 'e8')).toBe(false);
  });

  test('promotionColorFromFen is the side to move', () => {
    expect(promotionColorFromFen(PROMO_FEN)).toBe('white');
    expect(promotionColorFromFen('4k3/8/8/8/8/8/4p3/4K3 b - - 0 1')).toBe('black');
    expect(promotionColorFromFen('bad')).toBe('white');
  });

  test('toDestMap', () => {
    expect(toDestMap('e2', 'e4').get('e2')).toBe('e4');
  });
});
