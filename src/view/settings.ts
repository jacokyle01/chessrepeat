import PrepCtrl from '../ctrl';
import { returnI } from '../svg/return';
import { looseH as h } from '../types/snabbdom';

export const settings = (ctrl: PrepCtrl) => {
  return h('div.bg-white.h-full.flex-1', [
    h(
      'button.text-white.font-bold.py-1.px-2.bg-blue-500.border-b-4.rounded.flex.border-blue-700.hover:border-blue-500.hover:bg-blue-400.active:transform.active:translate-y-px.active:border-b.my-2',
      [
        h('div#return', [returnI()]),
        h('span', { on: { click: () => ctrl.toggleTrainingSettings() } }, 'BACK TO TRAINING'),
      ],
    ),
    h('div.flex.items-center', [
      h('div.flex-grow border-t.border-gray-400'),
      h('div.mx-4.text-lg.font-bold.text-center.text-l.font-mono.text-gray-400', 'Spaced Repetition'),
      h('div.flex-grow.border-t.border-gray-400'),
    ]),
    h('div#get-next.p-2', [
      h('label.block.text-lg.font-bold', 'Get next by'),
      h(
        'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100.w-3/4',
        {
          attrs: { for: 'color' },
        },
        [
          h('input#color.hidden.peer', {
            attrs: { type: 'checkbox' },
          }),
          h(
            'span.px-4.rounded-l-md.bg-blue-700.peer-checked:bg-blue-300.flex-1.p-1.text-center',
            {
              on: {
                click: () =>
                  ctrl.setSrsConfig({
                    getNext: {
                      by: 'breadth',
                    },
                  }),
              },
            },
            'Breadth',
          ),
          h(
            'span.px-4.rounded-r-md.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center',
            {
              on: {
                click: () =>
                  ctrl.setSrsConfig({
                    getNext: {
                      by: 'depth',
                    },
                  }),
              },
            },
            'Depth',
          ),
        ],
      ),
    ]),
    h('div#promotion.p-2', [
      h('label.block.text-lg.font-bold', 'Promotion'),
      h(
        'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100.w-3/4',
        {
          attrs: { for: 'color' },
        },
        [
          h('input#color.hidden.peer', {
            attrs: { type: 'checkbox' },
          }),
          h('span.px-4.rounded-l-md.bg-blue-700.peer-checked:bg-blue-300.flex-1.p-1.text-center', 'Next'),
          h('span.px-4.rounded-r-md.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center', 'Most'),
        ],
      ),
    ]),
    h('div#promotion.p-2', [
      h('label.block.text-lg.font-bold', 'Demotion'),
      h(
        'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100.w-3/4',
        {
          attrs: { for: 'color' },
        },
        [
          h('input#color.hidden.peer', {
            attrs: { type: 'checkbox' },
          }),
          h('span.px-4.rounded-l-md.bg-blue-700.peer-checked:bg-blue-300.flex-1.p-1.text-center', 'Next'),
          h('span.px-4.rounded-r-md.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center', 'Most'),
        ],
      ),
    ]),
    h('div.flex.items-center', [
      h('div.flex-grow border-t.border-gray-400'),
      h('div.mx-4.text-lg.font-bold.text-center.text-l.font-mono.text-gray-400', 'Display'),
      h('div.flex-grow.border-t.border-gray-400'),
    ]),
    h('div#anim.p-2', [
      h('label.block.text-lg.font-bold', 'Piece animation'),
      h(
        'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100.w-3/4',
        {
          attrs: { for: 'color' },
        },
        [
          h('input#color.hidden.peer', {
            attrs: { type: 'checkbox' },
          }),
          h(
            'span.px-4.rounded-l-md.bg-blue-700.peer-checked:bg-blue-300.flex-1.p-1.text-center',
            {
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    animation: {
                      duration: 0,
                    },
                  });
                },
              },
            },
            'None',
          ),
          h(
            'span.px-4.border-white.border-x-2.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center',
            {
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    animation: {
                      enabled: true,
                      duration: 500,
                    },
                  });
                },
              },
            },
            'Slow',
          ),
          h(
            'span.px-4.border-white.border-r-2.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center',
            {
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    animation: {
                      enabled: true,
                      duration: 250,
                    },
                  });
                },
              },
            },
            'Normal',
          ),
          h(
            'span.px-4.rounded-r-md.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center',
            {
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    animation: {
                      enabled: true,
                      duration: 120,
                    },
                  });
                },
              },
            },
            'Fast',
          ),
        ],
      ),
    ]),

    h('div#coord.p-2', [
      h('label.block.text-lg.font-bold', 'Coordinates'),
      h(
        'label.inline-flex.items-center.rounded-md.cursor-pointer.text-gray-100.w-3/4',
        {
          attrs: { for: 'color' },
        },
        [
          h('input#color.hidden.peer', {
            attrs: { type: 'checkbox' },
          }),
          h(
            'span.px-4.rounded-l-md.bg-blue-700.peer-checked:bg-blue-300.flex-1.p-1.text-center',
            {
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    coordinates: false,
                  });
                  console.log(ctrl.chessground?.state);
                  //TODO we shouldn't have to do this?
                  ctrl.chessground?.redrawAll();
                },
              },
            },
            'None',
          ),
          h(
            'span.px-4.border-white.border-x-2.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center',
            {
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    coordinates: true,
                    coordinatesOnSquares: false,
                  });
                  console.log(ctrl.chessground?.state);
                  //TODO we shouldn't have to do this?
                  ctrl.chessground?.redrawAll();
                },
              },
            },
            'Outside',
          ),
          h(
            'span.px-4.rounded-r-md.bg-blue-300.peer-checked:bg-blue-700.flex-1.p-1.text-center',
            {
              // is broken
              on: {
                click: () => {
                  ctrl.chessground!.set({
                    coordinatesOnSquares: true,
                  });
                  ctrl.chessground?.redrawAll();
                },
              },
            },
            'Each square',
          ),
        ],
      ),
    ]),
  ]);
};
