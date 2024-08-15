import { h } from 'snabbdom';

export const recallI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-repeat-2': true },
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
      h('path', { attrs: { d: 'm2 9 3-3 3 3' } }),
      h('path', { attrs: { d: 'M13 18H7a2 2 0 0 1-2-2V6' } }),
      h('path', { attrs: { d: 'm22 15-3 3-3-3' } }),
      h('path', { attrs: { d: 'M11 6h6a2 2 0 0 1 2 2v10' } }),
    ],
  );
};
