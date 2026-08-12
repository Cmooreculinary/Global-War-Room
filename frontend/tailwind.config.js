/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        editorial: ["'Source Serif 4'", "Georgia", "serif"],
        ui: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        smallcaps: "0.18em",
      },
      colors: {
        // shadcn tokens
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Cortex tokens
        obsidian: "#0A0A0F",
        carbon: "#14141C",
        slate: "#2A2A36",
        bone: "#E8E4DC",
        pearl: "#F5F2EC",
        ash: "#6B6B78",
        senate: { DEFAULT: "#8B1A1A", accent: "#C9A961" },
        boardroom: { DEFAULT: "#0F4F3F", accent: "#B8864F" },
        courtroom: { DEFAULT: "#3A2419", accent: "#A88A4A" },
        council: { DEFAULT: "#1B2A5C", accent: "#F5F2EC" },
        forge: { DEFAULT: "#C84A1F", accent: "#FFE5B4" },
        warroom: { DEFAULT: "#1E2A33", accent: "#D6C08A" },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        breath: {
          "0%, 100%": { opacity: "0.55", filter: "drop-shadow(0 0 12px var(--lobe-glow, rgba(255,229,180,0.2)))" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 28px var(--lobe-glow, rgba(255,229,180,0.5)))" },
        },
        "forge-pulse": {
          "0%, 100%": { opacity: "0.7", filter: "drop-shadow(0 0 18px rgba(200,74,31,0.55))" },
          "50%": { opacity: "1", filter: "drop-shadow(0 0 36px rgba(255,229,180,0.85))" },
        },
        shimmer: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" },
          "100%": { transform: "translateY(0px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        breath: "breath 4s ease-in-out infinite",
        "forge-pulse": "forge-pulse 2.4s ease-in-out infinite",
        shimmer: "shimmer 6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
