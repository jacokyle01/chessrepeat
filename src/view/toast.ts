import PrepCtrl from '../ctrl';
import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';
const recall = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div#recall.border-t-4.border-blue-500.rounded-md.shadow-lg', [
    h('div.bg-white.flex.items-center.justify-center.py-12.px-6.gap-3', [
      h('div.w-12.h-12.flex.items-center.justify-center', isWhite ? whiteKingI() : blackKingI()),
      h('div', [
        h('h1.font-bold.text-xl.text-gray-800', 'Your move'),
        h('h2.text-md.text-gray-600', `What does ${isWhite ? 'White' : 'Black'} play here?`),
      ]),
    ]),
    h('div#recall-options.flex', [
      h(
        'span#recall-fail.bg-blue-100.text-blue-700.font-semibold.text-lg.uppercase.flex-1.text-center.py-3.cursor-pointer.transition.hover:bg-blue-200',
        {
          on: { click: () => ctrl.handleFail() },
        },
        'Give up',
      ),
      h(
        'span#recall-hint.bg-blue-100.text-blue-700.font-semibold.text-lg.uppercase.flex-1.text-center.py-3.cursor-pointer.transition.hover:bg-blue-200',
        {
          on: { click: () => ctrl.toggleShowingHint() },
        },
        'Show hint',
      ),
    ]),
  ]);
};

const learn = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h(
    'div.bg-white.flex.items-center.justify-center.py-12.px-6.rounded-md.shadow-lg.border-t-4.border-blue-500.gap-3',
    [
      h('div.w-12.h-12.flex.items-center.justify-center', isWhite ? whiteKingI() : blackKingI()),
      h('div', [
        h('h1.font-bold.text-xl.text-gray-800', 'Your move'),
        h(
          'h2.text-md.text-gray-600',
          `${isWhite ? 'White' : 'Black'} plays ${ctrl.trainingPath.at(-1)!.data.san}`,
        ),
      ]),
    ],
  );
};

const empty = (): VNode => {
  return h(
    'div.bg-white.flex.flex-col.items-center.justify-center.py-12.px-6.rounded-md.shadow-lg.border-t-4.border-blue-500',
    [
      h('h1.font-bold.text-xl.text-gray-800', 'No moves'),
      h(
        'h2.text-md.text-gray-600.mt-2.text-center',
        'Try training a different repertoire or switching modes',
      ),
    ],
  );
};

const fail = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div#recall.border-t-2', [
    h('div.bg-white.py-10.shadow-md.flex.flex-col.items-center', [
      h('div.flex.flex-row.justify-center.items-center.w-full.space-x-5', [
        h('div.text-red-500.text-6xl.font-bold', '✗'),
        h('div#failure', [
          h('h2.text-xl.font-semibold', `${ctrl.lastGuess} is Incorrect`),
          h('p.text-lg', `${isWhite ? 'White' : 'Black'} plays ${ctrl.trainingPath.at(-1)!.data.san}`),
        ]),
      ]),
      h(
        'button#continue-btn.bg-orange-400.text-white.font-bold.py-2.px-6.mt-6.rounded.hover:bg-orange-500.active:transform.active:translate-y-px.active:border-b-2.border-orange-700',
        {
          on: {
            click: () => {
              ctrl.fail();
              ctrl.handleRecall();
            },
          },
        },
        'Continue Training ⮕',
      ),
    ]),
  ]);
};

export const toast = (ctrl: PrepCtrl): VNode | null => {
  switch (ctrl.lastFeedback) {
    case 'recall':
      return recall(ctrl);
    case 'learn':
      return learn(ctrl);
    case 'empty':
      return empty();
    case 'fail':
      return fail(ctrl);
    default:
      return h('div', 'Other');
  }
};
