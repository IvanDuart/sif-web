/** @type {import('tailwindcss').Config} */
const surface = {
  0: '#ffffff',
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
};

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        poppins: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        surface,
        primary: {
          '50': 'var(--p-primary-50, #eff6ff)',
          '100': 'var(--p-primary-100, #dbeafe)',
          '200': 'var(--p-primary-200, #bfdbfe)',
          '300': 'var(--p-primary-300, #93c5fd)',
          '400': 'var(--p-primary-400, #60a5fa)',
          '500': 'var(--p-primary-500, #3b82f6)',
          '600': 'var(--p-primary-600, #2563eb)',
          '700': 'var(--p-primary-700, #1d4ed8)',
          'contrast-color': '#ffffff',
        },
      },
    },
  },
  plugins: [],
}
