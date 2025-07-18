import { h } from 'snabbdom';

export const backI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-skip-forward': true },
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
        transform: 'rotate(180), scale(1.3)'

      },
    },
    [
      h('polygon', { attrs: { points: '5 4 15 12 5 20 5 4' } }),
      h('line', { attrs: { x1: '19', x2: '19', y1: '5', y2: '19' } }),
    ],
  );
};
