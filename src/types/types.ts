import { Chart } from 'chart.js';
import { Color } from 'chess-srs/types';

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