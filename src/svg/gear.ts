import { VNode, h } from 'snabbdom';

export const gearI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-settings-2': true },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '24',
        height: '24',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: '#808080', // Changed to gray
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
    },
    [
      h('path', { attrs: { d: 'M20 7h-9' } }),
      h('path', { attrs: { d: 'M14 17H5' } }),
      h('circle', { attrs: { cx: '17', cy: '17', r: '3' } }),
      h('circle', { attrs: { cx: '7', cy: '7', r: '3' } }),
    ],
  );
};
