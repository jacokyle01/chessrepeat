import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';

export const debug = (ctrl: PrepCtrl): VNode => {
  return h('div.absolute.bottom-0.right-0.m-20', [
    h('div', 'DEBUG'),
    h('div', `pathIndex: ${ctrl.pathIndex}`),

    h('div', `path length: ${ctrl.trainingPath.length + ''}`),
    h('div', `at last? : ${ctrl.atLast()}`),
    h('div', `train by: ${ctrl.method}`),
    h('div', `meta | bucketEntries: ${ctrl.subrep()?.meta.bucketEntries}`),
    h('div', `meta | nodeCount: ${ctrl.subrep()?.meta.nodeCount}`),
    h('div', `meta | trainAs: ${ctrl.subrep()?.meta.trainAs}`),
    h(
      'button', // Element type
      {
        attrs: { type: 'button' }, // HTML attributes
        on: {
          click: () => console.log(ctrl.chessground!.state), // Event listener
        },
      },
      'CONFIG', // Button text
    ),
    h('button', {
      on: {
        click: () => ctrl?.chessground!.redrawAll()
      }
    }, 'REDRAW')
  ]);
};
