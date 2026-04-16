/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#F9F8F6',
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F0F4F1',
        },
        'text-primary': '#1A2E20',
        'text-secondary': '#5C6B61',
        primary: {
          DEFAULT: '#C86B53',
          hover: '#B35A44',
        },
        success: {
          DEFAULT: '#6B8E78',
          hover: '#5A7A66',
        },
        border: '#E6DFD4',
        error: '#D94F4F',
      },
      fontFamily: {
        heading: ['Outfit', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
