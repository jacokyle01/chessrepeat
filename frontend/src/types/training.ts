// TODO "core" folder or something for main spaced repetition logic and types
import { Color, Position } from 'chessops';
import { ChildNode, PgnNodeData } from 'chessops/pgn';
import { CardState } from '../util/srs';

export type TrainingOutcome = 'success' | 'alternate' | 'failure';
export type TrainingMethod = 'learn' | 'recall' | 'edit' | null;
export interface TrainableContext {
  startingPath: string;
  targetMove: ChildNode<TrainingData>;
}

/*
  Control how we search the node tree 
  for the next trainable move 
*/
export interface NodeSearch {
  algorithm: 'bfs' | 'dfs';
  limit: number;
}

export const DEFAULT_NODE_SEARCH: NodeSearch = {
  algorithm: 'dfs',
  limit: 1000,
};

//TODO trainAsColor, depth, only first child
export interface TrainingContext {
  trainable: boolean;
  ply: number;
  pos: Position;
  clone(): TrainingContext;
}

// export interface Chapter<T> extends Game<T> {
//   meta: {
//     trainAs: Color;
//     //TODO should be determined dynamically ? or at least at import time
//     enabledCount: number;
//     bucketEntries: number[];
//     //all unseen nodes can be derived from:
//     //enabledCount - sum(bucketEntries)
//   };
// }

export type TrainableNodeList = ChildNode<TrainingData>[];

export interface DequeEntry {
  path: TrainableNodeList;
  layer: number;
}

export interface Context {
  clone(): Context;
}

export interface PathContext {
  path: string;
  clone(): PathContext;
}

export interface CountDueContext {
  count: number;
  clone(): CountDueContext;
}
/*
export interface PgnNodeData {
    san: string;
    startingComments?: string[];
    comments?: string[];
    nags?: number[];
}
*/

//TODO is id the same id we are looking for?
// there is scalachessid too...

export interface TrainingData {
  id: string;
  fen: string;
  ply: number;
  san: string;
  comment: string;
  enabled: boolean;
  training: CardState | null; //TODO better type here? // null if unseen
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
  id: string;
  trainAs: Color;
  root: TrainableNode;
  nodeCount: number;
  enabledCount: number;
  unseenCount: number;
  lastDueCount: number;
}

/*
  Additional chapter data for selected chapter, 
  computed upon selecting chapter. 
*/
// TODO better type hierarchy here?
export interface LiveChapterData {
  nodeCount: number;
  enabledCount: number;
  dueTimes: number[]; // epochs
}
//TODO different data structure for a chapter thats currently selected?

/*
TODO: namespaced types? 
TODO: move to /tree?
*/

// export interface Game<T> {
//     headers: Map<string, string>;
//     comments?: string[];
//     moves: Node<T>;
// }
