import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import PrepCtrl from '../ctrl';
import { chessground } from '../chessground';
import { gearI } from '../svg/gear';
import { addI } from '../svg/add';
import { closeI } from '../svg/close';
import { pgnTree } from './pgn';
import { recallI } from '../svg/recall';
import { bookI } from '../svg/book';
import { debug } from './debug';
import { chartI } from '../svg/chart';
import { commentI } from '../svg/comment';

export const fieldValue = (id: string) =>
  (document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement)?.value;

export const checked = (id: string) => (document.getElementById(id) as HTMLInputElement)?.checked;

const controls = (ctrl: PrepCtrl) => {
  return h(
    'div#training-controls.flex.items-end.gap-1.justify-center.p-1.h-14.mx-auto.my-4.shadow-md.rounded-md.p-4.bg-white.items-center',
    [
      h(
        'button.text-white.font-bold.py-1.px-4.border-blue-700.hover:border-blue-500.rounded.border-b-4.hover:bg-blue-400.flex.active:transform.active:translate-y-px.active:border-b',
        {
          on: {
            click: () => ctrl.handleLearn(),
          },
          class: {
            'bg-blue-500': ctrl.chessSrs.state.method == 'recall',
            'bg-blue-400': ctrl.chessSrs.state.method == 'learn',
            'border-blue-700': ctrl.chessSrs.state.method == 'recall',
            'border-blue-500': ctrl.chessSrs.state.method == 'learn',
            'translate-y-px': ctrl.chessSrs.state.method == 'learn',
            'border-b': ctrl.chessSrs.state.method == 'learn',
          },
        },
        [h('span', 'LEARN'), bookI(ctrl)],
      ),
      h(
        'button.text-white.font-bold.py-1.px-4.border-orange-700.hover:border-orange-500.rounded.border-b-4.hover:bg-orange-400.flex.active:transform.active:translate-y-px.active:border-b',
        {
          on: {
            click: () => ctrl.handleRecall(),
          },
          class: {
            'bg-orange-500': ctrl.chessSrs.state.method == 'learn',
            'bg-orange-400': ctrl.chessSrs.state.method == 'recall',
            'border-orange-700': ctrl.chessSrs.state.method == 'learn',
            'border-orange-500': ctrl.chessSrs.state.method == 'recall',
            'translate-y-px': ctrl.chessSrs.state.method == 'recall',
            'border-b': ctrl.chessSrs.state.method == 'recall',
          },
        },
        [h('span', 'RECALL'), recallI(ctrl)],
      ),
      h('div#open-chart.rounded.bg-green-400.p-1.border-b-4.border-green-600', [chartI()]),
    ],
  );
};

const addSubrepertoire = (ctrl: PrepCtrl): VNode => {
  return h('button.flex.m-auto', { on: { click: () => ctrl.toggleAddingNewSubrep() } }, addI());
};

const subrepertoireTree = (ctrl: PrepCtrl): VNode => {
  const count = ctrl.subrepertoireNames.length;
  return h('div#subrepertoire-tree-wrap.w-64.flex-row', [
    ...ctrl.subrepertoireNames.map(
      (
        name,
        index, //TODO include graph of progress
      ) =>
        h(
          'div.subrepertoire.flex.items-center.justify-around.hover:bg-cyan-50',
          {
            on: {
              click: () => ctrl.selectSubrepertoire(index),
            },
            class: {
              'bg-cyan-50': ctrl.chessSrs.state.index == index,
            },
          },
          [
            h('span.font-medium.text-cyan-400.pr-3', (index + 1).toString()),
            h('h3.text-lg.font-light.flex-1', name),
            // chart(ctrl),
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
                alias: fieldValue('name'),
                pgn: fieldValue('pgn'),
                trainAs: checked('color') ? 'black' : 'white',
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

//TODO add sidebar under repertoire tree with information specific to this subrepertoire that we are training
//stats & # due
//date added
const view = (ctrl: PrepCtrl): VNode => {
  return h('div#root.flex.justify-center.gap-5.bg-custom-gradient.h-full.items-start.p-3', [
    // ctrl.addingNewSubrep !== false && h('div', 'test'),
    h('div#reperoire-wrap.bg-white.block-inline.shadow-md.rounded-md', [
      subrepertoireTree(ctrl),
      addSubrepertoire(ctrl),
    ]),
    h('div#main-wrap', [chessground(ctrl), controls(ctrl)]), //TODO from top-to-bottom: mode-wrap, board, informational messages
    //TODO gross
    // ctrl.chessSrs.path() && pgnTree(stringifyPath(ctrl.chessSrs.state.path as ChildNode<TrainingData>[])),
    h('div#side.w-1/5.flex-col', [
      pgnTree(ctrl),
      ctrl.chessSrs.path()?.at(-2)?.data.comments &&
        h('div#comment.p-1.py-5.m-5.bg-white.shadow-md.rounded-md', [commentI(), h('h4', ctrl.chessSrs.path()?.at(-2)?.data.comments)]),
    ]),
    ctrl.chessSrs.path()?.at(-2)?.data.comments && ctrl.addingNewSubrep && newSubrepForm(ctrl),
    debug(ctrl),
  ]);
};
export default view;
