/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#8B5CF6",
        mainBg: "#0B0E14",
        secondaryBg: "#161B22",
        border: "#1E293B",
        textPrimary: "#F8FAFC",
        textSecondary: "#94A3B8",
        textMuted: "#64748B",
        accent: "#3B82F6",
        success: "#10B981",
        warning: "#F59E0B",
        info: "#CCCCFF",
        error: "#EF4444",
        danger: "#EF4444",
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
