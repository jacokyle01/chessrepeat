import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';

export const debug = (ctrl: PrepCtrl): VNode => {
  return h('div.absolute right-0 m-10', [
    h('div', 'DEBUG'),
    h('div', `pathIndex: ${ctrl.pathIndex}`),

    h('div', `path length: ${ctrl.path.length + ''}`),
    h('div', `at last? : ${ctrl.atLast()}`),
    h('div', `train by: ${ctrl.chessSrs.state.method}`),

  ]);
};
