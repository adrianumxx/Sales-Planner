/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#f8fafc',
          900: '#0f172a',
        }
      },
      spacing: {
        's1': '4px',
        's2': '8px',
        's3': '12px',
        's4': '16px',
        's6': '24px',
        's8': '32px',
        's10': '40px',
        's12': '48px',
      },
      borderRadius: {
        'r-sm': '6px',
        'r-md': '10px',
        'r-lg': '16px',
        'r-xl': '24px',
      }
    },
  },
  plugins: [],
}
