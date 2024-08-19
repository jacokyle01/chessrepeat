import { VNode, h } from 'snabbdom';

export const addI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-diamond-plus': true },
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
      h('path', { attrs: { d: 'M12 8v8' } }),
      h('path', {
        attrs: {
          d: 'M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z',
        },
      }),
      h('path', { attrs: { d: 'M8 12h8' } }),
    ],
  );
};
