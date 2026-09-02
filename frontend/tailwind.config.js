/** @type {import('tailwindcss').Config} */
// VetConnect design system — "Editorial Luxury": deep moss-forest + warm clay on cream.
// Token NAMES are stable (brand/sand/ink/surface) so restyles cascade to every page.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: sophisticated moss / forest green (natural, calm, animal-care)
        brand: {
          50: '#f3f7f3', 100: '#e3ede4', 200: '#c7dac9', 300: '#9fbfa2',
          400: '#6f9d74', 500: '#4d7f53', 600: '#3a6641', 700: '#2f5235',
          800: '#28442f', 900: '#223a29', 950: '#0f1d15',
        },
        // Accent: warm clay / terracotta (Ekiti earth)
        sand: {
          50: '#fbf5f0', 100: '#f5e7d9', 200: '#ebccb2', 300: '#ddaa83',
          400: '#d08a5d', 500: '#c4703f', 600: '#b25a34', 700: '#94462c',
          800: '#783a29', 900: '#623123', 950: '#351811',
        },
        ink: { DEFAULT: '#1a1d18', soft: '#43483f', muted: '#797f72' },
        surface: { DEFAULT: '#ffffff', sunken: '#faf8f3', raised: '#fffdf9' },
        danger: '#c0473b', warn: '#bd7d2a', success: '#3a6641',
      },
      fontFamily: {
        // Inter is banned by the design skill — Jakarta body, Fraunces editorial display.
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Fraunces', '"Plus Jakarta Sans"', 'Georgia', 'serif'],
      },
      borderRadius: { xl: '1rem', '2xl': '1.5rem', '3xl': '2rem', squircle: '2.25rem' },
      boxShadow: {
        // Soft, highly diffused ambient shadows — no harsh dark drops.
        card: '0 1px 2px rgba(40,50,35,0.03), 0 14px 36px -16px rgba(40,50,35,0.14)',
        lift: '0 28px 64px -22px rgba(40,50,35,0.24)',
        soft: '0 2px 24px rgba(40,50,35,0.07)',
        focus: '0 0 0 4px rgba(58,102,64,0.18)',
        inset: 'inset 0 1px 1px rgba(255,255,255,0.6)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.32,0.72,0,1)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(12px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: { 'fade-up': 'fade-up 0.6s cubic-bezier(0.32,0.72,0,1) both' },
    },
  },
  plugins: [],
};
