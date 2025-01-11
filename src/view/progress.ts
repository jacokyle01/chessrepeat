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
