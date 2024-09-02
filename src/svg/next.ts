import { h } from 'snabbdom';

export const nextI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-arrow-right': true },
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
    [h('path', { attrs: { d: 'M5 12h14' } }), h('path', { attrs: { d: 'm12 5 7 7-7 7' } })],
  );
};
