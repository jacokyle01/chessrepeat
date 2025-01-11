import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';
import { bookCheckI } from '../svg/bookCheck';
import { bookOutlineI } from '../svg/bookOutline';

export const progress = (ctrl: PrepCtrl): VNode => {
  let seenCount = 0;
  let totalCount = 1;
  if (ctrl.subrep()) {
    const meta = ctrl.subrep()?.meta;
    seenCount = meta.bucketEntries.reduce((a, b) => a + b, 0);
    totalCount = meta.nodeCount;
  }
  // const seenCount = ctrl.repertoire[ctrl.repertoireIndex]?.lastDueCount || 0;

  // Calculate widths for seen and unseen sections
  // const seenWidth = (seenCount / totalCount) * 100;
  // const unseenWidth = (unseenCount / totalCount) * 100;

    console.log("seen count", seenCount);
    // console.log("total count", totalCount);
    const percentage = Math.round((seenCount / totalCount) * 100);

    return h('div', {}, [
      // Label and percentage row
      h('div', { class: { flex: true, 'justify-between': true, 'my-1': true } }, [
        h(
          'span',
          {
            class: { 'text-base': true, 'font-medium': true, 'text-blue-700': true, 'dark:text-white': true },
          },
          "Learning progress",
        ),
        h(
          'span',
          { class: { 'text-sm': true, 'font-medium': true, 'text-blue-700': true, 'dark:text-white': true } },
          `${percentage}% seen`,
        ),
      ]),

      // Progress bar container
      h(
        'div',
        {
          class: {
            'w-full': true,
            'bg-gray-200': true,
            'rounded-full': true,
            'h-2.5': true,
            'dark:bg-gray-700': true,
          },
        },
        [
          // Progress fill
          h('div', {
            class: { 'bg-blue-600': true, 'h-2.5': true, 'rounded-full': true },
            style: { width: `${percentage}%` },
          }),
        ],
      ),
    ]);
  };

  // Return the progress bar element
  // return h('div.progress-container', { style: { display: 'flex', alignItems: 'center' } }, [
  //   h(
  //     'div.progress-bar',
  //     {
  //       style: {
  //         display: 'flex',
  //         width: '100%',
  //         border: '1px solid #ccc',
  //         borderRadius: '5px',
  //         overflow: 'hidden',
  //         cursor: 'pointer',
  //         position: 'relative',
  //       },
  //       attrs: {
  //         title: `Seen: ${seenCount}, Unseen: ${unseenCount}`,
  //       },
  //     },
  //     [
  //       h(
  //         'div.seen-section.relative.bg-gradient-to-r.from-orange-500.to-orange-600.text-white.font-mono.font-bold.flex',
  //         {
  //           style: {
  //             width: `${seenWidth}%`,
  //             textAlign: 'center',
  //           },
  //         },
  //         [h('span', seenCount.toString()), bookCheckI()],
  //       ),
  //       h(
  //         'div.unseen-section.relative.bg-gradient-to-l.from-blue-400.to-blue-500.text-white.font-mono.font-bold.flex',
  //         {
  //           // class: 'relative bg-gradient-to-l from-orange-400 to-orange-600 text-black',
  //           style: {
  //             width: `${unseenWidth}%`,
  //             textAlign: 'center',
  //           },
  //         },
  //         [h('span', unseenCount.toString()), bookOutlineI()],
  //       ),
  //     ],
  //   ),
  // ]);

