/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        accent:  { DEFAULT: '#0d9488', dark: '#0f766e', soft: 'rgba(13,148,136,0.10)' },
        green:   { DEFAULT: '#059669', light: '#10b981', soft: 'rgba(5,150,105,0.10)' },
        amber:   { DEFAULT: '#d97706', light: '#f59e0b', soft: 'rgba(217,119,6,0.10)' },
        danger:  { DEFAULT: '#dc2626', light: '#ef4444', soft: 'rgba(220,38,38,0.10)' },
        info:    { DEFAULT: '#3b82f6', soft: 'rgba(59,130,246,0.10)' },
        surface: { DEFAULT: '#eef2f7', 2: '#e2e8f0' },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ["'DM Mono'", 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl2: '14px',
        xl3: '18px',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15,23,42,0.06)',
        sm: '0 1px 4px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.05)',
        md: '0 4px 16px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)',
        lg: '0 12px 40px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.06)',
      },
      animation: {
        'fade-in': 'fadeSlideUp 0.25s cubic-bezier(0.16,1,0.3,1) both',
        shimmer:   'shimmer 1.4s linear infinite',
        float:     'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeSlideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: { to: { backgroundPosition: '200% center' } },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
