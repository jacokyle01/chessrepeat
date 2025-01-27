import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';

import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';

export const repertoire = (repertoire: RepertoireEntry[], ctrl: PrepCtrl, startsAt: number): VNode => {
  // console.log(repertoire.length);
  return h('div#subrepertoire-tree-wrap.flex-row.rounded-md', [
    ...repertoire.map(
      (
        entry,
        index, //TODO include graph of progress
      ) => {
        const meta = entry.subrep.meta;
        const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
        const name = entry.name;

        return h(
          'div.subrepertoire.flex.items-center.justify-around.hover:bg-cyan-50.px-4.py-0.5',
          {
            on: {
              click: () => ctrl.selectSubrepertoire(index + startsAt),
            },
            class: {
              'bg-cyan-50': ctrl.repertoireIndex == index + startsAt,
            },
          },
          [
            h('span.font-bold.pr-3', (index + startsAt + 1).toString()),
            h('h3.text-lg.font-light.flex-1.gap-2.flex.items-end', [
              h('span.text-md', name),
              h('span.text-xs.font-bold.font-mono.mb-1', ""+meta.nodeCount)
            ]),
            unseenCount > 0 &&
              h(
                'button.text-sm.font-medium.text-blue-700.px-1.5.bg-blue-500/20.rounded-full.px-2',
                `Learn ${unseenCount}`,
              ),
            entry.lastDueCount > 0 &&
              h(
                'button.text-sm.font-medium.text-orange-700.px-1.5.bg-orange-500/20.rounded-full.px-2',
                `Recall ${entry.lastDueCount}`,
              ),
          ],
        );
      },
    ),
  ]);
};
