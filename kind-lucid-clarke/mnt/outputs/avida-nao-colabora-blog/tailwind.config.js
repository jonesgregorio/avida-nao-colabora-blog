/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        sage: {
          50: '#f4f7f4',
          100: '#e6ede6',
          200: '#cedbce',
          300: '#a9c0a9',
          400: '#7d9f7d',
          500: '#5a8060',
          600: '#46664b',
          700: '#39523d',
          800: '#2f4232',
          900: '#27372a',
        },
        sand: {
          50: '#faf8f4',
          100: '#f3ede0',
          200: '#e8d9bc',
          300: '#d9be92',
          400: '#c99f66',
          500: '#be8947',
          600: '#b0743b',
          700: '#935d32',
          800: '#774d2e',
          900: '#624028',
        },
        ocean: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9ddfd',
          300: '#7cc1fb',
          400: '#36a3f7',
          500: '#0c87e8',
          600: '#006dc6',
          700: '#0057a1',
          800: '#044b85',
          900: '#093f6e',
        },
      },
    },
  },
  plugins: [],
}
