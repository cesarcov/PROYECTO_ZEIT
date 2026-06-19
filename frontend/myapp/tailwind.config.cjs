/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        w: {
          light:  "#B8E3E9",   // fondo claro, chips, highlights
          mid:    "#93B1B5",   // texto secundario, bordes suaves
          dark:   "#4F7C82",   // botones primarios, activos, accents
          deep:   "#0B2E33",   // sidebar, encabezados oscuros
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
