import { defaultPosition } from 'chessops/variant';
import { parseSan } from 'chessops/san';
import { makeFen } from 'chessops/fen';
import {
  Chapter,
  CountDueContext,
  NodeSearch,
  PathContext,
  TrainableContext,
  TrainableNode,
  TrainingContext,
  TrainingData,
  TrainingMethod,
} from '../types/training';
import { childById, forEachNode } from './tree';
import { downloadTextFile } from './io';
import { defaultHeaders, makePgn, Node, PgnNodeData, startingPosition, transform } from 'chessops/pgn';
import { scalachessCharPair } from 'chessops/compat';
import { Color } from 'chessops';

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

// always annotated
export const pgnFromRepertoire = (repertoire: Chapter[]) => {
  const pgns = repertoire.map((chapter) => pgnFromChapter(chapter));
  let out = pgns.join('\n');
  return out;
};

/*
  Export chapter as PGN,
  conditionally with training metadata,
  added as part of the PGN's comment - this can be later imported back into the repertoire with
  training context remembered.
*/

export const pgnFromChapter = (chapter: Chapter) => {
  const headers = new Map<string, string>();
  headers.set('ChessrepeatChapterName', chapter.name);

  const pos = startingPosition(defaultHeaders()).unwrap();
  const annotatedMoves = transform(chapter.root, pos, (pos, node) => {
    const newNode = { ...node };
    newNode.comments = node.comment ? [node.comment] : null;
    return newNode;
  });
  const game = {
    headers,
    moves: annotatedMoves,
  };
  const pgn = makePgn(game);
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
//
// TODO
// need to edit n2's ids to avoid duplicate
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
//TODO return a path?
/*
for learn:
  - have we learned everything? Y/N
  - there may hidden moves to learn which the training settings preclude us from looking @ 

for recall: 

*/
export function computeNextTrainableNode(
  root: TrainableNode,
  method: TrainingMethod,
  search: NodeSearch,
): TrainableContext | null {
  const { algorithm, limit } = search;
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
    //TODO bfs vs. dfs correct?
    const entry = algorithm == 'bfs' ? deque.shift()! : deque.pop()!;
    const pos = entry.nodeList.at(-1)!;

    //test if match
    if (pos.data.enabled) {
      switch (method) {
        case 'recall': //recall if due
          //TODO remove some pos._ fields
          console.log("training", pos.data.training?.dueAt)
          if (pos.data.training && pos.data.training.dueAt <= Date.now()) {
            return {
              startingPath: entry.pathToHere,
              targetMove: entry.targetNode,
            };
          }
          break;
        case 'learn': //learn if unseen
          if (!pos.data.training) {
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
    if (entry.layer < limit * 2) {
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
  const time = Date.now();

  forEachNode(root, (node) => {
    const d = node.data;
    if (!d.enabled || !d.training) return;

    const secondsTilDue = d.training.dueAt - time;
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
