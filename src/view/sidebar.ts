import { h, VNode } from 'snabbdom';
import { kingI } from '../svg/king';
import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { repertoire } from './repertoire';
import { addI } from '../svg/add';
import { chart } from './chart';

export const sidebar = (ctrl: PrepCtrl): VNode => {
  let numWhiteEntries = 0;
  const whiteEntries: RepertoireEntry[] = [];
  const blackEntries: RepertoireEntry[] = [];

  ctrl.repertoire.forEach((entry) => {
    if (entry.subrep.meta.trainAs === 'white') {
      whiteEntries.push(entry);
      numWhiteEntries++;
    } else {
      blackEntries.push(entry);
    }
  });

  return h(
    'div',
    {
      class: {
        relative: true,
        flex: true,
        'h-full': true,
        'w-full': true,
        'max-w-[20rem]': true,
        'flex-col': true,
        'rounded-xl': true,
        'bg-white': true,
        'bg-clip-border': true,
        'text-gray-700': true,
        'shadow-xl': true,
        'shadow-blue-gray-900/5': true,
      },
    },
    [
      h('div#repertoire-wrap.m-2', [
        h('div.flex.flex-row.gap-1.items-center.text-center.justify-center', [
          kingI(),
          h('span.font-medium.text-lg.text-gray-700', 'Repertoire'),
        ]),
        h('span.font-semibold.text-sm.uppercase.text-gray-400', 'White'),
        repertoire(whiteEntries, ctrl, 0),

        h('span.font-semibold.text-sm.uppercase.text-gray-400', 'Black'),
        repertoire(blackEntries, ctrl, numWhiteEntries),

        h(
          'button.flex.bg-blue-500.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.text-center.justify-center.mx-auto.px-5',
          { on: { click: () => ctrl.toggleAddingNewSubrep() } },
          [addI(), h('div', 'Add to Repertoire')],
        ),
      ]),
      h('hr.border-t-2.border-gray-300.my-3'),
      h('div#repertoire-wrap.m-2', [
        h('span.font-medium.text-lg.text-gray-700.text-center.justify-center.flex', 'Scheduling'),
        chart(ctrl)
      ]),
    ],
  );
};
