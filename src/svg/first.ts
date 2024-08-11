import { h } from "snabbdom";

export const firstI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-arrow-left-to-line': true },
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
      h('path', { attrs: { d: 'M3 19V5' } }),
      h('path', { attrs: { d: 'm13 6-6 6 6 6' } }),
      h('path', { attrs: { d: 'M7 12h14' } }),
    ],
  );
};
