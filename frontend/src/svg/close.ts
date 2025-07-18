import { VNode, h } from 'snabbdom';
export const closeI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-circle-x': true },
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
      h('circle', { attrs: { cx: '12', cy: '12', r: '10' } }),
      h('path', { attrs: { d: 'm15 9-6 6' } }),
      h('path', { attrs: { d: 'm9 9 6 6' } }),
    ],
  );
};
