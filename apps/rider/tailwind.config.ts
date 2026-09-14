import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F7F3EE",
          50: "#F7F3EE",
          100: "#EDE6DC",
        },
        gold: {
          DEFAULT: "#C9A227",
          400: "#E0B93D",
          500: "#C9A227",
        },
        ink: {
          DEFAULT: "#0A0A0A",
          500: "#5C6670",
          900: "#0A0A0A",
        },
        black: {
          DEFAULT: "#0A0A0A",
          700: "#1A1A1A",
          900: "#0A0A0A",
        },
        green: {
          DEFAULT: "#1B7A4E",
          400: "#2FA86A",
          600: "#1B7A4E",
        },
        // From the Tuma wordmark — used for brand chrome (header accents,
        // headings-as-brand, trust badges), kept separate from `gold`
        // which stays the one CTA/interactive accent.
        navy: {
          DEFAULT: "#153A75",
          400: "#3D66A6",
          700: "#0F2A57",
        },
      },
    },
  },
  plugins: [],
};

export default config;
