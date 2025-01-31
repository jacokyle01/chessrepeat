import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import PrepCtrl from '../ctrl';
import { chessground } from './chessground';
import { gearI } from '../svg/gear';
import { closeI } from '../svg/close';
import { pgnTree } from './pgn';
import { recallI } from '../svg/recall';
import { bookI } from '../svg/book';
import { sidebar } from './sidebar';
import { progress } from './progress';
import { debug } from '../debug/debug';

export const fieldValue = (id: string): string => {
  return (document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement)?.value;
};

export const checked = (id: string) => (document.getElementById(id) as HTMLInputElement)?.checked;

const controls = (ctrl: PrepCtrl) => {
  return h(
    'div#training-controls.flex.items-end.gap-1.p-1.h-14.mr-auto.shadow-md.rounded-b-md.p-4.bg-white.items-center',
    [
      h(
        'button.text-white.font-bold.py-1.px-4.rounded.flex.border-blue-700.hover:border-blue-500.hover:bg-blue-400.active:transform.active:translate-y-px.active:border-b',
        {
          on: {
            click: () => ctrl.handleLearn(),
          },
          class: {
            'bg-blue-400': ctrl.method == 'learn',
            'translate-y-px': ctrl.method == 'learn',
            transform: ctrl.method == 'learn',
            'border-b': ctrl.method == 'learn',
            'border-b-4': ctrl.method === 'recall',
            'bg-blue-500': ctrl.method === 'recall',
          },
        },
        [h('span', 'LEARN'), bookI()],
      ),
      h(
        'button.text-white.font-bold.py-1.px-4.rounded.flex.border-orange-700.hover:border-orange-500.hover:bg-orange-400.active:transform.active:translate-y-px.active:border-b',
        {
          on: {
            click: () => ctrl.handleRecall(),
          },
          class: {
            'bg-orange-400': ctrl.method == 'recall',
            'translate-y-px': ctrl.method == 'recall',
            transform: ctrl.method == 'recall',
            'border-b': ctrl.method == 'recall',
            'border-b-4': ctrl.method === 'learn',
            'bg-orange-500': ctrl.method === 'learn',
          },
        },
        [h('span', 'RECALL'), recallI()],
      ),
      h(
        'div.ml-3',
        {
          on: {
            click: () => ctrl.toggleTrainingSettings(),
          },
        },
        [gearI()],
      ),
    ],
  );
};

const feedback = (ctrl: PrepCtrl): VNode | null => {
  switch (ctrl.lastResult) {
    case 'succeed':
      return h(
        'span.mr-auto',
        {
          class: {
            'text-green-600': true, // Green text to indicate success
            'font-semibold': true, // Slightly bolder text
            'inline-flex': true, // Ensures alignment with other elements
            'items-center': true, // Aligns icon and text vertically
            'gap-1': true, // Adds spacing between the checkmark and text
          },
        },
        [`✓ ${ctrl.lastGuess} was correct`],
      );
    case 'fail':
      return h(
        'span.mr-auto',
        {
          class: {
            'text-red-600': true, // Green text to indicate success
            'font-semibold': true, // Slightly bolder text
            'inline-flex': true, // Ensures alignment with other elements
            'items-center': true, // Aligns icon and text vertically
            'gap-1': true, // Adds spacing between the checkmark and text
          },
        },
        [`✗ ${ctrl.lastGuess} was incorrect`],
      );
      return null;
    //TODO remove
    case 'none':
      return h('span', 'null');
  }
};

// const addSubrepertoire = (ctrl: PrepCtrl): VNode => {
//   return h(
//     'button.flex.m-auto.bg-white.rounded-md.shadow-md.mt-2.p-2.flex.gap-2',
//     { on: { click: () => ctrl.toggleAddingNewSubrep() } },
//     [addI(), h('div', 'Add a repertoire')],
//   );
// };

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
            submit: (e: any) => {
              //TODO: give me a type!
              e.preventDefault();

              //TODO different conditional?
              //TODO fix reverse
              if (!checked('annotated')) {
                console.log('annotated!');
                ctrl.importAnnotatedSubrepertoire(fieldValue('pgn'));
              } else {
                ctrl.addToRepertoire(
                  fieldValue('pgn'),
                  checked('color') ? 'black' : 'white',
                  fieldValue('name'),
                );
              }

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
            h('input#fileInput', {
              attrs: {
                type: 'file',
                accept: '.txt,.pgn',
              },
              on: {
                change: (event) => {
                  const file = event.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      document.querySelector('#pgn')!.value = reader.result;
                    };
                    reader.readAsText(file);
                  }
                },
              },
            }),
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
          h('div.mb-5', [
            h('label.block.text-gray-700.text-sm.font-bold.mb-2', 'Repertoire is annotated?'),
            h(
              'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100',
              {
                attrs: { for: 'annotated' },
              },
              [
                h('input#annotated.hidden.peer', {
                  attrs: { type: 'checkbox' },
                }),
                h('span.px-4.rounded-l-md.bg-gray-700.peer-checked:bg-gray-300', 'Yes'),
                h('span.px-4.rounded-r-md.bg-gray-300.peer-checked:bg-gray-700', 'No'),
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
  return h('div#root.flex.flex-col.lg:flex-row.justify-center.bg-blue-gray.gap-5.h-full.w-full', [
    h('div#row-container.flex.flex-row.gap-5', [
      sidebar(ctrl),
      h('div#main-wrap.flex-1', [
        progress(ctrl),
        chessground(ctrl),
        h('div.flex.flex-1', [controls(ctrl), feedback(ctrl)]),
      ]), //TODO from top-to-bottom: mode-wrap, board, informational messages
      pgnTree(ctrl),
    ]),
    ctrl.addingNewSubrep && newSubrepForm(ctrl),
    // debug(ctrl)
  ]);
};
export default view;
