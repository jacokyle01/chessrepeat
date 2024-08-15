import { h } from 'snabbdom';

export const blackKingI = () => {
  return h('svg', { attrs: { xmlns: 'http://www.w3.org/2000/svg', viewbox: '0 0 45 45' } }, [
    h(
      'g',
      {
        attrs: {
          fill: 'none',
          'fill-rule': 'evenodd',
          stroke: '#000',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-width': '1.5',
        },
      },
      [
        h('path', { attrs: { 'stroke-linejoin': 'miter', d: 'M22.5 11.6V6' } }),
        h('path', {
          attrs: {
            fill: '#000',
            'stroke-linecap': 'butt',
            'stroke-linejoin': 'miter',
            d: 'M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5',
          },
        }),
        h('path', {
          attrs: {
            fill: '#000',
            d: 'M11.5 37a22.3 22.3 0 0 0 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z',
          },
        }),
        h('path', { attrs: { 'stroke-linejoin': 'miter', d: 'M20 8h5' } }),
        h('path', {
          attrs: {
            stroke: '#ececec',
            d: 'M32 29.5s8.5-4 6-9.7C34.1 14 25 18 22.5 24.6v2.1-2.1C20 18 9.9 14 7 19.9c-2.5 5.6 4.8 9 4.8 9',
          },
        }),
        h('path', {
          attrs: {
            stroke: '#ececec',
            d: 'M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0',
          },
        }),
      ],
    ),
  ]);
};
