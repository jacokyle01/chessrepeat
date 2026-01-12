import { Color, CountDueContext, PathContext, Chapter, TrainingContext, TrainingData } from './types';
import { defaultPosition } from 'chessops/variant';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import { defaultHeaders, makePgn, Node, PgnNodeData, startingPosition, transform } from 'chessops/pgn';
import { RepertoireChapter, RepertoireEntry } from '../types/types';
import PrepCtrl from '../ctrl';
import { useTrainerStore } from '../state/state';
import { currentTime } from '../util';
import { updateRecursive } from '../components/tree/ops';
import { scalachessCharPair } from 'chessops/compat';

export const trainingContext = (color: Color): TrainingContext => {
  return {
    trainable: color == 'white',
    ply: 0,
    pos: defaultPosition('chess'),
    clone() {
      const clonedCtx: TrainingContext = {
        ...this,
        pos: this.pos.clone(),
      };
      return clonedCtx;
    },
  };
};

export const countDueContext = (count: number): CountDueContext => {
  return {
    count,
    clone() {
      const clonedCtx: CountDueContext = {
        ...this,
      };
      return clonedCtx;
    },
  };
};

//initialize a raw pgn. does the following:
//a) marks moves made by our color as "trainable"
//b) disables training of moves made by opposite color
//TODO should be able to take in moves from a chessrepeat file

export const annotateMoves = (
  root: Node<PgnNodeData>,
  alreadyAnnotated: boolean,
  color?: Color,
  // buckets: number[],
): {
  moves: Node<TrainingData>;
  nodeCount: number;
  // meta: {
  //   trainAs: Color;
  //   bucketEntries: number[];
  // };
} => {
  //TODO cleaner here.. .
  const context = trainingContext(color || 'white');
  // let idCount = 0;
  let trainableNodes = 0;

  return {
    moves: transform(root, context, (context, data) => {
      const move = parseSan(context.pos, data.san);
      // assume the move is playable
      context.pos.play(move!);
      context.ply++;
      context.trainable = !context.trainable;
      // idCount++;/

      if (context.trainable) {
        trainableNodes++;
      }

      // add training types to each node
      if (!alreadyAnnotated) {
        return {
          ...data,
          id: scalachessCharPair(move),
          fen: makeFen(context.pos.toSetup()),
          comment: data.comments?.join('|') || '',
          ply: context.ply,
          training: {
            // id: idCount,
            disabled: context.trainable,
            seen: false,
            group: -1,
            dueAt: -1,
          },
        };
      } else {
        // chessrepeat file only has one comment
        const rawComment = data.comments[0];
        const [comment, trainingFields] = rawComment.split('␟');
        const trainingArray = trainingFields.split(',');
        console.log('parsed fields', trainingArray);

        const { comments: _ignored, ...rest } = data;

        return {
          ...data,
          id: scalachessCharPair(move),
          fen: makeFen(context.pos.toSetup()),
          ply: context.ply,
          training: {
            // id: idCount,
            disabled: trainingArray[0] == 'D',
            seen: trainingArray[1] == 'S',
            group: trainingArray[2],
            dueAt: trainingArray[3],
          },
          // slice up to unit separator
          comment,
        };
      }
    }),
    nodeCount: trainableNodes,
  };
};

/*
  Annotate a each SAN of a RepertoireEntry by adding a preceding comment with
  training state. Necessary for exporting a repertoire as a PGN 
  without losing training information
*/

// export const exportRepertoireEntry = (entry: RepertoireChapter) => {
//   //TODO need deep copy
//   let headers = new Map<string, string>();
//   let currentTime = Math.round(Date.now() / 1000);

//   // add training control headers
//   headers.set('RepertoireFileName', entry.name);
//   headers.set('LastDueCount', `${entry.lastDueCount}`);
//   headers.set('TrainAs', entry.trainAs);
//   headers.set('bucketEntries', entry.bucketEntries.toString());
//   headers.set('Event', 'ChessrepeatRepertoireFile');
//   headers.set('Time', currentTime.toString());

//   const pos = startingPosition(entry.headers).unwrap();
//   // annotate moves with training metadata
//   const annotatedMoves = transform(entry.subrep.moves, pos, (pos, node) => {
//     const newNode = { ...node, comments: node.comments ? [...node.comments] : [] };

//     let trainingHeader = `${node.training.id},${node.training.disabled ? 1 : 0},${node.training.seen ? 1 : 0},${node.training.group},${node.training.dueAt === Infinity ? 'I' : currentTime - node.training.dueAt}`;

