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

  return h('div#sidebar.flex.flex-col.w-1/4', [
    h(
      'div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-md.rounded-t-2xl.border.border-gray-200.py-2',
      [
        h('span.text-blue-600.text-2xl.font-semibold.tracking-wide.p-4', 'My Repertoire'),
        h('div#repertoire-wrap', [
          h('span.font-semibold.text-sm.uppercase.px-4.text-gray-600.space', 'White'),
          repertoire(whiteEntries, ctrl, 0),
          h('span.font-semibold.text-sm.uppercase.px-4.text-gray-600', 'Black'),
          repertoire(blackEntries, ctrl, ctrl.numWhiteEntries),
        ]),
      ],
    ),
    h('div.flex.space-x-2.mt-4', [
      h(
        'button.flex.bg-blue-500.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.mx-auto.px-5.transition.duration-200.ease-in-out.hover:bg-blue-600.active:scale-95.shadow-md.hover:shadow-lg',
        { on: { click: () => ctrl.toggleAddingNewSubrep() } },
        [addI(), h('div', 'Add to Repertoire')],
      ),
      h(
        'button.flex.bg-blue-700.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.mx-auto.px-5.transition.duration-200.ease-in-out.hover:bg-blue-800.active:scale-95.shadow-md.hover:shadow-lg',
        { on: { click: () => ctrl.downloadRepertoire() } },
        [downloadI(), h('div', 'Download')],
      ),
    ]),
    h(
      'div.flex.flex-col.bg-white.bg-clip-border.text-gray-700.shadow-md.rounded-b-2xl.border.border-gray-200.p-4.mt-4.pb-5',
      [
        h('span.text-blue-600.text-2xl.font-semibold.tracking-wide', 'Scheduling'),

        // ${ctrl.repertoire[ctrl.repertoireIndex] && ctrl.repertoire[ctrl.repertoireIndex].lastDueCount}
        h('div#chart-wrap', [
          h('div.gap-2.items-center', { class: { flex: true, 'justify-left': true} }, [
            h(
              'span',
              {
                class: { 'text-sm': true, 'font-medium': true, 'dark:text-white': true },
              },
              `Memory progress`,
            ),
            h('span', '•'),
            h(
              'span',
              { class: { 'text-sm': true, 'font-medium': true } },
              `${ctrl.repertoire[ctrl.repertoireIndex] && ctrl.repertoire[ctrl.repertoireIndex].lastDueCount} moves due`,
            ),
          ]),
          chart(ctrl),
        ]),
        progress(ctrl),
      ],
    ),
  ]);
};
