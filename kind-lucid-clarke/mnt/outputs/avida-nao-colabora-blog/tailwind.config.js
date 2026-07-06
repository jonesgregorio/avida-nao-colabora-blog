/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // sage/sand/ocean REMAPEADOS para a paleta nova — reveste telas antigas
        // sem tocar em cada arquivo (as telas novas usam forest/paper/mint direto).
        sage: {
          50: '#eef3f0',
          100: '#dcebe2',
          200: '#c0d8c9',
          300: '#8fb5a1',
          400: '#5c8a72',
          500: '#3f6f57',
          600: '#245842',
          700: '#173f30',
          800: '#123528',
          900: '#0f3328',
        },
        sand: {
          50: '#faf8f3',
          100: '#f1ece1',
          200: '#e8e1d7',
          300: '#dccbb7',
          400: '#c7ad8c',
          500: '#a98f6a',
          600: '#8c7350',
          700: '#6e5a40',
          800: '#564636',
          900: '#463a2e',
        },
        ocean: {
          50: '#eef4fa',
          100: '#ddeaf3',
          200: '#c2d9ec',
          300: '#9cc0dd',
          400: '#6b9bc4',
          500: '#4a7ea8',
          600: '#3d6ea5',
          700: '#315a89',
          800: '#2a4a70',
          900: '#243d5c',
        },
        // fundo das telas antigas (mains usam bg-stone-50) → paper
        stone: { 50: '#FBFAF7' },
        // ── Paleta oficial da marca (guia visual) ──
        //  principal #1A4A3A · fundo #FBFAF7 · texto #0F2F25 · secundário #5F6661
        forest: {
          50: '#eef3f0', 100: '#dcebe2', 200: '#b9d3c3', 300: '#8fb5a1',
          400: '#5c8a72', 500: '#2f5d47', 600: '#1c4a37', 700: '#153e2f',
          800: '#123528', 900: '#1A4A3A',
        },
        paper: { DEFAULT: '#FBFAF7', soft: '#FFFFFF' },
        ink: { DEFAULT: '#0F2F25', soft: '#5F6661' },
        mint: '#E8F0EB',
        sky: '#E4EEF7',
        coral: '#F7D8CE',
        lilac: '#E9E1F3',
        line: '#E6E1D8',
        // coral principal do Plus (acento forte)
        plus: '#E8664D',
      },
    },
  },
  plugins: [],
}
