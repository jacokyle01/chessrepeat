import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { repertoire } from './repertoire';
import { addI } from '../svg/add';
import { chart } from './chart';
import { downloadI } from '../svg/download';
import { progress } from './progress';

export const sidebar = (ctrl: PrepCtrl): VNode => {
  const whiteEntries: RepertoireEntry[] = ctrl.repertoire.slice(0, ctrl.numWhiteEntries);
  const blackEntries: RepertoireEntry[] = ctrl.repertoire.slice(ctrl.numWhiteEntries);

  return h('div#sidebar.flex.flex-col.flex-1.h-lvh', [
    h(
      'div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-md.rounded-md.border.border-gray-200.pb-2.h-2/5.overflow-y-auto',
      [
        h('span.text-xl.font-bold.py-2.pl-2.border-b-2.mb-2.border-gray-300', 'My Repertoire'),
        h('div#repertoire-wrap', [
          h('span.font-semibold.text-sm.uppercase.px-2.text-gray-600.space', 'White'),
          repertoire(whiteEntries, ctrl, 0),
          h('span.font-semibold.text-sm.uppercase.px-2.text-gray-600', 'Black'),
          repertoire(blackEntries, ctrl, ctrl.numWhiteEntries),
        ]),
        h('div#repertoire-actions.mt-auto.flex.mt-4', [
          h(
            'button.flex.bg-blue-500.text-white.font-bold.rounded.p-2.gap-1.mx-auto.px-5.transition.duration-200.ease-in-out.hover:bg-blue-600.active:scale-95.shadow-md.hover:shadow-lg',
            { on: { click: () => ctrl.toggleAddingNewSubrep() } },
            [h('div', 'Add to Repertoire'), addI()],
          ),
          h(
            'button.flex.bg-blue-700.text-white.font-bold.rounded.p-2.gap-1.mx-auto.px-5.transition.duration-200.ease-in-out.hover:bg-blue-800.active:scale-95.shadow-md.hover:shadow-lg',
            { on: { click: () => ctrl.downloadRepertoire() } },
            [h('div', 'Download'), downloadI()],
          ),
        ]),
      ],
    ),

    h(
      'div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-md.rounded-md.border.border-gray-200.mt-4.pb-5',
      [
        h('span.text-xl.font-bold.py-2.pl-2.border-b-2.mb-2.border-gray-300', 'Memory Schedule'),
        h('span.font-semibold.text-gray-600.px-1', 'Due at'),
        h('div#chart-wrap.px-1', [
          // h('div.gap-2.items-center', { class: { flex: true, 'justify-left': true } }, [
          // ]),
          chart(ctrl),
        ]),
        // progress(ctrl),
      ],
    ),
  ]);
};
