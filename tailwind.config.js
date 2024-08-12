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
  content: ['./src/**/*.{html,js,ts}'],
  theme: {
    extend: {
      colors: {
        'c-bg-page': 'hsl(37, 10%, 92%)',
        'c-body-gradient': 'hsl(37, 12%, 84%)',
      },
      backgroundImage: {
        'custom-gradient': 'linear-gradient(to bottom, hsl(37, 12%, 84%), hsl(37, 10%, 92%) 116px)',
      },
    },
  },
  plugins: [],
};
