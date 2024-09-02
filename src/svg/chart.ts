import { h, VNode } from 'snabbdom';

export const chartI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-chart-pie': true },
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
          d: 'M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z',
        },
      }),
      h('path', { attrs: { d: 'M21.21 15.89A10 10 0 1 1 8 2.83' } }),
    ],
  );
};
