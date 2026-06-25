import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0a08",
        ink2: "#14110d",
        ink3: "#1c1813",
        gold: "#C9A84C",
        goldBright: "#f4dd8b",
        goldDeep: "#8B6914",
        cream: "#F5F0E8",
        creamSoft: "#c5bba6",
        muted: "#8b8270",
        line: "rgba(201,168,76,0.22)",
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
