import PrepCtrl from '../ctrl';
import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';
import { crossI } from '../svg/cross';
import { wrongI } from '../svg/wrong';
import { on } from 'events';

const recall = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div#recall', [
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
  return h('div.bg-white.flex.py-10.rounded-b-md.shadow-md', [
    h('div.w-12.mx-2', isWhite ? whiteKingI() : blackKingI()),
    h('div', [
      h('h1.font-bold.text-lg', 'Your move'),
      h('h2.text-md', `${isWhite ? 'White' : 'Black'} plays ${ctrl.trainingPath.at(-1)!.data.san}`),
    ]),
  ]);
};

const empty = (): VNode => {
  return h('div.bg-white.flex.py-10.rounded-b-md.shadow-md', [
    h('div', [
      h('h1.font-bold.text-lg', 'No moves'),
      h('h2.text-md', 'Try training a different repertoire or switching modes'),
    ]),
  ]);
};

const fail = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div#recall', [
    h('div.bg-white.flex.py-10.shadow-md', [
      h('div.w-12.mx-2', wrongI()),
      h('div', [
        h('h1.font-bold.text-lg', 'Incorrect'),
        h('h2.text-md', `${isWhite ? 'White' : 'Black'} plays ${ctrl.trainingPath.at(-1)!.data.san}`),
        h(
          'span#recall-fail.font-semibold.text-lg.uppercase.flex-1.text-center.rounded-bl-md.flex.flex-row.text-white.font-bold.py-1.px-4.rounded.flex.border-orange-700.bg-orange-400.active:transform.active:translate-y-px.active:border-b',
          // TODO don't fail until user clicks "continue"
          // we want to allow for scenarios where user gets wrong move and doesn't want to fail-
          // e.x. the user claims a misclick
          {
            on: {
              click: () => {
                ctrl.handleRecall();
              },
            },
          },
          'Continue',
        ),
      ]),
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
