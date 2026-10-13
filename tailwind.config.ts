import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f7f9",
        ink: "#222a31",
        muted: "#626d78",
        line: "#e4e8ed",
        brand: { DEFAULT: "#216354", soft: "#edf5f1", dark: "#164a3e" },
      },
      fontFamily: { sans: ["DM Sans Variable", "sans-serif"] },
      boxShadow: { metric: "0 2px 5px rgb(24 39 52 / 0.03)" },
    },
  },
  plugins: [],
};

export default config;