import { Dests, Key } from 'chessground/types';
import { Chess, parseUci, Position } from 'chessops';
import { chessgroundDests, chessgroundMove, scalachessCharPair } from 'chessops/compat';
import { parseFen, makeFen } from 'chessops/fen';
import { ChildNode } from 'chessops/pgn';
import { makeSan, makeSanAndPlay, parseSan } from 'chessops/san';
import { TrainingData } from './spaced-repetition/types';


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

export const currentTime = (): number => {
  return Math.round(Date.now() / 1000);
};

// // Example usage:
// const fen = "r1bqkbnr/pppppppp/n7/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 2";
// const pv = "e2e4 e7e5 g1f3";

// console.log(uciLineToSan(fen, pv)); // ["e4", "e5", "Nf3"]
//TODO how to use these for importing PGN into repertoire?
export const readNode = (
  node: ChildNode<TrainingData>,
  pos: Position,
  ply: number,
  withChildren = true,
): Tree.Node => {
  const move = parseSan(pos, node.data.san);
  if (!move) throw new Error(`Can't play ${node.data.san} at move ${Math.ceil(ply / 2)}, ply ${ply}`);
  return {
    id: scalachessCharPair(move),
    ply,
    san: makeSanAndPlay(pos, move),
    fen: makeFen(pos.toSetup()),
    // uci: makeUci(move),

    disabled: node.data.training.disabled,
    seen: node.data.training.seen,
    group: node.data.training.group,
    dueAt: node.data.training.dueAt,

    children: withChildren ? node.children.map((child) => readNode(child, pos.clone(), ply + 1)) : [],
    comment: node.data.comments?.join('|') || null,
    // check: pos.isCheck() ? makeSquare(pos.toSetup().board.kingOf(pos.turn)!) : undefined,
  };
};

export function treeReconstruct(parts: Tree.Node[], sidelines?: Tree.Node[][]): Tree.Node {
  const root = parts[0],
    nb = parts.length;
  let node = root;
  root.id = '';
  for (let i = 1; i < nb; i++) {
    const n = parts[i];
    const variations = sidelines ? sidelines[i] : [];
    if (node.children) node.children.unshift(n, ...variations);
    else node.children = [n, ...variations];
    node = n;
  }
  node.children = node.children || [];
  return root;
}
