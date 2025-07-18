import { h, VNode } from 'snabbdom';

export const bookOutlineI = (): VNode => {
  return h(
    'svg',
    {
      class: { lucide: true, 'lucide-book-dashed': true },
      attrs: {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24', // Corrected 'viewbox' to 'viewBox' (case-sensitive)
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      style: {
        transform: 'scale(0.8)', // Scales the SVG by 80%
        transformOrigin: 'center', // Ensures scaling happens from the center
        width: '24px', // Optional: keeps consistent width
        height: '24px', // Optional: keeps consistent height
      },
    },
    [
      h('path', { attrs: { d: 'M12 17h1.5' } }),
      h('path', { attrs: { d: 'M12 22h1.5' } }),
      h('path', { attrs: { d: 'M12 2h1.5' } }),
      h('path', { attrs: { d: 'M17.5 22H19a1 1 0 0 0 1-1' } }),
      h('path', { attrs: { d: 'M17.5 2H19a1 1 0 0 1 1 1v1.5' } }),
      h('path', { attrs: { d: 'M20 14v3h-2.5' } }),
      h('path', { attrs: { d: 'M20 8.5V10' } }),
      h('path', { attrs: { d: 'M4 10V8.5' } }),
      h('path', { attrs: { d: 'M4 19.5V14' } }),
      h('path', { attrs: { d: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H8' } }),
      h('path', { attrs: { d: 'M8 22H6.5a1 1 0 0 1 0-5H8' } }),
    ],
  );
};
