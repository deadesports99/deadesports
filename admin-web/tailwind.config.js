/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Same tokens the player app demo uses, so the two products feel like one.
        cyan: { DEFAULT: '#00C2FF' },
        gold: { DEFAULT: '#FFD000' },
        ink: {
          950: '#050B14',
          900: '#080F1C',
          850: '#0B1526',
          800: '#0C121E',
          700: '#0F1E36',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Chakra Petch', 'sans-serif'],
        spartan: ['Cinzel', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      screens: {
        xs: '400px',
      },
    },
  },
  plugins: [],
};
