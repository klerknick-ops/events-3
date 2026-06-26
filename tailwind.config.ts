import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // enums.ts holds status pill/block/dot color classes referenced by the UI.
    "./lib/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Semantic, CSS-variable-backed tokens that flip in dark mode.
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        app: "rgb(var(--app) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
        },
        base: "rgb(var(--border) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)", // selected/highlight bg
        // Lantern brand scale — ember → red. brand-600 (#BD3B2C) is the primary
        // action colour; brand-500 (#E8643F) the ember accent; brand-300 a warm
        // light tint that reads on the dark ink surface.
        brand: {
          50: "#fceee9",
          100: "#f9d9cd",
          200: "#f2b39e",
          300: "#e89177",
          400: "#ec6e47",
          500: "#e8643f",
          600: "#bd3b2c",
          700: "#9c2e22",
          800: "#7c261d",
          900: "#5f1e17",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "0 10px 40px -12px rgba(15, 23, 42, 0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
