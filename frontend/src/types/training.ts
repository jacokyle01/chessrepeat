// TODO "core" folder or something for main spaced repetition logic and types
import { Position } from 'chessops';
import { ChildNode, PgnNodeData } from 'chessops/pgn';

export type Color = 'white' | 'black';
// export type Method = 'recall' | 'learn' | 'unselected';
export type TrainingOutcome = 'success' | 'alternate' | 'failure';
export type TrainingMethod = 'learn' | 'recall' | 'edit' | 'unselected';
export interface TrainableContext {
  startingPath: string;
  targetMove: ChildNode<TrainingData>;
}

export interface TrainingConfig {
  getNext?: {
    by?: 'depth' | 'breadth'; // exploration strategy to find next position
    max?: number; //dont look at positions after this many moves
  };
  buckets?: number[]; //the "spaces" for spaced repetition. see "leitner system"
  promotion?: 'most' | 'next';
  demotion?: 'most' | 'next';
}

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
//     nodeCount: number;
//     bucketEntries: number[];
//     //all unseen nodes can be derived from:
//     //nodeCount - sum(bucketEntries)
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
  id: string;
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