//     newNode.comments.unshift(trainingHeader);

//     return newNode;
//   });

//   let subrep: Chapter<TrainingData> = {
//     meta: {
//       trainAs: entry.chapter.trainAs,
//       nodeCount: entry.chapter.nodeCount,
//       bucketEntries: entry.chapter.bucketEntries,
//     },
//     headers,
//     moves: annotatedMoves,
//   };

//   const pgn = makePgn(subrep) + '\n';
//   return pgn;
// };

/*
  Export chapter as PGN,
  conditionally with training metadata,
  added as part of the PGN's comment - this can be later imported back into the repertoire with
  training context remembered.
*/
export const exportChapter = (chapter: Chapter, shouldAnnotate: boolean) => {
  console.log('shouldAnnotate', shouldAnnotate);
  console.log(chapter);
  const headers = new Map<string, string>();
  headers.set('ChessrepeatChapterName', chapter.name);
  if (shouldAnnotate) {
    headers.set('trainAs', chapter.trainAs);
    headers.set('bucketEntries', chapter.bucketEntries.join(''));
  }
  //TODO optional aditional metadata

  const pos = startingPosition(defaultHeaders()).unwrap();
  const annotatedMoves = transform(chapter.root, pos, (pos, node) => {
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

// export const mergeTrees = (
//   ctrl: PrepCtrl,
//   subrep: Chapter<TrainingData>,
//   newPgn: Node<PgnNodeData>,
// ): Chapter<TrainingData> => {
//   // annotate newPgn moves
//   const newSubrep = generateChapter(newPgn, chapter.trainAs, ctrl.srsConfig.buckets!);
//   console.log(newPgn);
//   const mergedPgn = mergePgns(subrep.moves, newSubrep.moves);
//   const mergedSubrep: Chapter<TrainingData> = {
//     ...subrep,
//     moves: mergedPgn,
//   };
//   return mergedSubrep;
// };

// let i = 0;
// export const mergePgns = (oldPgn: Node<PgnNodeData>, newPgn: Node<PgnNodeData>): Node<TrainingData> => {
//   console.log('newPgn', newPgn);
//   console.log(++i);
//   // filter out oldPgn nodes that aren't present in newPgn
//   oldPgn.children = (oldPgn.children || []).filter((oldChild) => {
//     console.log('oldChild1', oldChild);
//     const val = newPgn.children.some((newChild) => {
//       console.log('newChild1', newChild);
//       console.log('newchildsan', newChild.data.san);
//       console.log('oldchildsan', oldChild.data.san);

//       const val2 = newChild.data.san === oldChild.data.san;
//       // console.log(val2);
//       return val2;
//     });
//     console.log(val);
//     return val;
//   });

//   console.log('newoldPGN', oldPgn);
//   // merge corresponding children nodes, that is,
//   // nodes with the same SAN
//   console.log('oldPgn', oldPgn);
//   oldPgn.children.forEach((oldChild) => {
//     console.log('oldChild', oldChild);
//     const newChild = newPgn.children.find((newChild) => {
//       return newChild.data.san === oldChild.data.san;
//     });
//     // shouldn't be undefined since we just filtered out duplicates
//     console.log('newChild', newChild);
//     mergePgns(oldChild, newChild);
//   });

//   // add new nodes, if necessary
//   newPgn.children.forEach((newChild) => {
//     // if a new Child isn't included in the old node's children, add it
//     if (
//       !oldPgn.children.some((oldChild) => {
//         return oldChild.data.san === newChild.data.san;
//       })
//     ) {
//       // include new child in old node's children
//       // recursively adds everything
//       oldPgn.children.push(newChild);
//     }
//   });

//   return oldPgn;
// };

export const pathContext: PathContext = {
  path: '',
  clone() {
    const clonedCtx: PathContext = { ...this };
    return clonedCtx;
  },
};

export const atLast = (): boolean => {
  const trainableContext = useTrainerStore.getState().trainableContext;
  if (!trainableContext) return false;
  const selectedPath = useTrainerStore.getState().selectedPath;
  const trainingPath = useTrainerStore.getState().trainableContext?.startingPath;

  return selectedPath == trainingPath;
};

//TODO structure files like util/tree util/ops etc... ?

/* MERGE */

import type { Node, ChildNode, PgnNodeData } from 'chessops/pgn';
import type { TrainableNode, TrainingData } from './types'; // adjust
import { childById } from '../tree/ops';
import { downloadTextFile } from '../util/io';
// Node<T> in chessops is usually a root node type; children are ChildNode<T>.
// Your code uses Node<PgnNodeData> with children having .data.san, so we follow that.

// function mergeCommentStrings(a?: string | null, b?: string | null): string | null {
//   const A = (a ?? '').trim();
//   const B = (b ?? '').trim();
//   if (!A && !B) return null;
//   if (A && !B) return A;
//   if (!A && B) return B;
//   if (A === B) return A;
//   return `${A} | ${B}`;
// }

// // Supports either `data.comment` (string) or `data.comments` (string[])
// function getNodeComment(data: any): string | null {
//   if (typeof data.comment === 'string') return data.comment;
//   if (Array.isArray(data.comments) && typeof data.comments[0] === 'string') return data.comments[0];
//   return null;
// }

// function setNodeComment(data: any, merged: string | null) {
//   if ('comment' in data) {
//     data.comment = merged;
//   } else {
//     // fallback to chessops-style comments array
//     data.comments = merged ? [merged] : [];
//   }
// }

// function cloneChild<T extends PgnNodeData>(n: any): any {
//   // shallow clone node + recursively clone children
//   return {
//     ...n,
//     data: { ...n.data },
//     children: (n.children ?? []).map(cloneChild),
//   };
// }

// /**
//  * Merge B into A (union), preserving A’s branches and interleaving B’s.
//  * Matching is per-parent by `data.san`.
//  * Returns a NEW tree (does not mutate inputs).
//  */
// export function mergePgnTreesUnion(
//   a: Node<TrainingData>, // existing chapter tree (already annotated)
//   b: Node<TrainingData>, // newly generated chapter tree (annotated)
// ): Node<TrainingData> {
//   // clone A to produce a new result tree
//   const out = a as Node<TrainingData>;

//   const mergeRec = (outNode: any, bNode: any) => {
//     // merge comments at this node
//     const aComment = getNodeComment(outNode.data);
//     const bComment = getNodeComment(bNode.data);
//     const merged = mergeCommentStrings(aComment, bComment);
//     setNodeComment(outNode.data, merged);

//     // index existing children by SAN
//     const bySan = new Map<string, any>();
//     for (const c of outNode.children ?? []) {
//       if (c?.data?.san) bySan.set(c.data.san, c);
//     }

//     for (const bChild of bNode.children ?? []) {
//       const san = bChild?.data?.san;
//       if (!san) continue;

//       const existing = bySan.get(san);
//       if (existing) {
//         // merge into existing child
//         mergeRec(existing, bChild);
//       } else {
//         // add entire subtree from B
//         outNode.children.push(cloneChild(bChild));
//         bySan.set(san, outNode.children[outNode.children.length - 1]);
//       }
//     }
//   };

//   mergeRec(out, b);
//   return out;
// }

// export const mergeTrees = (
//   ctrl: PrepCtrl,
//   subrep: Chapter<TrainingData>,
//   newPgnRoot: Node<PgnNodeData>,
// ): Chapter<TrainingData> => {
//   // 1) annotate new PGN into TrainingData nodes
//   const newSubrep = generateChapter(newPgnRoot, subrep.meta.trainAs, ctrl.srsConfig.buckets!);

//   // 2) union-merge annotated trees (B into A)
//   const mergedMoves = mergePgnTreesUnion(subrep.moves, newSubrep.moves);

//   // 3) return new chapter object (immutable)
//   return {
//     ...subrep,
//     moves: mergedMoves,
//     // you likely also want to recompute meta.nodeCount / bucketEntries here
//   };
// };

/*
  Given the roots of two PGN trees n1, n2, 
  merge n1 into n2 in place.
*/
// TODO
export function merge(n1: TrainableNode, n2: TrainableNode): void {
  // if (n2.eval) n1.eval = n2.eval;
  // if (n2.glyphs) n1.glyphs = n2.glyphs;
  // n2.comments &&
  //   n2.comments.forEach(function (c) {
  //     if (!n1.comments) n1.comments = [c];
  //     else if (
  //       !n1.comments.some(function (d) {
  //         return d.text === c.text;
  //       })
  //     )
  //       n1.comments.push(c);
  //   });

  // merge n2 comments into n1, if exists
  n1.data.comment == n1.data.comment + (n2.data.comment ? ' | ' + n2.data.comment : '');
  n2.children.forEach(function (c) {
    const existing = childById(n1, c.data.id);
    if (existing) merge(existing, c);
    else n1.children.push(c);
  });
}
