/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Define a Inter como padrão do sistema todo
        montserrat: ['Montserrat', 'sans-serif'], // Cria o atalho pra fonte dos Títulos
      }
    },
  },
  plugins: [],
}