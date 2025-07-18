import { h, VNode } from 'snabbdom';

export const seenI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-glasses': true },
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
      h('circle', { attrs: { cx: '6', cy: '15', r: '4' } }),
      h('circle', { attrs: { cx: '18', cy: '15', r: '4' } }),
      h('path', { attrs: { d: 'M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2' } }),
      h('path', { attrs: { d: 'M2.5 13 5 7c.7-1.3 1.4-2 3-2' } }),
      h('path', { attrs: { d: 'M21.5 13 19 7c-.7-1.3-1.5-2-3-2' } }),
    ],
  );
};
