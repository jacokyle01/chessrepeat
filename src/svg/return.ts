import { h } from 'snabbdom';

export const returnI = () => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-arrow-big-left': true },
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
    [h('path', { attrs: { d: 'M18 15h-6v4l-7-7 7-7v4h6v6z' } })],
  );
};
