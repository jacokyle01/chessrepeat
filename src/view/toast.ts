import PrepCtrl from '../ctrl';
import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';

const recall = (ctrl: PrepCtrl): VNode => {
  const isWhite = ctrl.subrep().meta.trainAs === 'white';
  return h('div.bg-white.flex.py-10.rounded-b-md.shadow-md', [
    h('div.w-12.mx-2', isWhite ? whiteKingI() : blackKingI()),
    h('div', [
      h('h1.font-bold.text-lg', 'Your move'),
      h('h2.text-md', `What does ${isWhite ? 'White' : 'Black'} play here?`),
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

export const toast = (ctrl: PrepCtrl): VNode | null => {
  switch (ctrl.lastFeedback) {
    case 'recall':
      return recall(ctrl);
    case 'learn':
      return learn(ctrl);
    case 'empty':
      return empty();
    case 'fail':
      return fail();
    default:
      return h('div', 'Other');
  }
};
