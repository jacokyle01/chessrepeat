import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';

import PrepCtrl from '../ctrl';
import { backI } from '../svg/back';
import { firstI } from '../svg/first';
import { lastI } from '../svg/last';
import { nextI } from '../svg/next';
import { toast } from './toast';

//gets a PGN tree DOM node from a PGN string
//e.x. d4 d5 c4 e6
const indexNode = (turn: number) =>
  h('index.bg-gray-100.px-5.justify-center.flex.border-r-2.border-white-500.w-8', `${turn + 1}`);

const moveNode = (ctrl: PrepCtrl, san: string, index: number) => {

  const isMarkedCorrect = ctrl.correctMoveIndices.includes(index);

  console.log("index", index);
  // let trailer = "";
  // if (ctrl.correctMoveIndices.includes(index)) {
  //   trailer = " yes";
  // }

  return h(
    'move.flex-1.hover:cursor-pointer.text-lg.pl-2',
    {
      class: {
        'bg-sky-300': ctrl.pathIndex === index,
        'font-bold': ctrl.pathIndex === index,

        'hover:bg-sky-100': ctrl.pathIndex !== index,
        // 'hover:bg-green-100': (ctrl.pathIndex !== index) && isMarkedCorrect,

      },
      on: {
        click: () => {
          console.log('clicked', index);
          ctrl.jump(index);
        },
      },
    },
    isMarkedCorrect ? `${san} ✓` : san,
  );
};

const emptyNode = () => {
  return h('move.flex-1.hover:cursor-pointer.text-lg', '...');
};

// TODO remove hack
const veryEmptyNode = () => {
  return h('move.flex-1.hover:cursor-pointer.text-lg', '');
};


const rowNode = (elems: VNode[]) => h('div#move-row.flex', elems);

const commentNode = (text: string) => {
  return h('div.bg-gray-100.border-y-2.border-white-500.font-mono.text-sm.flex.items-center', text);
};

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
            ctrl.jump(Math.min(ctrl.trainingPath.length - 2, ctrl.pathIndex + 1));
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
            ctrl.jump(ctrl.trainingPath.length - 2);
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
  const rows: VNode[] = [];
  let elems: VNode[] = [];
  
  for (let i = 0; i < ctrl.trainingPath.length - 1; i++) {
    const node = ctrl.trainingPath[i];
    if (i % 2 == 0) {
      elems.push(indexNode(i / 2));
    }
    elems.push(moveNode(ctrl, node.data!.san, i)); //TODO pgn.length === 1 might ck
    if (node.data.comments) {
      if (i % 2 == 0) {
        elems.push(emptyNode());
        rows.push(rowNode(elems));
      }
      rows.push(commentNode(node.data.comments[0]));
      if (i % 2 == 0) {
        elems = [indexNode(i / 2), emptyNode()];
      }
    }
    if (i % 2 == 1) {
      rows.push(rowNode(elems));
      elems = [];
    }
  }
  elems.push(veryEmptyNode());
  rows.push(rowNode(elems));

  return h('div', [
    h('div#pgn.h-1/3.flex.flex-col.shadow-md.rounded-t-lg.bg-white', [
      h('div#moves.overflow-auto.h-80', rows),
    ]),
    
    pgnControls(ctrl),
    toast(ctrl),
  ]);
};
