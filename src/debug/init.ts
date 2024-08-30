import PrepCtrl from '../ctrl';
import { pgn1, pgn2, pgn3 } from './pgns';

export const init = (ctrl: PrepCtrl) => {
  // add 3 repertoire entries
  ctrl.addToRepertoire(pgn1(), 'white', 'Catalan');
  ctrl.addToRepertoire(pgn2(), 'white', 'Catalan 2');
  ctrl.addToRepertoire(pgn3(), 'white', 'Spanish');

  // train Catalan
  ctrl.selectSubrepertoire(0);
  for (let i = 0; i < 4; i++) {
    ctrl.getNext();
    ctrl.succeed();
  }
  console.log('THIS 2', ctrl);
  ctrl.redraw();
};
