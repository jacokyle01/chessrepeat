import { h } from "snabbdom";

export const nextI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-arrow-right': true },
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
    [h('path', { attrs: { d: 'M5 12h14' } }), h('path', { attrs: { d: 'm12 5 7 7-7 7' } })],
  );
};
