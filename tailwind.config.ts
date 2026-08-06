import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        porcelain: "#FAF5F4",
        ink: "#241715",
        stone2: "#6B5F5E",
        spruce: { DEFAULT: "#B3261E", deep: "#7F1B15", tint: "#FBEAE8" },
        gold: "#B98F3E",
        line: "#E8DBD9",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: { card: "14px" },
      boxShadow: { card: "0 1px 2px rgba(34,33,29,0.06), 0 8px 24px rgba(34,33,29,0.05)" },
    },
  },
  plugins: [],
};
export default config;
