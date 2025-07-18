import { h } from 'snabbdom';

export const lastI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-chevron-last': true },
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
        transform: 'scale(1.5)'
      },
    },
    [h('path', { attrs: { d: 'm7 18 6-6-6-6' } }), h('path', { attrs: { d: 'M17 6v12' } })],
  );
};
