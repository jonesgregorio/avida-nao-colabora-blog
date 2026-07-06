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
        // ── Paleta da repaginação (imagem de referência) ──
        forest: {
          50: '#eef3f0', 100: '#dcebe2', 200: '#b9d3c3', 300: '#8fb5a1',
          400: '#5c8a72', 500: '#2f5d47', 600: '#1c4a37', 700: '#153e2f',
          800: '#123528', 900: '#0f3328',
        },
        paper: { DEFAULT: '#faf8f3', soft: '#fbfaf7' },
        ink: { DEFAULT: '#14251f', soft: '#5e6660' },
        mint: '#dcebe2',
        sky: '#ddeaf3',
        coral: '#f7d6cc',
        lilac: '#e6dff3',
        line: '#e8e1d7',
      },
    },
  },
  plugins: [],
}
