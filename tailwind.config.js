/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8edf5',
          100: '#d1dbe9',
          200: '#a3b7d4',
          300: '#7593be',
          400: '#476fa9',
          500: '#1a4b93',
          600: '#163c76',
          700: '#122d58',
          800: '#0d1e3b',
          900: '#0a1729',
          950: '#060e17',
        },
      },
    },
  },
  plugins: [],
};
