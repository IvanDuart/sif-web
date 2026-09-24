/** @type {import('tailwindcss').Config} */
// Rampa neutra cálida — espejo de los tokens --p-surface-* de src/styles.less
// (Guía de diseño §3). Mantener ambos en sync.
const surface = {
  0: '#ffffff',
  50: '#fbfaf8',
  100: '#f4f2ee',
  200: '#eae7e1',
  300: '#d8d4cc',
  400: '#9a958c',
  500: '#6b665e',
  600: '#55504a',
  700: '#3a3631',
  800: '#2a2723',
  900: '#1f1d1a',
  950: '#16140f',
};

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Satoshi', 'system-ui', 'sans-serif'],
        serif: ['Satoshi', 'system-ui', 'sans-serif'],
        // Alias temporal: plantillas antiguas que aún piden font-poppins.
        poppins: ['var(--font-ui)'],
      },
      colors: {
        surface,
        // Tokens semánticos de la Guía (§3) — usar estos en código nuevo.
        canvas: 'var(--canvas)',
        sunken: 'var(--sunken)',
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        ok: {
          DEFAULT: 'var(--ok)',
          soft: 'var(--ok-soft)',
        },
        warn: 'var(--warn)',
        err: 'var(--err)',
        info: 'var(--info)',
        primary: {
          '50': 'var(--p-primary-50, #e1f2ed)',
          '100': 'var(--p-primary-100, #c8e8de)',
          '200': 'var(--p-primary-200, #aadbcc)',
          '300': 'var(--p-primary-300, #87cdb7)',
          '400': 'var(--p-primary-400, #5fbc9f)',
          '500': 'var(--p-primary-500, #2f5d4f)',
          '600': 'var(--p-primary-600, #04845c)',
          '700': 'var(--p-primary-700, #046f4e)',
          '800': 'var(--p-primary-800, #03573d)',
          '900': 'var(--p-primary-900, #023f2c)',
          '950': 'var(--p-primary-950, #022d20)',
          'contrast-color': 'var(--p-primary-contrast-color, #ffffff)',
        },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        float: 'var(--shadow-float)',
      },
    },
  },
  plugins: [],
}
