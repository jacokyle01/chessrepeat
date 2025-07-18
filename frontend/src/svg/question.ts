import { h } from 'snabbdom';

export const questionI = () => {
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
      h('circle', { attrs: { cx: '12', cy: '12', r: '10', stroke: 'currentColor', 'stroke-width': '1.5' } }),
      h('path', {
        attrs: {
          d: 'M10 9C10 7.89543 10.8954 7 12 7C13.1046 7 14 7.89543 14 9C14 9.39815 13.8837 9.76913 13.6831 10.0808C13.0854 11.0097 12 11.8954 12 13V13.5',
          stroke: 'currentColor',
          'stroke-width': '1.5',
          'stroke-linecap': 'round',
        },
      }),
      h('path', {
        attrs: {
          d: 'M11.992 17H12.001',
          stroke: 'currentColor',
          'stroke-width': '2',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        },
      }),
    ],
  );
};
