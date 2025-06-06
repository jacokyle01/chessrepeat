import { h } from "snabbdom";

export const continueI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-arrow-big-right-dash': true },
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
    [h('path', { attrs: { d: 'M5 9v6' } }), h('path', { attrs: { d: 'M9 9h3V5l7 7-7 7v-4H9V9z' } })],
  );
};
