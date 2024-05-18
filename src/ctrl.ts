import { Api } from 'chessground/api';
import { NewSubrepertoire, Redraw } from './types';
import { Chess } from 'chess.js';
import { ChessSrs } from 'chess-srs';
import { Color, TrainingData } from 'chess-srs/types';
import { initial } from 'chessground/fen';
import { Dests, Key } from 'chessground/types';
import { Game, PgnNodeData } from 'chessops/pgn';
import { toDests } from './util';

export default class PrepCtrl {
  //TODO call these "plans"
  subrepertoireNames: string[] = [];

  //libraries
  chessground: Api | undefined; // stores FEN
  chessSrs = ChessSrs({
    buckets: [1, 11, 111],
    getNext: {
      by: 'depth',
    },
  }); //stores training data
  chess: Chess = new Chess(); // provided with current PGN path
  addingNewSubrep = false;

  constructor(readonly redraw: Redraw) {
    //we are initially learning
    document.addEventListener('DOMContentLoaded', (_) => {
      this.chessSrs.setMethod('learn');
      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc1 Bxd2+ 8. Qxd2 b5 9. Qg5',
        alias: 'catalan',
        trainAs: 'white',
      });

      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc1 Bxd2+ 8. Qxd2 b5 9. Qg5',
        alias: 'catalan2',
        trainAs: 'white',
      });

      this.addSubrepertoire({
        pgn: '1. d4 d5 2. c4 e6 3. Nf3 Nf6 4. g3 dxc4 5. Bg2 Bb4+ 6. Bd2 a5 7. Qc1 Bxd2+ 8. Qxd2 b5 9. Qg5',
        alias: 'catalan3',
        trainAs: 'white',
      });

      this.selectSubrepertoire(0);
      // this.handleLearn();
      this.chessSrs.next();
      this.chessSrs.succeed();

      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.next();
      this.chessSrs.succeed();
      this.chessSrs.next();
      this.chessSrs.succeed();
      this.handleLearn();
    });
  }

  //TODO PGN validation
  addSubrepertoire = (newSubrep: NewSubrepertoire) => {
    this.chessSrs.addSubrepertoires(newSubrep.pgn, newSubrep.trainAs);
    this.subrepertoireNames.push(newSubrep.alias);
    this.redraw();
  };

  selectSubrepertoire = (which: number) => {
    if (which == this.chessSrs.state.index) return;
    this.chessSrs.load(which);
    this.chessground?.set({
      fen: initial
    })
    this.redraw();
  };

  setPgn = (path: any) => {
    const pgn = path.map((node: { data: { san: any } }) => node.data.san).join(' ');
    console.log(pgn);
    this.chess.loadPgn(pgn);
  };

  getFen = () => {
    return this.chess.fen();
  };

  //TODO should be handled by ChessSrs library
  subrep = () => {
    return this.chessSrs.state.repertoire[this.chessSrs.state.index];
  };

  toggleAddingNewSubrep = () => {
    this.addingNewSubrep = this.addingNewSubrep ? false : true;
    this.redraw();
  };

  handleLearn = () => {
    this.chessSrs.setMethod('learn');
    this.chessSrs.next();
    this.setPgn(this.chessSrs.state.path); //load PGN into this chess instance
    console.log(this.chess.history({ verbose: true }));
    const history = this.chess.history({ verbose: true });
    const fen = history.at(-1)?.before || initial;
    // console.log(fen);

    const last = history.at(-1);

    const targetMove = new Map();
    targetMove.set(last!.from, last!.to);

    console.log(targetMove);

    this.chessground?.set({
      //TODO determine color from subrepertoire
      //currently, it doesn't look like chessSrs has this functionality
      //ideally, extend 'Game' with metadeta about the subrepertoire
      turnColor: 'white',
      fen: fen,
      //TODO redraw() here
      movable: {
        dests: targetMove,
        events: {
          after: () => {
            this.chessSrs.succeed();
            this.handleLearn();
          },
        },
      },
    });
    // console.log(last);
    this.chessground?.setShapes([{ orig: last!.from, dest: last!.to, brush: 'green' }]);
    console.log(this.chessground);
    //HACK ish TODO

    this.redraw();
  };

  //TODO refactor common logic from learn, recall, into utility method
  handleRecall = () => {
    this.chessSrs.setMethod('recall');
    this.chessSrs.update();
    this.chessSrs.next();
    this.setPgn(this.chessSrs.state.path?.slice(0, -1) || ''); //load PGN into this chess instance
    const history = this.chess.history({ verbose: true });
    const fen = history.at(-1)?.after || initial;
    console.log(toDests(this.chess));

    this.chessground?.set({
      //TODO determine color from subrepertoire
      //currently, it doesn't look like chessSrs has this functionality
      //ideally, extend 'Game' with metadeta about the subrepertoire
      turnColor: 'white',
      fen: fen,
      //TODO redraw() here
      movable: {
        dests: toDests(this.chess),
        events: {
          after: (to: Key, from: Key) => {
            //TODO validation of correct move (possibly alternate)
            const san = this.chess.move(to + from).san;
            console.log(san);
            this.chess.undo();
            // this.handleGuess(san);
            //TODO be more permissive depending on config
            switch (this.chessSrs.guess(san)) {
              case 'success':
                this.chessSrs.succeed();
                break;
              case 'alternate':
                this.chessSrs.succeed();
                break;
              case 'failure':
                this.chessSrs.fail();
                break;
            }
            this.handleRecall();
          },
        },
      },
    });
    // console.log(last);
    console.log(this.chessground);
    //HACK ish TODO
    this.redraw();
  };
}
