import { h } from 'snabbdom';

export const recallI = () => {
  return h(
    'svg',
    {
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        viewbox: '0 0 24 24',
        width: '24',
        height: '24',
        color: '#FFFFFF',
        fill: 'none',
      },
    },
    [
      h('path', {
        attrs: {
          d: 'M20.5 5.5H9.5C5.78672 5.5 3 8.18503 3 12',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      }),
      h('path', {
        attrs: {
          d: 'M3.5 18.5H14.5C18.2133 18.5 21 15.815 21 12',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      }),
      h('path', {
        attrs: {
          d: 'M18.5 3C18.5 3 21 4.84122 21 5.50002C21 6.15882 18.5 8 18.5 8',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      }),
      h('path', {
        attrs: {
          d: 'M5.49998 16C5.49998 16 3.00001 17.8412 3 18.5C2.99999 19.1588 5.5 21 5.5 21',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      }),
    ],
  );
};
