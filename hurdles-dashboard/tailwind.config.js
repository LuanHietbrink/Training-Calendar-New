/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        intensity: {
          high: "#ef4444",
          medium: "#f59e0b",
          low: "#10b981",
        },
      },
    },
  },
  plugins: [],
};
