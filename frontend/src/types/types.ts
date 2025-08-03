import { Chart } from 'chart.js';
import { Color, Chapter, TrainingData } from '../spaced-repetition/types';
import { TreeWrapper } from '../components/tree/tree';

//TODO better organizatoin of types
export type RepertoireMode = 'train' | 'edit';

export type Redraw = () => void;
export interface NewChapter {
  pgn: string;
  trainAs: Color;
  alias: string;
}

export type ToastType = 'learn' | 'recall' | 'fail';

export interface ToastPopup {
  type: ToastType;
  header: string;
  message: string;
}

export interface BarChart extends Chart {
  updateData(d: BarData): void;
}

export interface BarData {}

//Dont do this?? Remember each node has FEN
export interface PgnViewContext {
  splitFen: string[] | null;
  index: number | 'last';
}

export interface RepertoireEntry {
  name: string;
  subrep: Chapter<TrainingData>;
  lastDueCount: number;
}

export interface LichessStudy {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface RepertoireChapter {
  tree: TreeWrapper;
  name: string;
  lastDueCount: number;
  trainAs: Color;
  nodeCount: number;
  bucketEntries: number[];
}
