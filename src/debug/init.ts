import PrepCtrl from '../ctrl';
import { pgn1, pgn2} from './pgns';

export const init = (ctrl: PrepCtrl) => {
  // initial zoom
  document.body.style.setProperty('--zoom', '100');

  // add 3 repertoire entries
  ctrl.addToRepertoire(pgn1(), 'black', 'Caro-Kann');
  ctrl.addToRepertoire(pgn2(), 'white', 'King\'s Gambit');


  ctrl.chessground?.redrawAll();
ctrl.redraw();
};
