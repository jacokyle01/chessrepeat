import { VNode, h } from 'snabbdom';
import PrepCtrl from './ctrl';
import { chessground } from './chessground';

const next = (ctrl: PrepCtrl) => {
  return h('button#next', { on: { click: () => ctrl.handleNext() } }, 'Next');
};

const addSubrepertoire = (ctrl: PrepCtrl): VNode => {
  return h('div#add-subrepertoire-wrap', [
    h('h2', 'add subrepertoire'),
    h(
      'textarea#pgnInput',
      '1. e4 e5 2. f4 exf4 (2... d5) 3. Nf3 (3. Bc4 Qh4+ (3... d5) 4. Kf1) (3. d4 Qh4+ 4. Ke2) 3... d6 { test } (3... g5)',
    ),
    h('h2', 'choose name'),
    h('textarea#nameInput', 'test'),
    h('button', {
      on: {
        click: () => {
          const pgn = document.getElementById('pgnInput')! as HTMLTextAreaElement;
          const name = document.getElementById('nameInput')! as HTMLTextAreaElement;
          ctrl.addSubrepertoire(pgn.value, name.value);
        },
      },
    }),
  ]);
};

const subrepertoireTree = (ctrl: PrepCtrl): VNode => {
  return h(
    'div#subrepertoire-tree-wrap',
    ctrl.subrepertoireNames.map((name, index) =>
      h(
        'div',
        {
          on: {
            click: () => ctrl.selectSubrepertoire(index),
          },
          class: {
            selected: ctrl.chessSrs.state().index == index,
          },
        },
        name,
      ),
    ),
  );
};

const view = (ctrl: PrepCtrl): VNode => {
  return h('div#main', [
    h('div', chessground(ctrl)),
    addSubrepertoire(ctrl),
    subrepertoireTree(ctrl),
    next(ctrl),
  ]);
};
export default view;
