import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: "#000517", // App background
          900: "#000c31", // Base color (Cards, Sidebar)
          800: "#001b54", // Hover states
          600: "#0044cc", // Primary buttons
          400: "#4d88ff", // Badges, highlights
          200: "#8ba4d5", // Muted text
          50: "#f0f4ff", // Primary text
        },
        accent: {
          warning: "#f59e0b", // Amber for contrast
        },
      },
    },
  },
  plugins: [],
};

export default config;
