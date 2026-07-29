import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soft ivory workspace with muted gold accents.
        ink: "#302d27",
        ink2: "#fffdfa",
        ink3: "#f5f0e7",
        gold: "#aa8a4d",
        goldBright: "#c6aa72",
        goldDeep: "#85672f",
        cream: "#302d27",
        creamSoft: "#716a5f",
        muted: "#9a9286",
        line: "rgba(170,138,77,0.22)",
        rose: "#b77d70",
        steel: "#6f8dac",
        sage: "#6f9c7e",
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
