import { VNode, h } from 'snabbdom';
import PrepCtrl from './ctrl';
import { chessground } from './chessground';

const start = (ctrl: PrepCtrl) => {
  return h('div#control-wrap', [
    h('button#learn', { on: { click: () => ctrl.handleLearn() } }, 'learn'),
    h('button#recall', { on: { click: () => ctrl.handleRecall() } }, 'recall'),
  ]);
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
          console.log(pgn);
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

const status = (ctrl: PrepCtrl): VNode => {
  return h('div#status', [
    h(
      'div',
      {
        class: {
          selected: ctrl.chessSrs.state().method == 'learn',
        },
      },
      'Learn',
    ),
    h(
      'div',
      {
        class: {
          selected: ctrl.chessSrs.state().method == 'recall',
        },
      },
      'Recall',
    ),
  ]);
};

//mostly for debugging, but something similiar should get implemented (with a markedly better UI)
const rightWrap = (ctrl: PrepCtrl): VNode => {
  return h('h1#right-wrap', [
    h('h2', 'PGN tree'),
    // h('div', ctrl.chessSrs.state().repertoire),
    h('h2', 'Path'),
    h('div', ctrl.chess.pgn()),
    h('h2', 'FEN'),
    h('div', ctrl.getFen()),
  ]);
};

const view = (ctrl: PrepCtrl): VNode => {
  return h('div#root', [
    h('div#left-wrap', [subrepertoireTree(ctrl), addSubrepertoire(ctrl)]),
    h('div#main-wrap', [chessground(ctrl), status(ctrl), start(ctrl)]),
    rightWrap(ctrl),
  ]);
};
export default view;
