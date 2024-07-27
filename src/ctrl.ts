import { Api } from 'chessground/api';
import { NewSubrepertoire, Redraw, ToastPopup } from './types/types';
import { ChessSrs } from 'chess-srs';
import { initial } from 'chessground/fen';
import { Key } from 'chessground/types';
import { calcTarget, chessgroundToSan, fenToDests, toDestMap} from './util';
import { fetchSubrepertoires } from './util/fetch';

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
  // chess: Chess = new Chess(); // provided with current PGN path
  addingNewSubrep = false;
  toastMessage: ToastPopup | null = null;
  constructor(readonly redraw: Redraw) {
    //we are initially learning
    document.addEventListener('DOMContentLoaded', async (_) => {
      const subreps = await fetchSubrepertoires();
      console.log(subreps);
      subreps.forEach((subrep) => this.addSubrepertoire(subrep))
    });
  }

  //TODO should be handled by ChessSrs library
  subrep = () => {
    return this.chessSrs.state.repertoire[this.chessSrs.state.index];
  };

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
      fen: initial,
    });
    this.toastMessage = null;
    console.log("this subrep", this.subrep());
    this.redraw();
  };

  toggleAddingNewSubrep = () => {
    this.addingNewSubrep = this.addingNewSubrep ? false : true;
    this.redraw();
  };

  handleMethodSwitch = () => {
    this.chessground?.setAutoShapes([]);
  };

  handleLearn = () => {
    this.handleMethodSwitch();
    this.chessSrs.setMethod('learn');
    this.chessSrs.next();
    const fen = this.chessSrs.path()?.at(-2)?.data.fen || initial
    const targetSan = this.chessSrs.path()?.at(-1)?.data.san;
    const uci = calcTarget(fen, targetSan!);
    this.chessground?.set({
      //TODO determine color from subrepertoire
      //currently, it doesn't look like chessSrs has this functionality
      //ideally, extend 'Game' with metadeta about the subrepertoire
      turnColor: 'white',
      fen: fen,
      //TODO redraw() here
      movable: {
        dests: toDestMap(uci[0], uci[1]),
        events: {
          after: () => {
            this.chessSrs.succeed();
            this.handleLearn();
          },
        },
      },
    });
    this.chessground?.setAutoShapes([{ orig: uci[0], dest: uci[1], brush: 'green' }]);

    //update toast
    this.toastMessage = {
      type: 'learn',
      header: 'New move',
      message: 'White plays his move.'
       // message: `White plays ${last!.san}`,14
    };

    this.redraw();
  };

  handleFail = (attempt: string) => {
    this.toastMessage = {
      type: 'fail',
      header: '',
      message: `Incorrect. ${attempt} is not the right move.`,
    };
    this.redraw();
  };

  //TODO refactor common logic from learn, recall, into utility method
  handleRecall = () => {
    this.handleMethodSwitch();
    this.chessground?.setAutoShapes([]);
    this.chessSrs.setMethod('recall');
    this.chessSrs.update();
    this.chessSrs.next();
    const fen = this.chessSrs.path()?.at(-2)?.data.fen || initial

    this.chessground?.set({
      //TODO determine color from subrepertoire
      //currently, it doesn't look like chessSrs has this functionality
      //ideally, extend 'Game' with metadeta about the subrepertoire
      turnColor: 'white',
      fen: fen,
      //TODO redraw() here
      movable: {
        dests: fenToDests(fen),

        events: {
          after: (from: Key, to: Key) => {
            const san = chessgroundToSan(fen, from, to);
            //TODO be more permissive depending on config
            switch (this.chessSrs.guess(san)) {
              case 'success':
                this.chessSrs.succeed();
                this.handleRecall();
                break;
              case 'alternate':
                this.chessSrs.succeed();
                this.handleRecall();
                break;
              case 'failure':
                this.handleFail(san);
                break;
            }
          },
        },
      },
    });
    //update toast
    this.toastMessage = {
      type: 'recall',
      header: 'New move',
      message: `What does White play here?`,
    };

    this.redraw();
  };
}
