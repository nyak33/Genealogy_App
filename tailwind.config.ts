import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#202124",
        paper: "#fbfaf7",
        line: "#d7d2c8",
        moss: "#526d57",
        clay: "#9b5f46"
      }
    }
  },
  plugins: []
};

export default config;
