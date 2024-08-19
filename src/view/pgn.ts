import { VNode, h } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { stringifyPath } from '../util';
import { ChildNode } from 'chessops/pgn';
import { TrainingData } from 'chess-srs/types';
import { backI } from '../svg/back';
import { firstI } from '../svg/first';
import { lastI } from '../svg/last';
import { nextI } from '../svg/next';
import { toast } from './toast';

//gets a PGN tree DOM node from a PGN string
//e.x. d4 d5 c4 e6
const indexNode = (turn: number) =>
  h('index.bg-gray-100.px-5.w-2.5.justify-center.flex.border-r-2.border-white-500.mr-2', `${turn + 1}`);

const moveNode = (ctrl: PrepCtrl, san: string, index: number) => {
  return h(
    'move.flex-1.hover:cursor-pointer.text-lg',
    {
      class: {
        'bg-sky-300': ctrl.pathIndex === index,
        'font-bold': ctrl.pathIndex === index,

        'hover:bg-sky-100': ctrl.pathIndex !== index,
      },
      on: {
        click: () => {
          console.log('clicked', index);
          ctrl.jump(index);
        },
      },
    },
    san,
  );
};

const rowNode = (elems: VNode[]) => h('div#move-row.flex', elems);

const pgnControls = (ctrl: PrepCtrl): VNode => {
  return h('div#pgn-control.mt-auto.flex.justify-center.gap-1', [
    h(
      'button#first',
      {
        on: {
          click: () => {
            ctrl.jump(0);
          },
        },
      },
      [firstI()],
    ),
    h(
      'button#back',
      {
        on: {
          click: () => {
            ctrl.jump(Math.max(0, ctrl.pathIndex - 1));
          },
        },
      },
      [backI()],
    ),
    h(
      'button#next',
      {
        on: {
          click: () => {
            ctrl.jump(Math.min(ctrl.path.length - 2, ctrl.pathIndex + 1));
          },
        },
      },
      [nextI()],
    ),
    h(
      'button#last',
      {
        on: {
          click: () => {
            ctrl.jump(ctrl.path.length - 2);
          },
        },
        class: {
          // 'bg-blue-500': !ctrl.atLast(),
          'animate-pulse-blue': !ctrl.atLast(),
        },
      },
      [lastI()],
    ),
  ]);
};

export const pgnTree = (ctrl: PrepCtrl): VNode => {
  let pgn: string[] = [];
  if (ctrl.chessSrs.state.path != null) {
    pgn = stringifyPath(ctrl.chessSrs.state.path as ChildNode<TrainingData>[]);
  }
  const rows: VNode[] = [];
  let elems: VNode[] = [];
  let i = 0;
  while (pgn.length > 0) {
    if (i % 2 == 0) {
      elems.push(indexNode(i / 2));
    }
    elems.push(moveNode(ctrl, pgn.shift()!, i)); //TODO pgn.length === 1 might ck
    i++;
    if (i % 2 == 0) {
      rows.push(rowNode(elems));
      elems = [];
    }
  }
  return h('div', [
    h('div#pgn.h-1/3.flex.flex-col.shadow-md.rounded-md.bg-white', [
      h('div#moves-header.h-5.border-b-2.border-gray-500'),
      h('div#moves.overflow-auto.h-64	', rows),
      toast(ctrl),
    ]),
    pgnControls(ctrl),
  ]);
};
