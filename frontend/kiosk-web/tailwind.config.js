/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#006194",
        "primary-container": "#007bb9",
        "on-primary": "#ffffff",
        "on-primary-container": "#fdfcff",
        "secondary": "#006c49",
        "secondary-container": "#6cf8bb",
        "surface": "#faf8ff",
        "surface-bright": "#faf8ff",
        "surface-dim": "#d2d9f4",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3ff",
        "surface-container": "#eaedff",
        "surface-container-high": "#e2e7ff",
        "surface-container-highest": "#dae2fd",
        "on-surface": "#131b2e",
        "on-surface-variant": "#3f4850",
        "outline": "#707881",
        "outline-variant": "#bfc7d2",
        "error": "#ba1a1a",
        "error-container": "#ffdad6",
        "tertiary": "#b61722",
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['Space Grotesk', 'monospace'],
      }
    },
  },
  plugins: [],
}
