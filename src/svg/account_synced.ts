import { h, VNode } from 'snabbdom';

export const accountSyncedI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-user-round-check-icon': true, 'lucide-user-round-check': true },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '30',
        height: '30',
        viewbox: '0 0 24 24',
        fill: 'none',
        stroke: 'green',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    [
      h('path', { attrs: { d: 'M2 21a8 8 0 0 1 13.292-6' } }),
      h('circle', { attrs: { cx: '10', cy: '8', r: '5' } }),
      h('path', { attrs: { d: 'm16 19 2 2 4-4' } }),
    ],
  );
};
