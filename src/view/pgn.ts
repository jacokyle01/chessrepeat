import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';

import PrepCtrl from '../ctrl';
import { backI } from '../svg/back';
import { firstI } from '../svg/first';
import { lastI } from '../svg/last';
import { nextI } from '../svg/next';
import { toast } from './toast';
import { commentI } from '../svg/comment';
import { trashI } from '../svg/trash';
import { addCommentI } from '../svg/addComment';
import { fieldValue } from './view';
import { clipboardI } from '../svg/clipboard';

//gets a PGN tree DOM node from a PGN string
//e.x. d4 d5 c4 e6
const indexNode = (turn: number) =>
  h(
    'index.bg-gray-100.px-5.justify-center.flex.border-r-2.border-white-500.text-gray-700.basis-[12%]',
    `${turn + 1}`,
  );

const moveNode = (ctrl: PrepCtrl, san: string, index: number) => {
  const isMarkedCorrect = ctrl.correctMoveIndices.includes(index);

  // console.log('index', index);
  // let trailer = "";
  // if (ctrl.correctMoveIndices.includes(index)) {
  //   trailer = " yes";
  // }

  if (!isMarkedCorrect) {
    return h(
      'move.hover:cursor-pointer.text-lg.pl-2.basis-[44%].text-gray-700',
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
      `${san} ${index}`,
    );
  } else {
    return h(
      'move.hover:cursor-pointer.text-lg.pl-2.justify-between.items-center.basis-[44%].flex.text-green-600',
      {
        class: {
          'bg-green-300': ctrl.pathIndex === index,
          'font-bold': ctrl.pathIndex === index,

          'hover:bg-green-100': ctrl.pathIndex !== index,
          // 'hover:bg-green-100': (ctrl.pathIndex !== index) && isMarkedCorrect,
        },
        on: {
          click: () => {
            console.log('clicked', index);
            ctrl.jump(index);
          },
        },
      },
      [h('span', `${san} ${index}`), h('span.text-xl', '✓')],
    );
  }
};

const emptyNode = () => {
  return h('move.flex-1.hover:cursor-pointer.text-lg.basis-[44%].pl-2.text-gray-700', '...');
};

// TODO remove hack
const veryEmptyNode = () => {
  return h('move.flex-1.hover:cursor-pointer.text-lg', '');
};

const rowNode = (elems: VNode[]) => h('div#move-row.flex', elems);

// nodeNumber and commentNumber provide the necessary context so we can remove it if necessary
const commentNode = (ctrl: PrepCtrl, text: string, nodeNumber: number, commentNumber: number) => {
  return h('div.comment.flex.border-y-2.border-white-500', [
    h('div.comment-icons.flex.flex-col.bg-gray-100', [
      h('index.bg-gray-100.px-5.justify-center.flex.w-8.p-1', commentI()),
      h(
        'index.bg-gray-100.px-5.justify-center.flex.w-8.p-1',
        {
          on: {
            click: () => {
              let data = ctrl.trainingPath.at(nodeNumber)!.data.comments;
              console.log('comment clicked');
              console.log('move', ctrl.trainingPath.at(nodeNumber)!.data.san);
              console.log('comment', ctrl.trainingPath.at(nodeNumber)!.data.comments);
              // remove comment at commentNumber
              data!.splice(commentNumber, 1);
              ctrl.redraw();
            },
          },
        },
        trashI(),
      ),
    ]),

    h('div.bg-gray-100.text-md.flex.items-center.font-mono.w-full', text),
  ]);

  // return h('div.bg-gray-100.border-y-2.border-white-500.text-md.flex.items-center', text);
};

const pgnControls = (ctrl: PrepCtrl): VNode => {
  return h('div#pgn-control.flex.justify-center.w-full.mt-3', [
    h(
      'button#first.flex-grow.flex.items-center.m-auto.justify-center.py-2.5 px-5 text-sm font-medium focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700',
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
      'button#back.flex-grow.flex.items-center.m-auto.justify-center.py-2.5 px-5  text-sm font-medium focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700',
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
      'button#next.flex-grow.flex.items-center.m-auto.justify-center.py-2.5 px-5 text-sm font-medium focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700',
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
      'button#last.flex-grow.flex.items-center.m-auto.justify-center.py-2.5 px-5 text-sm font-medium focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700',
      {
        on: {
          click: () => {
            ctrl.jump(ctrl.trainingPath.length - 2);
          },
        },
        class: {
          'animate-pulse-blue': !ctrl.atLast(),
        },
      },
      [lastI()],
    ),
  ]);
};

export const pgnTree = (ctrl: PrepCtrl): VNode => {
  let elms: VNode[] = [];
  let rows: VNode[] = [];

  let ply = 0;
  for (let i = 0; i < ctrl.trainingPath.length - 1; i++) {
    const node = ctrl.trainingPath[i];
    const move = node.data.san;
    const evenMove = i % 2 == 0;
    if (evenMove) elms.push(indexNode(Math.floor(ply / 2)));
    //
    elms.push(moveNode(ctrl, node.data.san!, i));
    ply++;
    const addEmptyMove = evenMove && node.data.comments;
    if (addEmptyMove) elms.push(emptyNode());
    node.data.comments?.forEach((comment, j) => elms.push(commentNode(ctrl, comment, i, j)));
    if (addEmptyMove) elms.push(indexNode(Math.floor(ply / 2)), emptyNode());
  }

  let i = 0;
  while (i < elms.length) {
    console.log('i', i);
    console.log('elms', elms);
    const node = elms[i];
    console.log('node', node);
    const type = node;
    // console.log(type.sel)
    // console.log(type.sel?.startsWith("div.comment"));

    //TODO remove major hack, handle with CSS
    console.log('type.sel', type.sel);
    if (type.sel?.startsWith('div.comment')) {
      console.log('div.comment push to rows');
      rows.push(node); // just the comment
      i += 1;
    } else {
      rows.push(rowNode([...elms.slice(i, i + 3)])); // grab up to 3 non-comments
      i += 3;
    }
  }

  return (
    ctrl.trainingPath &&
    h('div', [
      h('div#pgn_side.h-1/3.flex.flex-col.shadow-md.rounded-t-lg.bg-white', [
        h('div#moves.overflow-auto.h-80', rows),
      ]),

      toast(ctrl),
      pgnControls(ctrl),

      h('div#add-comment-wrap.flex.flex-col.items-start', [
        h('textarea#comment-input.w-full.h.32.rounded-md.shadow-md.bg-stone-100'),
        h(
          'button.flex.bg-blue-500.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.px-5.transition.duration-200.ease-in-out.hover:bg-blue-600.active:scale-95.shadow-md.hover:shadow-lg',
          {
            on: {
              click: () => {
                let comment = fieldValue('comment-input');
                if (!ctrl.trainingPath.at(ctrl.pathIndex)!.data.comments) {
                  ctrl.trainingPath.at(ctrl.pathIndex)!.data.comments = [];
                }
                ctrl.trainingPath!.at(ctrl.pathIndex)!.data!.comments!.push(comment);
                ctrl.redraw();
              },
            },
          },
          [h('div', [addCommentI()]), h('div', 'Add Comment')],
        ),
      ]),
    ])
  );
};
