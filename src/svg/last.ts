import { h } from 'snabbdom';

export const lastI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-arrow-right-to-line': true },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '36', // Doubled width
        height: '36', // Doubled height
        viewBox: '0 0 24 24', // Keep the viewBox the same
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    [
      h('path', { attrs: { d: 'M17 12H3' } }),
      h('path', { attrs: { d: 'm11 18 6-6-6-6' } }),
      h('path', { attrs: { d: 'M21 5v14' } }),
    ],
  );
};
