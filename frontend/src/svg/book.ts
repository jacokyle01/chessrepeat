import { h } from 'snabbdom';
export const bookI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-lightbulb': true },
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
      h('path', {
        attrs: {
          d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
        },
      }),
      h('path', { attrs: { d: 'M9 18h6' } }),
      h('path', { attrs: { d: 'M10 22h4' } }),
    ],
  );
};
