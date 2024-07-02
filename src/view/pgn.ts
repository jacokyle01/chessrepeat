import { VNode, h } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { stringifyPath } from '../util';
import { ChildNode } from 'chessops/pgn';
import { TrainingData } from 'chess-srs/types';
import { gearI } from '../svg/gear';
import { backI } from '../svg/back';
import { firstI } from '../svg/first';
import { lastI } from '../svg/last';
import { nextI } from '../svg/next';

//gets a PGN tree DOM node from a PGN string
//e.x. d4 d5 c4 e6
const indexNode = (turn: number) => h('index.bg-gray-200', `${turn + 1}.`);
const moveNode = (san: string) => h('move.flex-1', san);
const rowNode = (elems: VNode[]) => h('div#move-row.flex.gap-1', elems);

//TODO handle comments
// export const pgnTree = (pgn: string[]): VNode => {
//   const rows: VNode[] = [];
//   let elems: VNode[] = [];
//   let i = 0;
//   while (pgn.length > 0) {
//     if (i % 2 == 0) {
//       elems.push(indexNode(i / 2));
//     }
//     elems.push(moveNode(pgn.shift()!));
//     i++;
//     if (i % 2 == 0) {
//       rows.push(rowNode(elems));
//       elems = [];
//     }
//   }
//   return h('div#pgn-tree.w-1/5.shadow.appearance-none.border.rounded', rows);
// };

export const pgnTree = (ctrl: PrepCtrl): VNode => {
  let pgn: string[] = [];
  if (ctrl.chessSrs.state.path != null) {
    pgn = stringifyPath(ctrl.chessSrs.state.path as ChildNode<TrainingData>[]);
  }
  const rows: VNode[] = [];
  let elems: VNode[] = [];
  let i = 0;

  // rows.push(
  //   h('div.text-center.flex.items-center.justify-around.bg-gray-200', [
  //     h('h3.font-light.flex-1', 'PGN tree'),
  //     gearI(),
  //   ]),
  // );
  while (pgn.length > 0) {
    if (i % 2 == 0) {
      elems.push(indexNode(i / 2));
    }
    elems.push(moveNode(pgn.shift()!));
    i++;
    if (i % 2 == 0) {
      rows.push(rowNode(elems));
      elems = [];
    }
  }
  return h('div#pgn-tree.w-1/5.h-1/2.shadow.appearance-none.border.rounded.flex.flex-col', [
    h('div.text-center.flex.items-center.justify-around.bg-gray-200', [
      h('h3.font-light.flex-1', 'PGN tree'),
      gearI(),
    ]),
    h('div.flex-1.overflow-y-scroll', rows),
    h('div#pgn-control.bg-gray-200.mt-auto.flex.justify-center.gap-1', [
      h('button#first', [firstI()]),
      h('button#back', [backI()]),
      h('button#next', [nextI()]),
      h('button#last', [lastI()]),
    ]),
  ]);
};
