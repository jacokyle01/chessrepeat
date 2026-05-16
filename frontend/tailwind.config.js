// /** @type {import('tailwindcss').Config} */
// export default {
//   content: [
//     './src/**/*{html,js,ts}',
//   ],
//   theme: {
//     extend: {},
//   },
//   plugins: [],
// }

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Fira Sans', 'Roboto', 'sans-serif'],
        roboto: ['Roboto'],
        'roboto-condensed': ['Roboto Condensed', 'Roboto', 'sans-serif']
      },
      width: {
        '97': '97%',
      },
      colors: {
        'c-bg-page': 'hsl(37, 10%, 92%)',
        'c-body-gradient': 'hsl(37, 12%, 84%)',
        'blue-gray': '#ECEFF1',
        // Canonical app blues — source of truth is the progress bar above
        // the board (light = sky-300, dark = blue-500).
        'brand-blue': '#3b82f6',
        'brand-blue-light': '#7dd3fc',
      },
      backgroundImage: {
        'custom-gradient': 'linear-gradient(to bottom, hsl(37, 12%, 84%), hsl(37, 10%, 92%) 116px)',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { backgroundColor: 'white'},
          '50%': { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
        },
      },
      animation: {
        'pulse-blue': 'pulse 2s infinite',
      },
    },
  },
  plugins: [],
};
import defaultTheme from 'tailwindcss/defaultTheme';