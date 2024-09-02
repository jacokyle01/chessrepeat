import { VNode, h } from 'snabbdom';
import { Chessground } from 'chessground';
// import { toDests } from './util';
import { Config } from 'chessground/config';
import PrepCtrl from '../ctrl';

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
  };
  return config;
}

export const chessground = (ctrl: PrepCtrl): VNode => {
  return h('section.blue.merida.shadow.appearance-none.shadow-md.rounded-t-lg.rounded-br-lg.p-3.bg-white', [
    h('div.cg-wrap', {
      hook: {
        insert: (vnode) => {
          const el = vnode.elm as HTMLElement;
          ctrl.chessground = Chessground(el, makeConfig(ctrl));
          // ctrl.initializeCg();
        },
      },
    }),
  ]);
};
