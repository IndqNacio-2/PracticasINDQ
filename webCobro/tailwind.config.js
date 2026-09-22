/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0f172a', // Fondo oscuro principal
          800: '#1e293b', // Fondo de navbar/tarjetas oscuras
        },
        primary: {
          DEFAULT: '#10b981', // Verde menta del botón
          hover: '#059669',   // Verde al pasar el mouse
        },
      },
    },
  },
  plugins: [],
}