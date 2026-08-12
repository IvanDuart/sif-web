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
          '50': 'var(--p-primary-50, #e1f2ed)',
          '100': 'var(--p-primary-100, #c8e8de)',
          '200': 'var(--p-primary-200, #aadbcc)',
          '300': 'var(--p-primary-300, #87cdb7)',
          '400': 'var(--p-primary-400, #5fbc9f)',
          '500': 'var(--p-primary-500, #059669)',
          '600': 'var(--p-primary-600, #04845c)',
          '700': 'var(--p-primary-700, #046f4e)',
          '800': 'var(--p-primary-800, #03573d)',
          '900': 'var(--p-primary-900, #023f2c)',
          '950': 'var(--p-primary-950, #022d20)',
          'contrast-color': 'var(--p-primary-contrast-color, #ffffff)',
        },
      },
    },
  },
  plugins: [],
}
