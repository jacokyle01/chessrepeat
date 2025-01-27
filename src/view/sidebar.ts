import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { repertoire } from './repertoire';
import { addI } from '../svg/add';
import { chart } from './chart';
import { downloadI } from '../svg/download';

export const sidebar = (ctrl: PrepCtrl): VNode => {
  const whiteEntries: RepertoireEntry[] = ctrl.repertoire.slice(0, ctrl.numWhiteEntries);
  const blackEntries: RepertoireEntry[] = ctrl.repertoire.slice(ctrl.numWhiteEntries);

  return h('div#sidebar.flex.flex-col.w-1/4', [
    h(
      'div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-sm.rounded-t-xl.border.border-blue-gray-100',
      [
        h('span.text-gray-700.text-2xl.font-semibold.m-3', 'My Repertoire'),
        h('div#repertoire-wrap', [
          h('span.font-semibold.text-sm.uppercase.px-4', 'White'),
          repertoire(whiteEntries, ctrl, 0),
          h('span.font-semibold.text-sm.uppercase.px-4', 'Black'),
          repertoire(blackEntries, ctrl, ctrl.numWhiteEntries),
        ]),
      ],
    ),
    h('div.flex', [
      h(
        'button.flex.bg-blue-500.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.mx-auto.my-3.px-5',
        { on: { click: () => ctrl.toggleAddingNewSubrep() } },
        [addI(), h('div', 'Add to Repertoire')],
      ),
      h(
        'button.flex.bg-blue-700.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.mx-auto.my-3.px-5',
        { on: { click: () => ctrl.downloadRepertoire() } },
        [downloadI(), h('div', 'Download')],
      ),
    ]),

    h(
      'div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-sm.rounded-xl.border.border-blue-gray-100',
      [
        h('span.text-gray-700.text-2xl.font-semibold.m-3', 'Scheduling'),
        h('div#repertoire-wrap.m-2', [chart(ctrl)]),
      ],
    ),
  ]);
};
