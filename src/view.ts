import { VNode } from 'snabbdom';
// import { looseH}
import { looseH as h } from './snabbdom';
import PrepCtrl from './ctrl';
import { chessground } from './chessground';
import { NewSubrepertoire } from './types';
import { gearI } from './svg/gear';
import { addI } from './svg/add';
import { closeI } from './svg/close';

export const fieldValue = (e: Event, id: string) =>
  (document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement)?.value;

export const checked = (e: Event, id: string) => (document.getElementById(id) as HTMLInputElement)?.checked;

// const start = (ctrl: PrepCtrl) => {
//   return h('div#control-wrap', [
//     h('button#learn', { on: { click: () => ctrl.handleLearn() } }, 'learn'),
//     h('button#recall', { on: { click: () => ctrl.handleRecall() } }, 'recall'),
//   ]);
// };

const mode = (ctrl: PrepCtrl) => {
  return h('div#mode-wrap.flex.items-end.gap-1.justify-center', [
    // h('h3.font-light', 'mode'),
    h(
      'button.text-white.font-bold.py-1.px-4.border-blue-700.hover:border-blue-500.rounded.bg-blue-500.border-b-4.hover:bg-blue-400',
      {
        on: {
          click: () => ctrl.handleLearn(),
        },
        class: {
          'bg-blue-400': ctrl.chessSrs.state.method == 'learn',
          'border-blue-500': ctrl.chessSrs.state.method == 'learn',
        },
      },
      'LEARN',
    ),
    h(
      'button.text-white.font-bold.py-1.px-4.border-orange-700.hover:border-orange-500.rounded.bg-orange-500.border-b-4.hover:bg-orange-400',
      {
        on: {
          click: () => ctrl.handleRecall(),
        },
        class: {
          'bg-orange-400': ctrl.chessSrs.state.method == 'recall',
          'border-orange-500': ctrl.chessSrs.state.method == 'recall',
        },
      },
      'RECALL',
    ),
  ]);
};
// <button class="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded">

const addSubrepertoire = (ctrl: PrepCtrl): VNode => {
  return h('button.flex.m-auto', { on: { click: () => ctrl.toggleAddingNewSubrep() } }, addI());
};

const subrepertoireTree = (ctrl: PrepCtrl): VNode => {
  const count = ctrl.subrepertoireNames.length;
  return h('div#subrepertoire-tree-wrap.w-64.shadow.appearance-none.border.rounded', [
    count == 0
      ? h('div.mx-5.border-b-2.border-cyan-400', 'Nothing to see')
      : count == 1
        ? h('div.mx-5.border-b-2.border-cyan-400', '1 Entry')
        : h('div.mx-5.border-b-2.border-cyan-400', `${count} entries`),
    ...ctrl.subrepertoireNames.map((name, index) =>
      h(
        'div.subrepertoire.flex.items-center.justify-around',
        {
          on: {
            click: () => ctrl.selectSubrepertoire(index),
          },
          class: {
            selected: ctrl.chessSrs.state.index == index,
          },
        },
        [
          h('span.font-medium.text-cyan-400.pr-3', (index + 1).toString()),
          h('h3.font-light.flex-1', name),
          gearI(),
        ],
      ),
    ),
  ]);
};

// const status = (ctrl: PrepCtrl): VNode => {
//   return h('div#status', [
//     h(
//       'div',
//       {
//         class: {
//           selected: ctrl.chessSrs.state.method == 'learn',
//         },
//       },
//       'Learn',
//     ),
//     h(
//       'div',
//       {
//         class: {
//           selected: ctrl.chessSrs.state.method == 'recall',
//         },
//       },
//       'Recall',
//     ),
//   ]);
// };

const newSubrepForm = (ctrl: PrepCtrl): VNode | false => {
  return h(
    'dialog.fixed.top-1/2.left-1/2.transform.-translate-x-1/2.-translate-y-1/2.z-50.p-0.border-none',
    {
      attrs: { open: true },
    },
    [
      h(
        'button.bg-red-500.rounded-full.h-6.w-6.flex.items-center.justify-center.absolute.top-1.right-1',
        { on: { click: () => ctrl.toggleAddingNewSubrep() } },
        closeI(),
      ),
      h(
        'form.bg-white.shadow-md.rounded.px-8.pt-6.pb-8.mb-4',
        {
          on: {
            submit: (e) => {
              e.preventDefault();
              ctrl.addSubrepertoire({
                alias: fieldValue(e, 'name'),
                pgn: fieldValue(e, 'pgn'),
                trainAs: checked(e, 'color') ? 'black' : 'white',
              });
              ctrl.toggleAddingNewSubrep();
            },
          },
        },
        [
          h('div.mb-2', [
            h('label.block.text-gray-700.text-sm.font-bold.mb-2', 'Name'),
            h(
              'input#name.shadow.appearance-none.border.rounded.w-full.py-2.px-3.text-gray-700.mb-3.leading-tight.focus:outline-none.focus:shadow-outline',
            ),
          ]),
          h('div.mb-3', [
            h('label.block.text-gray-700.text-sm.font-bold.mb-2', 'PGN'),
            h(
              'textarea#pgn.shadow.block.w-full.text-sm.text-gray-700.rounded-lg.border.border-gray-300.p-3',
              {
                attrs: {
                  rows: '4',
                  placeholder: 'Enter PGN...\nex. 1. d4 d5 2. c4 c6',
                },
              },
            ),
          ]),
          h('div.mb-5', [
            h('label.block.text-gray-700.text-sm.font-bold.mb-2', 'Train As'),
            h(
              'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100',
              {
                attrs: { for: 'color' },
              },
              [
                h('input#color.hidden.peer', {
                  attrs: { type: 'checkbox' },
                }),
                h('span.px-4.rounded-l-md.bg-gray-700.peer-checked:bg-gray-300', 'White'),
                h('span.px-4.rounded-r-md.bg-gray-300.peer-checked:bg-gray-700', 'Black'),
              ],
            ),
          ]),
          h(
            'button.bg-blue-500.hover:bg-blue-700.text-white.font-bold.py-2.px-4.rounded.focus:outline-none.focus:shadow-outline',
            {
              attrs: {
                type: 'submit',
              },
            },
            'Add',
          ),
        ],
      ),
    ],
  );
};

//mostly for debugging, but something similiar should get implemented (with a markedly better UI)
const rightWrap = (ctrl: PrepCtrl): VNode => {
  return h('h1#right-wrap', [
    h('h2', 'PGN tree'),
    // h('div', ctrl.chessSrs.state().repertoire),
    h('h2', 'Path'),
    h('div', ctrl.chess.pgn()),
    h('h2', 'FEN'),
    h('div', ctrl.getFen()),
  ]);
};

const view = (ctrl: PrepCtrl): VNode => {
  return h('div#root.flex.justify-center.gap-5.bg-neutral-100.h-full.items-start', [
    // ctrl.addingNewSubrep !== false && h('div', 'test'),
    h('div#reperoire-wrap.bg-white.rounded-lg.block-inline', [
      subrepertoireTree(ctrl),
      addSubrepertoire(ctrl),
    ]),
    h('div#main-wrap', [chessground(ctrl), mode(ctrl)]),
    rightWrap(ctrl),
    ctrl.addingNewSubrep && newSubrepForm(ctrl),
  ]);
};
export default view;
