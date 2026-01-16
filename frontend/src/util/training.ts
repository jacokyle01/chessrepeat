import { defaultPosition } from 'chessops/variant';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import {
  Chapter,
  Color,
  CountDueContext,
  PathContext,
  TrainableContext,
  TrainableNode,
  TrainingContext,
  TrainingData,
  TrainingMethod,
} from '../types/training';
import { currentTime } from './chess';
import { childById, forEachNode } from './tree';
import { downloadTextFile } from './io';
import { defaultHeaders, makePgn, Node, PgnNodeData, startingPosition, transform } from 'chessops/pgn';
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
        //TODO remove comments (or data.comments) field correctly
        const { comments: _ignored, ...rest } = data;
        console.log('BUGGG | group in annotateMoves', trainingArray[2]);
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

// always annotated
export const pgnFromRepertoire = (repertoire: Chapter[]) => {
  const pgns = repertoire.map((chapter) => pgnFromChapter(chapter, true));
  let out = pgns.join('\n');
  return out;
};

/*
  Export chapter as PGN,
  conditionally with training metadata,
  added as part of the PGN's comment - this can be later imported back into the repertoire with
  training context remembered.
*/
export const pgnFromChapter = (chapter: Chapter, shouldAnnotate: boolean) => {
  console.log('shouldAnnotate', shouldAnnotate);
  console.log(chapter);
  const headers = new Map<string, string>();
  headers.set('ChessrepeatChapterName', chapter.name);
  if (shouldAnnotate) {
    headers.set('trainAs', chapter.trainAs);
    headers.set('bucketEntries', chapter.bucketEntries.join(','));
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
  return pgn;
  console.log('exported PGN, pgn');

  //TODO
  const exportName = shouldAnnotate ? 'chapter.chessrepeat' : 'chapter.pgn';
  downloadTextFile(pgn, exportName, 'application/x-chess-pgn');

  return pgn;
};

export const pathContext: PathContext = {
  path: '',
  clone() {
    const clonedCtx: PathContext = { ...this };
    return clonedCtx;
  },
};

/*
  Given the roots of two PGN trees n1, n2, 
  merge n1 into n2 in place.
*/
// TODO
export function merge(n1: TrainableNode, n2: TrainableNode): void {
  // merge n2 comments into n1, if exists
  n1.data.comment == n1.data.comment + (n2.data.comment ? ' | ' + n2.data.comment : '');
  n2.children.forEach(function (c) {
    const existing = childById(n1, c.data.id);
    if (existing) merge(existing, c);
    else n1.children.push(c);
  });
}

/*
  Get the next trainable path, if it exists
*/

// Returns a string string
// - easier to set selected node in the DOM
// - have to use getNodeList() to convert to ChildNode<TrainingData>[]
// - generally easier to convert from path to node
// - TODO: more verbose return values - give more context for why `nextTrainablePath()` failed
//  */

//TODO return path to position + target ChildNode<TrainingData>
//TODO better type for getNext
export function computeNextTrainableNode(
  root: TrainableNode,
  method: TrainingMethod,
  getNext: any,
): TrainableContext | null {
  //initialization
  // TODO refactor to ops or tree file?
  interface DequeEntry {
    nodeList: TrainableNode[];
    layer: number;
    pathToHere: string;
    targetNode: TrainableNode;
  }

  const deque: DequeEntry[] = [];

  //TODO just push root directly? would that work?
  root.children.forEach((child) => {
    deque.push({
      nodeList: [child],
      layer: 0,
      pathToHere: '',
      targetNode: child,
    });
  });
  while (deque.length != 0) {
    //initialize dedequed path
    const entry = getNext!.by == 'breadth' ? deque.shift()! : deque.pop()!;
    const pos = entry.nodeList.at(-1)!;

    //test if match
    if (!pos.data.training.disabled) {
      switch (method) {
        case 'recall': //recall if due
          //TODO remove some pos._ fields
          if (pos.data.training.seen && pos.data.training.dueAt <= currentTime()) {
            return {
              startingPath: entry.pathToHere,
              targetMove: entry.targetNode,
            };
          }
          break;
        case 'learn': //learn if unseen
          if (!pos.data.training.seen) {
            return {
              startingPath: entry.pathToHere,
              targetMove: entry.targetNode,
            };
          }
          break;
      }
    }

    //push child nodes
    //TODO guarantee non-full
    // TODO check math to ensure that max is followed appropriately
    if (entry.layer < getNext!.max! * 2) {
      // TODO ?
      for (const child of pos.children) {
        const DequeEntry: DequeEntry = {
          nodeList: [...entry.nodeList, child],
          layer: ++entry.layer,
          pathToHere: entry.pathToHere + entry.targetNode.data.id,
          targetNode: child,
        };
        deque.push(DequeEntry);
      }
    }
  }
  return null;
}

// TODO provide a more detailed breakdown, like when each one is due.
// TODO combine this with nextTrainablePath() so we don't need to walk the tree twice

/*
  Traverse current chapter to get data when positions are due, 
  returning bucketed intervals of due dates.
*/
export function computeDueCounts(root: TrainableNode, buckets: number[]): number[] {
  const counts = new Array(1 + buckets.length).fill(0);
  const time = currentTime();

  forEachNode(root, (node) => {
    const t = node.data.training;
    if (t.disabled || !t.seen) return;

    const secondsTilDue = t.dueAt - time;
    if (secondsTilDue <= 0) {
      counts[0]++;
      return;
    }

    for (let i = 0; i < buckets.length; i++) {
      if (secondsTilDue <= buckets[i]) {
        counts[i + 1]++;
        return;
      }
    }
  });

  return counts;
}
