import { h } from 'snabbdom';
import PrepCtrl from '../ctrl';
export const crossI = (ctrl: PrepCtrl) => {
  console.log(ctrl);
  return h(
    'svg',
    {
      attrs: {
        viewbox: '0 0 24 24',
        fill: 'none',
        width: '24',
        height: '24',
        color: '#FFFFFF',
        xmlns: 'http://www.w3.org/2000/svg',
      },
    },
    [
      h('path', {
        attrs: {
          d: 'M16 8L8 16M8.00001 8L16 16M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z',
          stroke: '#FFFFFF',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      }),
    ],
  );
};
