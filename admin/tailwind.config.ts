import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Matched to the main website: black surfaces, #d4af37 gold.
        ink: "#0b0a08",
        ink2: "#0e0d0b",
        ink3: "#141312",
        gold: "#d4af37",
        goldBright: "#f4dd8b",
        goldDeep: "#a8801f",
        cream: "#f4ecdd",
        creamSoft: "#c5bba6",
        muted: "#8b8270",
        line: "rgba(212,175,55,0.22)",
        rose: "#C9A484",
        steel: "#84A4C9",
        sage: "#84C9A4",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-jost)", "system-ui", "sans-serif"],
      },
      transitionTimingFunction: {
        cinematic: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
