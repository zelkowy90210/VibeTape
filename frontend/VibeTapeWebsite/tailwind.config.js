/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        chassis: '#0B0C0E',
        panel: '#14171A',
        line: '#22272E',
        data: '#D8DEE9',
        dim: '#5E6773',
        laser: '#00FFA3', // Radioaktywna zieleń/mięta
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
      }
    },
  },
  plugins: [],
}