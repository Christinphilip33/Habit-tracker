/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0e0e0e',
          low: '#131313',
          mid: '#1a1a1a',
          high: '#20201f',
          highest: '#262626',
          bright: '#2c2c2c',
        },
        accent: {
          purple: '#d1b3ff',
          cyan: '#4af8e3',
          pink: '#ff6c95',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
