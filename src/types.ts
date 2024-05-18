import { Color } from "chess-srs/types";

export type Redraw = () => void;
export interface NewSubrepertoire {
  pgn: string;
  trainAs: Color;
  alias: string;
}
