/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // 🔥 Adiciona suporte a tema escuro
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brandBlue: "#1E3A8A",
        brandGreen: "#16A34A",
        brandOrange: "#F97316",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
