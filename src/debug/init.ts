import PrepCtrl from '../ctrl';
import { pgn1, pgn2} from './pgns';

export const init = (ctrl: PrepCtrl) => {
  // initial zoom
  document.body.style.setProperty('--zoom', '100');

  // add 3 repertoire entries
  ctrl.addToRepertoire(pgn1(), 'white', 'Catalan');
  ctrl.addToRepertoire(pgn2(), 'black', 'Catalan 2');
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
