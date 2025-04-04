import { h, VNode } from 'snabbdom';

export const editI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-file-pen-line-icon': true, 'lucide-file-pen-line': true },
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
          d: 'm18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2',
        },
      }),
      h('path', {
        attrs: {
          d: 'M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z',
        },
      }),
      h('path', { attrs: { d: 'M8 18h1' } }),
    ],
  );
};
