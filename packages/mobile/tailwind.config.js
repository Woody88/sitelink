/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // SiteLink Design System - Warm color palette
        // Converted from HSL CSS variables to hex

        // Primary - Orange/Coral
        primary: {
          DEFAULT: "#c9623d",  // hsl(15.11, 55.56%, 52.35%)
          light: "#d97a50",    // hsl(14.77, 63.11%, 59.61%) - dark mode primary
          foreground: "#ffffff",
        },

        // Background - Warm off-white
        background: {
          DEFAULT: "#f9f7f2",  // hsl(48, 33.33%, 97.06%)
          dark: "#252524",     // hsl(60, 2.70%, 14.51%)
        },

        // Foreground - Dark text
        foreground: {
          DEFAULT: "#3d3929",  // hsl(48, 19.61%, 20%)
          dark: "#c2bdb3",     // hsl(46.15, 9.77%, 73.92%)
        },

        // Secondary - Warm beige
        secondary: {
          DEFAULT: "#e8e2d4",  // hsl(46.15, 22.81%, 88.82%)
          foreground: "#4a4639", // hsl(50.77, 8.50%, 30%)
        },

        // Muted - Light beige
        muted: {
          DEFAULT: "#ebe5d8",  // hsl(44, 29.41%, 90%)
          foreground: "#828180", // hsl(50, 2.36%, 50.20%)
        },

        // Accent - Same as secondary
        accent: {
          DEFAULT: "#e8e2d4",  // hsl(46.15, 22.81%, 88.82%)
          foreground: "#272418", // hsl(50.77, 19.40%, 13.14%)
        },

        // Card
        card: {
          DEFAULT: "#f9f7f2",  // hsl(48, 33.33%, 97.06%)
          foreground: "#141413", // hsl(60, 2.56%, 7.65%)
        },

        // Border
        border: "#dad7d1",     // hsl(50, 7.50%, 84.31%)

        // Input
        input: "#b3aea2",      // hsl(50.77, 7.98%, 68.04%)

        // Ring - Blue focus ring
        ring: "#217ad6",       // hsl(210, 74.80%, 49.80%)

        // Destructive
        destructive: {
          DEFAULT: "#eb4034",  // hsl(0, 84.24%, 60.20%)
          foreground: "#ffffff",
        },

        // Chart colors
        chart: {
          1: "#b5542a",        // hsl(18.28, 57.14%, 43.92%)
          2: "#b89bef",        // hsl(251.45, 84.62%, 74.51%)
          3: "#dfd8c8",        // hsl(46.15, 28.26%, 81.96%)
          4: "#dbd2ec",        // hsl(256.55, 49.15%, 88.43%)
          5: "#b5542b",        // hsl(17.78, 60%, 44.12%)
        },

        // Sidebar
        sidebar: {
          DEFAULT: "#f5f2eb",  // hsl(51.43, 25.93%, 94.71%)
          foreground: "#3c3a36", // hsl(60, 2.52%, 23.33%)
          primary: "#c9623d",
          "primary-foreground": "#fbfbfb",
          accent: "#e8e2d4",
          "accent-foreground": "#343434",
          border: "#ebebeb",
          ring: "#b5b5b5",
        },
      },
      fontFamily: {
        sans: ["Lexend", "System"],
        display: ["Lexend", "System"],
      },
      borderRadius: {
        DEFAULT: 4,
        sm: 6,
        md: 8,
        lg: 12,
        xl: 16,
        "2xl": 20,
        full: 9999,
      },
    },
  },
  plugins: [],
};
