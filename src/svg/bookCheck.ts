import { h, VNode } from 'snabbdom';

export const bookCheckI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-book-check': true },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24', // Corrected 'viewbox' to 'viewBox'
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      style: {
        transform: 'scale(0.8)', // Scales the SVG down to 80% of its original size
        transformOrigin: 'center', // Ensures scaling happens from the center
        width: '24px', // Optional: keeps consistent width
        height: '24px', // Optional: keeps consistent height
      },
    },
    [
      h('path', {
        attrs: {
          d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20',
        },
      }),
      h('path', { attrs: { d: 'm9 9.5 2 2 4-4' } }),
    ],
  );
};
