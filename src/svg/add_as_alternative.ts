import { h } from 'snabbdom';

export const altI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-copy-plus': true },
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
      h('line', { attrs: { x1: '15', x2: '15', y1: '12', y2: '18' } }),
      h('line', { attrs: { x1: '12', x2: '18', y1: '15', y2: '15' } }),
      h('rect', { attrs: { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' } }),
      h('path', { attrs: { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' } }),
    ],
  );
};
