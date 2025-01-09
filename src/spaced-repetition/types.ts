import { Position } from 'chessops';
import { ChildNode, Game, PgnNodeData } from 'chessops/pgn';

export type Color = 'white' | 'black';
export type Method = 'recall' | 'learn';
export type TrainingOutcome = 'success' | 'alternate' | 'failure';

//TODO trainAsColor, depth, only first child
export interface TrainingContext {
  trainable: boolean;
  id: number;
  pos: Position
  clone(): TrainingContext;
}

export interface TrainingData extends PgnNodeData {
  training: {
    id: number;
    disabled: boolean;
    seen: boolean;
    group: number;
    dueAt: number;
  };
  fen: string
  succeeded: boolean;
}

export interface Subrepertoire<T> extends Game<T> {
  meta: {
    trainAs: Color;
    nodeCount: number;
    bucketEntries: number[];
    //all unseen nodes can be derived from:
    //nodeCount - sum(bucketEntries)
  };
}

export type TrainingPath = ChildNode<TrainingData>[];

export interface DequeEntry {
  path: TrainingPath;
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
  count: number
  clone(): CountDueContext;
}