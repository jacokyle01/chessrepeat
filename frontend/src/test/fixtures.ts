import { INITIAL_BOARD_FEN } from 'chessops/fen';
import type { Card } from 'ts-fsrs';
import type { Chapter, TrainableNode, TrainingData } from '../types/training';
import { chapterFromPgn } from '../util/io';
import { PLAYGROUND_KEY } from '../store/auth';

// Build a node with a 2-char id and sensible defaults. Only the fields
// a given test cares about need to be passed. FEN/SAN are placeholders
// unless a test needs real chess — for that, use chapterFromPgn.
export function node(
  id: string,
  opts: Partial<Omit<TrainingData, 'id'>> & { children?: TrainableNode[] } = {},
): TrainableNode {
  const { children = [], ...data } = opts;
  return {
    data: {
      id,
      fen: INITIAL_BOARD_FEN,
      ply: 1,
      san: id,
      comment: '',
      enabled: true,
      training: {},
      ...data,
    },
    children,
  };
}

export function root(...children: TrainableNode[]): TrainableNode {
  return {
    data: { id: '', fen: INITIAL_BOARD_FEN, ply: 0, san: '', comment: '', enabled: false, training: {} },
    children,
  };
}

// A minimal card with the given due offset (ms from now). Enough for
// the due/unseen logic, which only reads `due`.
export function cardDueIn(ms: number, key = PLAYGROUND_KEY): Record<string, Card> {
  return {
    [key]: {
      due: new Date(Date.now() + ms),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 1,
      lapses: 0,
      state: 2,
      last_review: new Date(Date.now() - 1000),
      learning_steps: 0,
    } as Card,
  };
}

// Real chapters from real PGN. Every test that needs actual chess
// (legal moves, FENs, SAN) should go through these so ids are the
// genuine scalachess char pairs.
export const ITALIAN = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *';
export const SICILIAN_TWO_LINES = '1. e4 c5 2. Nf3 (2. Nc3 Nc6) 2... d6 3. d4 cxd4 *';
export const COMMENTED = '1. e4 { king pawn } e5 { symmetric } 2. Nf3 *';

export function chapter(pgn: string, trainAs: 'white' | 'black' = 'white', name = 'test'): Chapter {
  const c = chapterFromPgn(pgn, trainAs, name);
  if (!c) throw new Error(`fixture PGN failed to parse: ${pgn}`);
  return c;
}

// Walk main line and collect SANs, handy for asserting tree shape.
export function mainLine(n: TrainableNode): string[] {
  const out: string[] = [];
  let cur = n;
  while (cur.children.length) {
    cur = cur.children[0];
    out.push(cur.data.san);
  }
  return out;
}
