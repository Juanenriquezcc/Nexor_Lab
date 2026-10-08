// NEXOR palette: the single source of truth. index.css exposes it as
// --nexor-* variables through theme(), so App.css and Tailwind classes agree.
const nexor = {
  bg: "#0A0D14",
  // Tonal surfaces, from page background upwards.
  panel: "#111622",
  elevated: "#161D2B",
  interactive: "#1C2536",
  border: "#1E293B",
  input: "#334155",
  blue: "#3B82F6",
  cyan: "#06B6D4",
  purple: "#8B5CF6",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  text: "#F8FAFC",
  muted: "#94A3B8",
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // System font stacks only: the UI must render offline.
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Cascadia Code", "ui-monospace", "SFMono-Regular", "Consolas", "Menlo", "monospace"],
      },
      colors: {
        nexor,
        // Semantic tokens expected by the shadcn/ui primitives in components/ui.
        background: nexor.bg,
        foreground: nexor.text,
        card: { DEFAULT: nexor.elevated, foreground: nexor.text },
        primary: { DEFAULT: nexor.blue, foreground: nexor.text },
        secondary: { DEFAULT: nexor.panel, foreground: nexor.text },
        muted: { DEFAULT: nexor.border, foreground: nexor.muted },
        accent: { DEFAULT: nexor.border, foreground: nexor.text },
        destructive: { DEFAULT: nexor.red, foreground: nexor.text },
        border: nexor.border,
        input: nexor.input,
        ring: nexor.cyan,
      },
      // shadcn uses aria-invalid:*; Tailwind 3 has no built-in aria-invalid variant.
      aria: {
        invalid: 'invalid="true"',
      },
    },
  },
  plugins: [],
}
