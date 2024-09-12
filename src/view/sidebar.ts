import { h, VNode } from 'snabbdom';
import { kingI } from '../svg/king';
import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { repertoire } from './repertoire';
import { addI } from '../svg/add';
import { chart } from './chart';
import { chartI } from '../svg/chart';

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

  let unseenCount;
  if (!ctrl.subrep()) {
    unseenCount = 0;
  } else {
    const meta = ctrl.subrep()?.meta;
    unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
  }
  return h('div#sidebar.flex.flex-col', [
    h('div.flex.max-w-[20rem].flex-col.bg-white.bg-clip-border.text-gray-700.shadow-xl.rounded-t-lg', [
      h('div.flex.flex-row.gap-1.m-2', [
        kingI(),
        h('span.font-medium.text-lg.text-gray-700', 'Repertoire')
      ]),
      h('div#repertoire-wrap.m-2', [
        h('span.font-semibold.text-sm.uppercase', 'White'),
        repertoire(whiteEntries, ctrl, 0),

        h('span.font-semibold.text-sm.uppercase', 'Black'),
        repertoire(blackEntries, ctrl, numWhiteEntries),
      ]),
    ]),
    h(
      'button.flex.bg-blue-500.text-white.font-semibold.rounded-md.p-2.rounded-tl-lg.gap-1.mx-auto.my-3.px-5',
      { on: { click: () => ctrl.toggleAddingNewSubrep() } },
      [addI(), h('div', 'Add to Repertoire')],
    ),

    h('div.flex.max-w-[20rem].flex-col.bg-white.bg-clip-border.text-gray-700.shadow-xl.rounded-b-lg', [
      h('div#repertoire-wrap.m-2', [
        h('div.flex.flex-row.gap-1', [chartI(), h('span.font-medium.text-lg.text-gray-700', 'Scheduling')]),
        h('div.block.antialiased.font-sans.font-small.text-sm.uppercase.text-gray-400', `${unseenCount} unseen`),
        chart(ctrl),
      ]),
    ]),
  ]);
};
