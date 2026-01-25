/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      animation: {
        // Creates a smooth 25-second infinite scroll for the ticker
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      // Adding your specific Figma brand colors for easy reference
      colors: {
        neonGreen: '#00FF41',
        neonOrange: '#FF4500',
        cardBg: '#1A1A1A',
      },
    },
  },
  plugins: [],
}