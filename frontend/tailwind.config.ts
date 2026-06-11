import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        command: {
  bg: "#f8fafc",       // Clean light slate background (Soft on eyes)
  card: "#ffffff",     // Pure white card background for crisp layering
  border: "#e2e8f0",   // Subtle light gray border
  text: "#0f172a",     // Deep dark slate text for perfect readability
  accent: "#059669"    // Emerald green slightly deepened for light mode contrast
},
      },
      animation: {
        "radar-sweep": "radar-sweep 6s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        "radar-sweep": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5", filter: "drop-shadow(0 0 4px rgba(16, 185, 129, 0.4))" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
