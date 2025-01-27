import { h, VNode } from 'snabbdom';
import PrepCtrl from '../ctrl';

export const progress = (ctrl: PrepCtrl): VNode => {
  let seenCount = 0;
  let totalCount = 1;
  if (ctrl.subrep()) {
    const meta = ctrl.subrep()?.meta;
    seenCount = meta.bucketEntries.reduce((a, b) => a + b, 0);
    totalCount = meta.nodeCount;
  }

    const percentage = Math.round((seenCount / totalCount) * 100);

    return h('div.items-center', {}, [
      // Label and percentage row
      h('div.gap-2.items-center', { class: { flex: true, 'justify-left': true, 'my-0': true } }, [
        h(
          'span',
          {
            class: { 'text-sm': true, 'font-medium': true, 'dark:text-white': true },
          },
          `Learning progress`,
        ),
        h('span', '•'),
        h(
          'span',
          { class: { 'text-sm': true, 'font-medium': true} },
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
      class: { 'h-2.5': true, 'rounded-full': true },
      style: {
        width: `${percentage}%`,
        background: 'linear-gradient(to left, #3b82f6, #60a5fa)', // Gradient color
      },
    }),
  ],
)

    ]);
  };
