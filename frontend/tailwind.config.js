/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode with class strategy
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mm: {
          canvas: 'rgb(var(--mm-canvas) / <alpha-value>)',
          surface: 'rgb(var(--mm-surface) / <alpha-value>)',
          'surface-subtle': 'rgb(var(--mm-surface-subtle) / <alpha-value>)',
          border: 'rgb(var(--mm-border) / <alpha-value>)',
          'border-strong': 'rgb(var(--mm-border-strong) / <alpha-value>)',
          text: {
            primary: 'rgb(var(--mm-text-primary) / <alpha-value>)',
            secondary: 'rgb(var(--mm-text-secondary) / <alpha-value>)',
            tertiary: 'rgb(var(--mm-text-tertiary) / <alpha-value>)',
          },
          'accent-primary': 'rgb(var(--mm-accent-primary) / <alpha-value>)',
          positive: 'rgb(var(--mm-positive) / <alpha-value>)',
          negative: 'rgb(var(--mm-negative) / <alpha-value>)',
          warning: 'rgb(var(--mm-warning) / <alpha-value>)',
        },
      },
      borderRadius: {
        card: '16px',
        control: '12px',
        pill: '9999px',
      },
      boxShadow: {
        card: 'var(--mm-shadow-card)',
        elevated: 'var(--mm-shadow-elevated)',
      },
    },
  },
  plugins: [],
};
