import PrepCtrl from '../ctrl';
import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';
import { whiteKingI } from '../svg/white_king';
import { blackKingI } from '../svg/black_king';

const recall = (ctrl: PrepCtrl): VNode => {
  return h('div.bg-white.flex.py-4.border-t-2.border-gray-500.rounded-b-md', [
    h('div.w-12.mx-2', ctrl.subrep().meta.trainAs === 'white' ? whiteKingI() : blackKingI()),
    h('div', [h('h1.font-bold', 'Your move'), h('h2', `What does ${ctrl.subrep().meta.trainAs} play here?`)]),
  ]);
};

const learn = (ctrl: PrepCtrl): VNode => {
  return h('div.bg-white.flex.py-4.border-t-2.border-gray-500.rounded-b-md', [
    h('div.w-12.mx-2', ctrl.subrep().meta.trainAs === 'white' ? whiteKingI() : blackKingI()),
    h('div', [
      h('h1.font-bold', 'Your move'),
      h('h2', `${ctrl.subrep().meta.trainAs} plays ${ctrl.chessSrs.path()!.at(-1)!.data.san}`),
    ]),
  ]);
};

const empty = (): VNode => {
  return h('div.bg-white.flex.py-4.border-t-2.border-gray-500.rounded-b-md', [
    h('div', [
      h('h1.font-bold', 'No moves'),
      h('h2', 'Try training a different repertoire or switching modes'),
    ]),
  ]);
};

const fail = (ctrl: PrepCtrl): VNode => {
  return h('div.bg-white.flex.py-4.border-t-2.border-gray-500.rounded-b-md', [
    h('div.w-12.mx-2', ctrl.subrep().meta.trainAs === 'white' ? whiteKingI() : blackKingI()),
    h('div', [
      h('h1.font-bold', 'Incorrect'),
      h('h2', `${ctrl.lastGuess} is wrong. ${ctrl.chessSrs.path()!.at(-1)!.data.san} was the move.`),
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
