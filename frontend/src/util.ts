import { Color, Dests, Key } from 'chessground/types';
import { Chess, parseUci } from 'chessops';
import { chessgroundDests, chessgroundMove } from 'chessops/compat';
import { parseFen, makeFen } from 'chessops/fen';
import { ChildNode, defaultHeaders, makePgn, startingPosition } from 'chessops/pgn';
import { makeSan, parseSan } from 'chessops/san';
import { RepertoireChapter } from './types/types';
import { transform } from 'chessops/pgn';

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

export interface TrainingData {
  training: {
    disabled: boolean;
    seen: boolean;
    group: number;
    dueAt: number;
  };
  id: string;
  fen: string;
  ply: number;
  san: string;
  comment: string;
}

export interface RootData {}

export type TrainableNode = ChildNode<TrainingData>;
// dummy node with id = ''
export type TrainingRoot<T> = {
  id: string;
  children: ChildNode<T>[];
};

export interface Chapter {
  name: string;
  lastDueCount: number;
  trainAs: Color;
  nodeCount: number;
  bucketEntries: number[];
  root: TrainableNode;
}

export const downloadChapter = (entry: RepertoireChapter) => {
  const converted = transformDataStructure(entry);
  exportChapter(converted, true);
};

export const transformDataStructure = (old: RepertoireChapter): Chapter => {
  console.log('OLD', old);
  // TODO need to transform root (into dummy node)
  const newRoot = treeNodeToTrainingRoot(old.tree);
  console.log('newRoot', newRoot);

  let chapter: Chapter;

  chapter = {
    name: old.name,
    lastDueCount: old.lastDueCount,
    trainAs: old.trainAs,
    root: newRoot,
    nodeCount: old.nodeCount,
    bucketEntries: old.bucketEntries,
  };

  return chapter;
};

export function treeNodeToTrainingRoot(tree: Tree.Node): TrainingRoot<TrainingData> {
  console.log('tree', tree);
  return {
    id: '',
    children: tree.children.map(toTrainableChildNode),
  };
}

function toTrainableChildNode(node: Tree.Node): ChildNode<TrainingData> {
  console.log('TO TRAINABlE', node);
  return {
    // chessops ChildNode shape is typically: { data: T; children: ChildNode<T>[] }
    // If your version also has "id" at the node-level, remove/adjust accordingly.
    data: {
      id: node.id,
      fen: node.fen,
      ply: node.ply,
      san: node.san ?? '',
      comment: node.comment ?? '',
      training: {
        disabled: node.disabled,
        seen: node.seen,
        group: node.group,
        dueAt: node.dueAt,
      },
    },
    children: (node.children ?? []).map(toTrainableChildNode),
  };
}

// export const annotateMoves = (
//   root: Node<PgnNodeData>,
//   alreadyAnnotated: boolean,
//   color?: Color,
//   // buckets: number[],
// ): {
//   moves: Node<TrainingData>;
//   nodeCount: number;
//   // meta: {
//   //   trainAs: Color;
//   //   bucketEntries: number[];
//   // };
// } => {
//   //TODO cleaner here.. .
//   const context = trainingContext(color || 'white');
//   // let idCount = 0;
//   let trainableNodes = 0;

//   return {
//     moves: transform(root, context, (context, data) => {
//       const move = parseSan(context.pos, data.san);
//       // assume the move is playable
//       context.pos.play(move!);
//       context.ply++;
//       context.trainable = !context.trainable;
//       // idCount++;/

//       if (context.trainable) {
//         trainableNodes++;
//       }

//       // add training types to each node
//       if (!alreadyAnnotated) {
//         return {
//           ...data,
//           id: scalachessCharPair(move),
//           fen: makeFen(context.pos.toSetup()),
//           comment: data.comments?.join('|') || '',
//           ply: context.ply,
//           training: {
//             // id: idCount,
//             disabled: context.trainable,
//             seen: false,
//             group: -1,
//             dueAt: -1,
//           },
//         };
//       } else {
//         // chessrepeat file only has one comment
//         const rawComment = data.comments[0];
//         const [comment, trainingFields] = rawComment.split('␟');
//         const trainingArray = trainingFields.split(',');
//         console.log('parsed fields', trainingArray);

//         const { comments: _ignored, ...rest } = data;

//         return {
//           ...data,
//           id: scalachessCharPair(move),
//           fen: makeFen(context.pos.toSetup()),
//           ply: context.ply,
//           training: {
//             // id: idCount,
//             disabled: trainingArray[0] == 'D',
//             seen: trainingArray[1] == 'S',
//             group: trainingArray[2],
//             dueAt: trainingArray[3],
//           },
//           // slice up to unit separator
//           comment,
//         };
//       }
//     }),
//     nodeCount: trainableNodes,
//   };
// };

export const exportChapter = (chapter: Chapter, shouldAnnotate: boolean) => {
  console.log('shouldAnnotate', shouldAnnotate);
  console.log(chapter);
  const headers = new Map<string, string>();
  headers.set('ChessrepeatChapterName', chapter.name);
  console.log("BUCKETT", chapter.bucketEntries)
  if (shouldAnnotate) {
    headers.set('trainAs', chapter.trainAs);
    headers.set('bucketEntries', chapter.bucketEntries.join(','));
  }
  console.log("HEADERS", headers);
  //TODO optional aditional metadata

  const pos = startingPosition(defaultHeaders()).unwrap();
  const annotatedMoves = transform(chapter.root, pos, (pos, node) => {
    console.log('IN TRANSFORM', node);
    if (!shouldAnnotate) return node;
    const newNode = { ...node };
    const trailer = [];
    trailer.push(node.training.disabled ? 'D' : 'd');
    trailer.push(node.training.seen ? 'S' : 's');
    trailer.push(node.training.group + '');
    trailer.push(node.training.dueAt + '');
    console.log('trailer', trailer);
    // append metadata to comment
    //TODO add this to type so it parses correctly...
    newNode.comments = [node.comment + '␟' + trailer.join(',')];
    console.log('comments', newNode.comments);
    console.log(newNode.comment);
    return newNode;

    /* Conditionally append training metadata to current node's comment */

    // TODO..
  });
  const game = {
    headers,
    moves: annotatedMoves,
  };
  console.log('game export', game);
  // TODO game isn't parsing correctly?
  const pgn = makePgn(game);
  console.log('exported PGN, pgn');

  //TODO
  const exportName = shouldAnnotate ? 'chapter.chessrepeat' : 'chapter.pgn';
  downloadTextFile(pgn, exportName, 'application/x-chess-pgn');

  return pgn;
};

export function downloadTextFile(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
