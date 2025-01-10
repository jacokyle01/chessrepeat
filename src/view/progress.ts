import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { bookCheckI } from '../svg/bookCheck';
import { bookOutlineI } from '../svg/bookOutline';

export const progress = (ctrl: PrepCtrl): VNode => {
  let unseenCount = 0;
  if (ctrl.subrep()) {
    const meta = ctrl.subrep()?.meta;
    unseenCount = meta.nodeCount - meta.bucketEntries.reduce((a, b) => a + b, 0);
  }
  const seenCount = ctrl.repertoire[ctrl.repertoireIndex]?.lastDueCount || 0;

  const totalCount = unseenCount + seenCount;
  // Calculate widths for seen and unseen sections
  const seenWidth = (seenCount / totalCount) * 100;
  const unseenWidth = (unseenCount / totalCount) * 100;

  // Return the progress bar element
  return h('div.progress-container', { style: { display: 'flex', alignItems: 'center' } }, [
    h(
      'div.progress-bar',
      {
        style: {
          display: 'flex',
          width: '100%',
          border: '1px solid #ccc',
          borderRadius: '5px',
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
        },
        attrs: {
          title: `Seen: ${seenCount}, Unseen: ${unseenCount}`,
        },
      },
      [
        h(
          'div.seen-section.relative.bg-gradient-to-r.from-orange-500.to-orange-600.text-white.font-mono.font-bold.flex',
          {
            style: {
              width: `${seenWidth}%`,
              textAlign: 'center',
            },
          },
          [h('span', seenCount.toString()), bookCheckI()],
        ),
        h(
          'div.unseen-section.relative.bg-gradient-to-l.from-blue-400.to-blue-500.text-white.font-mono.font-bold.flex',
          {
            // class: 'relative bg-gradient-to-l from-orange-400 to-orange-600 text-black',
            style: {
              width: `${unseenWidth}%`,
              textAlign: 'center',
            },
          },
          [h('span', unseenCount.toString()), bookOutlineI()],
        ),
      ],
    ),
  ]);
};
