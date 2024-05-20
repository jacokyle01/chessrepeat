import { VNode } from 'snabbdom';
// import { looseH}
import { looseH as h } from './snabbdom';
import PrepCtrl from './ctrl';
import { chessground } from './chessground';
import { NewSubrepertoire } from './types';
import { gearI } from './svg/gear';
import { addI } from './svg/add';
import { closeI } from './svg/close';
import { pgnTree } from './pgn';
import { recallI } from './svg/recall';
import { bookI } from './svg/book';
import { stringifyPath } from './util';
import { Path, TrainingData } from 'chess-srs/types';
import { ChildNode } from 'chessops/pgn';
import { infoI } from './svg/info';
import { questionI } from './svg/question';

export const fieldValue = (e: Event, id: string) =>
  (document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement)?.value;

export const checked = (e: Event, id: string) => (document.getElementById(id) as HTMLInputElement)?.checked;

const mode = (ctrl: PrepCtrl) => {
  return h('div#mode-wrap.flex.items-end.gap-1.justify-center', [
    // h('h3.font-light', 'mode'),
    h(
      'button.text-white.font-bold.py-1.px-4.border-blue-700.hover:border-blue-500.rounded.bg-blue-500.border-b-4.hover:bg-blue-400.flex',
      {
        on: {
          click: () => ctrl.handleLearn(),
        },
        class: {
          'bg-blue-400': ctrl.chessSrs.state.method == 'learn',
          'border-blue-500': ctrl.chessSrs.state.method == 'learn',
        },
      },
      [h('span', 'LEARN'), bookI(ctrl)],
    ),
    h(
      'button.text-white.font-bold.py-1.px-4.border-orange-700.hover:border-orange-500.rounded.bg-orange-500.border-b-4.hover:bg-orange-400.flex',
      {
        on: {
          click: () => ctrl.handleRecall(),
        },
        class: {
          'bg-orange-400': ctrl.chessSrs.state.method == 'recall',
          'border-orange-500': ctrl.chessSrs.state.method == 'recall',
        },
      },
      [h('span', 'RECALL'), recallI(ctrl)],
    ),
  ]);
};
// <button class="bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 px-4 border-b-4 border-blue-700 hover:border-blue-500 rounded">

const addSubrepertoire = (ctrl: PrepCtrl): VNode => {
  return h('button.flex.m-auto', { on: { click: () => ctrl.toggleAddingNewSubrep() } }, addI());
};

const subrepertoireTree = (ctrl: PrepCtrl): VNode => {
  const count = ctrl.subrepertoireNames.length;
  return h('div#subrepertoire-tree-wrap.w-64.flex-row', [
    count == 0
      ? h('div.mx-5.border-b-2.border-cyan-400', 'Nothing to see')
      : count == 1
        ? h('div.mx-5.border-b-2.border-cyan-400', '1 Entry')
        : h('span.mx-5.border-b-2.border-cyan-400.m-auto', `${count} entries`),
    ...ctrl.subrepertoireNames.map(
      (
        name,
        index, //TODO include graph of progress
      ) =>
        h(
          'div.subrepertoire.flex.items-center.justify-around.hover:bg-cyan-100',
          {
            on: {
              click: () => ctrl.selectSubrepertoire(index),
            },
            class: {
              'bg-cyan-100': ctrl.chessSrs.state.index == index,
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

const newSubrepForm = (ctrl: PrepCtrl): VNode | false => {
  return h(
    'dialog.fixed.top-1/2.left-1/2.transform.-translate-x-1/2.-translate-y-1/2.z-50.border-none',
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
        'form.p-8.bg-white.rounded-md.shadow-md',
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

const toast = (ctrl: PrepCtrl): VNode | null => {
  return (
    ctrl.toastMessage &&
    h('div.p-2', [
      h('div.w-50.shadow-lg.rounded-lg.flex', [
        h(
          'div.bg-blue-500.py-4.px-6.rounded-l-lg.flex.items-center',
          {
            class: {
              'bg-blue-500': ctrl.toastMessage.type === 'learn',
              'bg-orange-500': ctrl.toastMessage.type === 'recall'

            },
          },
          [ctrl.toastMessage.type === 'learn' ? infoI() : questionI()],
        ),
        h(
          'div.px-4.py-2.bg-white.rounded-r-lg.flex.justify-between.items-center.w-full.border.border-l.transparent.border-gray-200',
          [h('div.font-light.text-sm', ctrl.toastMessage.message), h('button', [closeI()])],
        ),
      ]),
    ])
  );
};

//TODO add sidebar under repertoire tree with information specific to this subrepertoire that we are training
//stats & # due
//date added
const view = (ctrl: PrepCtrl): VNode => {
  return h('div#root.flex.justify-center.gap-5.bg-neutral-100.h-full.items-start', [
    // ctrl.addingNewSubrep !== false && h('div', 'test'),
    h('div#reperoire-wrap.bg-white.rounded-lg.block-inline', [
      subrepertoireTree(ctrl),
      addSubrepertoire(ctrl),
    ]),
    h('div#main-wrap', [mode(ctrl), chessground(ctrl), toast(ctrl)]), //TODO from top-to-bottom: mode-wrap, board, informational messages
    //TODO gross
    ctrl.chessSrs.path() && pgnTree(stringifyPath(ctrl.chessSrs.state.path as ChildNode<TrainingData>[])),
    ctrl.addingNewSubrep && newSubrepForm(ctrl),
  ]);
};
export default view;
