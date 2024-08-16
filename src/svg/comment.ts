import { h, VNode } from 'snabbdom';

export const commentI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-message-circle': true },
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
    [h('path', { attrs: { d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' } })],
  );
};
