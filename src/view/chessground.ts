import { looseH as h } from '../types/snabbdom';
import { VNode } from 'snabbdom';
import { Chessground } from 'chessground';
// import { toDests } from './util';
import { Config } from 'chessground/config';
import PrepCtrl from '../ctrl';
import resizeHandle from '../util/resize';
import * as cg from 'chessground/types';
import { settings } from './settings';

function makeConfig(ctrl: PrepCtrl): Config {
  // const chess = ctrl.chess; //store chess state in ctrl
  console.log(ctrl);
  const config: Config = {
    coordinates: true,
    movable: {
      color: 'white',
      // dests: toDests(chess),
      free: false,
    },
    events: {
      insert: (elements: cg.Elements) => {
        console.log('Inserted cg-resize');
        resizeHandle(elements);
      },
    },
  };
  return config;
}

export const chessground = (ctrl: PrepCtrl): VNode => {
  return h('section.blue.alpha.rounded.shadow-sm.border.border-blue-gray-100', [
    h('div.cg-wrap', {
      hook: {
        insert: (vnode) => {
          const el = vnode.elm as HTMLElement;
          ctrl.chessground = Chessground(el, makeConfig(ctrl));
        },
      },
    }),
    ctrl.showingTrainingSettings && settings(ctrl)
  ]);
};
