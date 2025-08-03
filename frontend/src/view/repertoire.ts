import { VNode } from 'snabbdom';
import { looseH as h } from '../types/snabbdom';

import PrepCtrl from '../ctrl';
import { RepertoireEntry } from '../types/types';
import { smallGear } from '../svg/smallGear';
import { renameI } from '../svg/rename';
import { trashI } from '../svg/trash';
import { seenI } from '../svg/seen';
import { editI } from '../svg/edit';

const dropdownMenu = (ctrl: PrepCtrl, thisIndex: number, startsAt: number) =>
  h(
    'div.dropdown-menu.bg-white.z-10.shadow-md.rounded-md.border.border-gray-200.flex.flex-row',
    { class: { hidden: !(ctrl.subrepSettingsIndex === thisIndex + startsAt) } },
    [
      h(
        'div.option.flex.items-center.gap-2.px-3.cursor-pointer.rounded-md.hover:bg-gray-100',
        {
          on: {
            click: () => {
              console.log('Delete clicked');
              console.log(thisIndex + startsAt);
              ctrl.deleteChapter(thisIndex + startsAt);
              ctrl.subrepSettingsIndex = -1;
              ctrl.redraw();
            },
          },
        },
        [trashI(), h('span.text-sm', 'Delete')],
      ),
      h(
        'div.option.flex.items-center.gap-2.px-3.py-2.cursor-pointer.rounded-md.hover:bg-gray-100',
        {
          on: {
            click: () => {
              console.log('Rename clicked');
              const newName = prompt('Enter new name') || '';
              ctrl.repertoire[thisIndex + startsAt].name = newName;
              ctrl.redraw();
            },
          },
        },
        [renameI(), h('span.text-sm', 'Rename')],
      ),
      h(
        'div.option.flex.items-center.gap-2.px-3.py-2.cursor-pointer.rounded-md.hover:bg-gray-100',
        {
          on: {
            click: () => {
              console.log('Seen clicked');
              ctrl.toggleEditingSubrep();
              ctrl.redraw();
            },
          },
        },
        [seenI(), h('span.text-sm', 'All seen')],
      ),
      h(
        'div.option.flex.items-center.gap-2.px-3.py-2.cursor-pointer.rounded-md.hover:bg-gray-100',
        {
          on: {
            click: () => {
              ctrl.toggleEditingSubrep();
              ctrl.redraw();
            },
          },
        },
        [editI(), h('span.text-sm', 'Edit PGN')],
      ),
    ],
  );

export const repertoire = (repertoire: RepertoireEntry[], ctrl: PrepCtrl, startsAt: number): VNode => {
  // console.log(repertoire.length);
  return h('div#chapter-tree-wrap.flex-row.rounded-md', [
    ...repertoire.map(
      (
        entry,
        index, //TODO include graph of progress
      ) => {
        // console.log("subreperoire index", index);
        // console.log("reperoire length", repertoire.length);
        const meta = entry.chapter;
        const unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
        const name = entry.name;

        return h(
          'div#chapter-wrap',
          {
            on: {
              click: () => ctrl.selectChapter(index + startsAt),
            },
            class: {
              'bg-cyan-50': ctrl.repertoireIndex == index + startsAt,
            },
          },
          [
            h('div.chapter.flex.items-center.justify-around.hover:bg-cyan-50.pl-4.py-0.5', [
              h('span.font-bold.pr-3.text-blue-600', (index + startsAt + 1).toString()),
              h('h3.text-lg.font-light.flex-1.gap-2.flex.items-end', [
                h('span.text-md', name),
                h('span.text-xs.font-bold.font-mono.mb-1', '' + meta.nodeCount),
              ]),
              unseenCount > 0 &&
                h(
                  'button.text-sm.font-medium.text-blue-700.bg-blue-500/20.rounded-full.px-2.font-black',
                  `Learn ${unseenCount}`,
                ),
              entry.lastDueCount > 0 &&
                h(
                  'button.text-sm.font-medium.text-orange-700.bg-orange-500/20.rounded-full.px-2.font-black',
                  `Recall ${entry.lastDueCount}`,
                ),
              h('div#subrep-settings.ml-auto', [
                h(
                  'div.cursor-pointer.transition-all.hover:bg-gray-300.active:scale-90.rounded-md',
                  {
                    on: {
                      click: () => {
                        if (ctrl.subrepSettingsIndex == index + startsAt) {
                          ctrl.subrepSettingsIndex = -1;
                        } else {
                          ctrl.subrepSettingsIndex = index + startsAt;
                        }
                        ctrl.redraw();
                      },
                    },
                    class: {
                      'bg-gray-300': ctrl.subrepSettingsIndex == index + startsAt,
                    },
                  },

                  [smallGear()],
                ),
              ]),
            ]),
            dropdownMenu(ctrl, index, startsAt),
          ],
        );
      },
    ),
  ]);
};
