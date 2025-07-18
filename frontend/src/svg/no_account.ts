import { h, VNode } from 'snabbdom';

export const noAccountI = (): VNode => {
  return h(
    'svg',
    {
      class: {
        lucide: true,
        'lucide-user-round-x-icon': true,
        'lucide-user-round-x': true,
      },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '30', // increased size
        height: '30', // increased size
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: '#ba0b14', // changed color to red
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    [
      h('path', { attrs: { d: 'M2 21a8 8 0 0 1 11.873-7' } }),
      h('circle', { attrs: { cx: '10', cy: '8', r: '5' } }),
      h('path', { attrs: { d: 'm17 17 5 5' } }),
      h('path', { attrs: { d: 'm22 17-5 5' } }),
    ],
  );
};
