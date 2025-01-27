import { h, VNode } from 'snabbdom';

export const downloadI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-book-down': true },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '24',
        height: '24',
        viewbox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    [
      h('path', { attrs: { d: 'M12 13V7' } }),
      h('path', {
        attrs: {
          d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20',
        },
      }),
      h('path', { attrs: { d: 'm9 10 3 3 3-3' } }),
    ],
  );
};
