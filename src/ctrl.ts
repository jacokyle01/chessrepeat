import { Api } from 'chessground/api';
import { Redraw } from './types';
import { Chess } from 'chess.js';
import { ChessSrs } from 'chess-srs';
import { Color } from 'chess-srs/dist/types';

export default class PrepCtrl {
  count = 0;

  //libraries
  chessground: Api | undefined;
  chessSrs = ChessSrs();
  chess: Chess = new Chess();

  constructor(readonly redraw: Redraw) {}

  increment = () => {
    this.count++;
    this.redraw();
  };

  addSubrepertoire = (pgn: string, color: Color = 'white') => {
    this.chessSrs.addSubrepertoires(pgn, color);
  };
}
