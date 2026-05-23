import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        vinyl: {
          black: "hsl(var(--vinyl-black))",
          groove: "hsl(var(--vinyl-groove))",
        },
        cream: "hsl(var(--cream))",
        "warm-white": "hsl(var(--warm-white))",
        "cyan-glow": "hsl(var(--cyan-glow))",
        "cyan-dim": "hsl(var(--cyan-dim))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px hsl(200 90% 50% / 0.25)" },
          "50%": { boxShadow: "0 0 40px hsl(200 90% 50% / 0.5)" },
        },
        "pulse-slow": {
          "0%, 100%": { boxShadow: "0 0 20px var(--pulse-color)" },
          "50%": { boxShadow: "0 0 60px var(--pulse-color)" },
        },
        "rainbow-pulse": {
          // Non-sequential colour walk across the wheel — feels random rather than
          // a predictable ROYGBIV cycle. Wide hue jumps + uneven stop spacing.
          "0%":   { boxShadow: "0 0 0 3px hsl(295 100% 65% / 0.9), 0 0 50px 14px hsl(295 100% 65% / 0.4), 0 0 110px 34px hsl(295 100% 65% / 0.15)" },
          "11%":  { boxShadow: "0 0 0 3px hsl(165 95% 50% / 0.9),  0 0 45px 12px hsl(165 95% 50% / 0.4),  0 0 100px 30px hsl(165 95% 50% / 0.15)" },
          "23%":  { boxShadow: "0 0 0 3px hsl(15 100% 60% / 0.9),  0 0 55px 16px hsl(15 100% 60% / 0.4),  0 0 115px 36px hsl(15 100% 60% / 0.15)" },
          "37%":  { boxShadow: "0 0 0 3px hsl(220 100% 60% / 0.9), 0 0 50px 14px hsl(220 100% 60% / 0.4), 0 0 105px 32px hsl(220 100% 60% / 0.15)" },
          "48%":  { boxShadow: "0 0 0 3px hsl(60 100% 55% / 0.9),  0 0 45px 12px hsl(60 100% 55% / 0.4),  0 0 100px 30px hsl(60 100% 55% / 0.15)" },
          "61%":  { boxShadow: "0 0 0 3px hsl(330 100% 65% / 0.9), 0 0 55px 16px hsl(330 100% 65% / 0.4), 0 0 115px 36px hsl(330 100% 65% / 0.15)" },
          "74%":  { boxShadow: "0 0 0 3px hsl(125 85% 50% / 0.9),  0 0 50px 14px hsl(125 85% 50% / 0.4),  0 0 105px 32px hsl(125 85% 50% / 0.15)" },
          "87%":  { boxShadow: "0 0 0 3px hsl(190 100% 58% / 0.9), 0 0 45px 12px hsl(190 100% 58% / 0.4), 0 0 100px 30px hsl(190 100% 58% / 0.15)" },
          "100%": { boxShadow: "0 0 0 3px hsl(295 100% 65% / 0.9), 0 0 50px 14px hsl(295 100% 65% / 0.4), 0 0 110px 34px hsl(295 100% 65% / 0.15)" },
        },
        "rainbow-scale": {
          "0%, 100%": { transform: "scale(1)" },
          "50%":      { transform: "scale(1.018)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "spin-slow": "spin-slow 8s linear infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "pulse-slow": "pulse-slow 20s ease-in-out infinite",
        // Slower, randomised colour cycle (16s) — breathing scale runs at a
        // different period (3.7s) so the two never sync up.
        "rainbow-pulse": "rainbow-pulse 16s ease-in-out infinite, rainbow-scale 3.7s ease-in-out infinite",
      },
      boxShadow: {
        vinyl: "0 20px 60px -15px hsl(220 15% 0% / 0.6)",
        glow: "0 0 40px hsl(200 90% 50% / 0.25)",
        card: "0 4px 20px hsl(220 15% 0% / 0.3)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
