import PrepCtrl from '../ctrl';
import { pgn1, pgn2, pgn3, pgn4, pgn5, pgn6 } from './pgns';

export const init = (ctrl: PrepCtrl) => {
  // initial zoom
  document.body.style.setProperty('--zoom', '100');

  // add 3 repertoire entries
  ctrl.addToRepertoire(pgn1(), 'white', 'Catalan');
  // ctrl.addToRepertoire(pgn2(), 'white', 'Catalan 2');
  // ctrl.addToRepertoire(pgn3(), 'white', 'Spanish');
  // ctrl.addToRepertoire(pgn4(), 'black', 'Englund');
  // ctrl.addToRepertoire(pgn6(), 'black', 'Alekhine');
  // ctrl.addToRepertoire(pgn5(), 'black', 'Classical Sicilian');

  // train Catalan
  // ctrl.selectSubrepertoire(0);
  // for (let i = 0; i < 4; i++) {
  //   ctrl.getNext();
  //   ctrl.succeed();
  // }
  // ctrl.syncTime();
  // ctrl.handleRecall();
  console.log("INITIAL REPERTOIRE", ctrl.repertoire);
  ctrl.chessground?.redrawAll();
ctrl.redraw();
};
