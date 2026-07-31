import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        porcelain: "#F7F5F0",
        ink: "#22211D",
        stone2: "#6B685F",
        spruce: { DEFAULT: "#23543F", deep: "#173A2B", tint: "#E7EEE8" },
        gold: "#B98F3E",
        line: "#E3E0D8",
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
