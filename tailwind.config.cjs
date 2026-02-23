/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./docs/index.html",
    "./docs/new_ux.html",
    "./src/viewer/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
