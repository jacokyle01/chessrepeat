import PrepCtrl from '../ctrl';
import { pgn1, pgn2, pgn3, pgn4, pgn5 } from './pgns';

export const init = (ctrl: PrepCtrl) => {
  // initial zoom
  document.body.style.setProperty('--zoom', '100');

  // add 3 repertoire entries
  ctrl.addToRepertoire(pgn1(), 'white', 'Catalan');
  ctrl.addToRepertoire(pgn2(), 'white', 'Catalan 2');
  ctrl.addToRepertoire(pgn3(), 'white', 'Spanish');
  ctrl.addToRepertoire(pgn4(), 'black', 'Englund');
  ctrl.addToRepertoire(pgn5(), 'black', 'Classical Sicilian');

  // train Catalan
  ctrl.selectSubrepertoire(0);
  for (let i = 0; i < 4; i++) {
    ctrl.getNext();
    ctrl.succeed();
  }
  ctrl.syncTime();
  ctrl.handleRecall();
  // ctrl.lastFeedback = 'fail';
  ctrl.handleFail('x');
  ctrl.redraw();
};
