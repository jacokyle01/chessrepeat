import PrepCtrl from '../ctrl';
import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';
const recall = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div#recall.border-t-2', [
    h('div.bg-white.flex.py-10.shadow-md', [
      h('div.w-12.mx-2', isWhite ? whiteKingI() : blackKingI()),
      h('div', [
        h('h1.font-bold.text-lg', 'Your move'),
        h('h2.text-md', `What does ${isWhite ? 'White' : 'Black'} play here?`),
      ]),
    ]),
    h('div#recall-options.flex.flex-row', [
      h(
        'span#recall-fail.bg-red-200.font-semibold.text-lg.uppercase.flex-1.text-center.rounded-bl-md',
        {
          on: {
            click: () => {
              ctrl.handleFail();
            },
          },
        },

        'Give up',
      ),
      h(
        'span#recall-fail.bg-cyan-200.font-semibold.text-lg.uppercase.flex-1.text-center.rounded-br-md',
        {
          on: {
            click: () => {
              ctrl.toggleShowingHint();
            },
          },
        },
        'Show hint',
      ),
    ]),
  ]);
};

const learn = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div.bg-white.flex.py-10.rounded-b-md.shadow-md.border-t-2', [
    h('div.w-12.mx-2', isWhite ? whiteKingI() : blackKingI()),
    h('div', [
      h('h1.font-bold.text-lg', 'Your move'),
      h('h2.text-md', `${isWhite ? 'White' : 'Black'} plays ${ctrl.trainingPath.at(-1)!.data.san}`),
    ]),
  ]);
};

const empty = (): VNode => {
  return h('div.bg-white.flex.py-10.rounded-b-md.shadow-md.border-t-2', [
    h('div', [
      h('h1.font-bold.text-lg', 'No moves'),
      h('h2.text-md', 'Try training a different repertoire or switching modes'),
    ]),
  ]);
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
