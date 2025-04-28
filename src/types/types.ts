import { Chart } from 'chart.js';
import { Color, Subrepertoire, TrainingData } from '../spaced-repetition/types';

export type Redraw = () => void;
export interface NewSubrepertoire {
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

export interface BarData {
}


//Dont do this?? Remember each node has FEN
export interface PgnViewContext {
  splitFen: string[] | null;
  index: number | "last"
}

//TODO remove this and only use headers 
export interface RepertoireEntry {
  name: string 
	subrep: Subrepertoire<TrainingData>
	lastDueCount: number
}

export interface LichessStudy {
  id: number,
  name: string,
  createdAt: number,
  updatedAt: number
}