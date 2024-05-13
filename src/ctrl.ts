import { Api } from 'chessground/api';
import { Redraw } from './types';
import { Chess } from 'chess.js';
import { ChessSrs } from 'chess-srs';
import { Color, TrainingData } from 'chess-srs/dist/types';
import { initial } from 'chessground/fen';

export default class PrepCtrl {
  subrepertoireNames: string[] = [];

  //libraries
  chessground: Api | undefined; // stores FEN
  chessSrs = ChessSrs(); //stores training data
  chess: Chess = new Chess(); // provided with current PGN path

  constructor(readonly redraw: Redraw) {
    //we are initially learning
    this.chessSrs.setMethod('learn');
  }

  //TODO PGN validation
  addSubrepertoire = (pgn: string, name: string, color: Color = 'white') => {
    this.chessSrs.addSubrepertoires(pgn, color);
    this.subrepertoireNames.push(name);
    console.log(this.subrepertoireNames);
    this.redraw();
    console.log(this.chessSrs.state());
  };

  selectSubrepertoire = (which: number) => {
    this.chessSrs.load(which);
    this.redraw();
  };

  //advance subrepertoire to next trainable position and
  // handleNext = () => {
  //   this.chessSrs.load(0);
  //   //TODO handle null
  //   this.chessSrs.next();
  //   console.log(this.chessSrs.state().path);
  //   this.setPgn(this.chessSrs.state().path!);
  // };

  //TODO fix. correct typing
  //we use the Chess.js library to load a PGN into memory
  //there are 2 reasons for using this library
  //a) move validation
  //b) deriving a FEN from a PGN

  setPgn = (path: any) => {
    const pgn = path.map((node: { data: { san: any } }) => node.data.san).join(' ');
    console.log(pgn);
    this.chess.loadPgn(pgn);
    // const fen = this.getFen();
    // this.chessground?.set({
    //   fen: fen,
    // });
    // this.redraw();
  };

  getFen = () => {
    return this.chess.fen();
  };

  startTrain = () => {
    this.chessSrs.next();
    this.setPgn(this.chessSrs.state().path); //load PGN into this chess instance
    console.log(this.chess.history({verbose: true}));
    const history = this.chess.history({ verbose: true });
    const fen = history.at(-1)?.before || initial;
    // console.log(fen);
    this.chessground?.set({
      fen: fen,
    });
    const last = history.at(-1);
    // console.log(last);
    this.chessground?.setShapes([{ orig: last!.from, dest: last!.to, brush: 'green'}]);
  };
}
