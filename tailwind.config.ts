import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    colors: {
      inherit: "inherit",
      current: "currentColor",
      transparent: "transparent",
      white: "rgb(var(--color-ink) / <alpha-value>)",
      black: "rgb(var(--color-on-primary) / <alpha-value>)",
      zinc: {
        50: "rgb(var(--color-zinc-50) / <alpha-value>)",
        100: "rgb(var(--color-zinc-100) / <alpha-value>)",
        200: "rgb(var(--color-zinc-200) / <alpha-value>)",
        300: "rgb(var(--color-zinc-300) / <alpha-value>)",
        400: "rgb(var(--color-zinc-400) / <alpha-value>)",
        500: "rgb(var(--color-zinc-500) / <alpha-value>)",
        600: "rgb(var(--color-zinc-600) / <alpha-value>)",
        700: "rgb(var(--color-zinc-700) / <alpha-value>)",
        800: "rgb(var(--color-zinc-800) / <alpha-value>)",
        900: "rgb(var(--color-zinc-900) / <alpha-value>)"
      },
      cyan: {
        200: "rgb(var(--color-accent) / <alpha-value>)",
        300: "rgb(var(--color-accent) / <alpha-value>)",
        400: "rgb(var(--color-accent-strong) / <alpha-value>)"
      },
      fuchsia: {
        300: "#5267b8",
        400: "#4056a1"
      },
      pink: {
        200: "#9a4d73",
        300: "#9a4d73",
        400: "#873d65",
        500: "#7d365d"
      },
      purple: {
        300: "#6f61a8",
        500: "#66539e"
      },
      blue: {
        500: "#3566a8"
      },
      emerald: {
        100: "rgb(var(--color-success) / <alpha-value>)",
        200: "rgb(var(--color-success) / <alpha-value>)",
        300: "rgb(var(--color-success) / <alpha-value>)",
        400: "rgb(var(--color-success) / <alpha-value>)"
      },
      amber: {
        100: "rgb(var(--color-warning) / <alpha-value>)",
        200: "rgb(var(--color-warning) / <alpha-value>)",
        300: "rgb(var(--color-warning) / <alpha-value>)"
      },
      red: {
        100: "rgb(var(--color-danger) / <alpha-value>)",
        200: "rgb(var(--color-danger) / <alpha-value>)",
        300: "rgb(var(--color-danger) / <alpha-value>)",
        400: "rgb(var(--color-danger-strong) / <alpha-value>)",
        500: "rgb(var(--color-danger-strong) / <alpha-value>)"
      }
    },
    extend: {
      colors: {
        court: {
          black: "rgb(var(--color-background) / <alpha-value>)",
          panel: "rgb(var(--color-panel) / <alpha-value>)",
          elevated: "rgb(var(--color-elevated) / <alpha-value>)",
          line: "rgb(var(--color-line) / <alpha-value>)"
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
        opal: "0 1px 2px rgb(var(--color-shadow) / 0.08)",
        panel: "0 1px 2px rgb(var(--color-shadow) / 0.08), 0 8px 24px rgb(var(--color-shadow) / 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
