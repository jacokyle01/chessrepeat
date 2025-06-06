import PrepCtrl from '../ctrl';
import { comments, pgn1, pgn2, pgn3, slav, transpose} from './pgns';

export const init = (ctrl: PrepCtrl) => {
  // initial zoom
  document.body.style.setProperty('--zoom', '100');


  // // add 3 repertoire entries

  ctrl.addToRepertoire(pgn3(), 'white', 'QGD Exchange')
  // // ctrl.addToRepertoire(transpose(), 'white', 'transpose')

  
  // // ctrl.addToRepertoire(pgn1(), 'white', 'Catalan');
  // // ctrl.addToRepertoire(pgn2(), 'black', 'Catalan 2');
  // // ctrl.addToRepertoire(pgn6(), 'black', 'Alekhine');
  ctrl.addToRepertoire(pgn3(), 'black', 'Classical Sicilian');

  // // train
  ctrl.selectSubrepertoire(1);
  ctrl.markAllSeen();
  ctrl.handleRecall();
  ctrl.syncTime();
  // ctrl.handleRecall();
  // console.log("INITIAL REPERTOIRE", ctrl.repertoire);
  ctrl.chessground?.redrawAll();
ctrl.redraw();
};
