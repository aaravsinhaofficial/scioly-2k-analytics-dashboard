import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        court: {
          black: "#050505",
          panel: "#111111",
          elevated: "#1a1a1a",
          line: "#2b2b2b"
        },
        tier: {
          opal: "#06B6D4",
          pinkDiamond: "#EC4899",
          diamond: "#3B82F6",
          amethyst: "#A855F7",
          ruby: "#EF4444",
          bronze: "#9CA3AF"
        }
      },
      boxShadow: {
        opal: "0 0 28px rgba(6, 182, 212, 0.35)",
        panel: "0 18px 70px rgba(0, 0, 0, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
