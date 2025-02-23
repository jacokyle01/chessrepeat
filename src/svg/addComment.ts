import { h, VNode } from 'snabbdom';

export const addCommentI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-message-square-plus': true },
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
      h('path', { attrs: { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' } }),
      h('path', { attrs: { d: 'M12 7v6' } }),
      h('path', { attrs: { d: 'M9 10h6' } }),
    ],
  );
};
