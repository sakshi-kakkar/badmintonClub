/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:      ['Barlow', 'system-ui', 'sans-serif'],
        condensed: ['Barlow Condensed', 'sans-serif'],
      },
      colors: {
        navy:   '#0F172A',
        cyan:   '#22D3EE',
      },
    },
  },
  plugins: [],
};
