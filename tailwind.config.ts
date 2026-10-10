
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ground: '#F3F5EF', // chalky post-harvest field light
        panel: '#FFFFFF',
        ink: { DEFAULT: '#14211B', soft: '#46534C', mute: '#7A857F' },
        line: '#DCE2DA',
        sprout: { 50: '#ECF6EF', 100: '#D3EBDB', 300: '#7CC096', 500: '#2F8F4E', 600: '#24753F', 700: '#1C5C32', 900: '#0F3820' },
        stubble: { 50: '#FBF5E4', 100: '#F5E6B8', 300: '#E8C566', 500: '#D9A93A', 600: '#B88A22', 700: '#8C6812' },
        fire: { 50: '#FCEDE9', 100: '#F8D3C9', 500: '#D9482B', 600: '#B8361C' },
        sky: { 50: '#EAF2F7', 500: '#3A7CA5', 600: '#2E6589' },
        smoke: { 100: '#EEF0EE', 200: '#DDE1DE', 400: '#9AA19C', 500: '#8A8F8C' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk"', '"Noto Sans Devanagari"', '"Noto Sans Gurmukhi"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { panel: '14px', ctl: '8px' },
      boxShadow: {
        panel: '0 1px 0 rgba(20,33,27,.04), 0 6px 24px -12px rgba(20,33,27,.18)',
        pop: '0 18px 48px -16px rgba(20,33,27,.35)',
      },
      keyframes: {
        sweep: { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
        ring: { '0%': { transform: 'scale(.6)', opacity: '.8' }, '100%': { transform: 'scale(2.4)', opacity: '0' } },
        drawer: { '0%': { transform: 'translateX(24px)', opacity: '0' }, '100%': { transform: 'none', opacity: '1' } },
      },
      animation: { sweep: 'sweep 1.1s cubic-bezier(.2,.7,.2,1) both', ring: 'ring 1.8s ease-out infinite', drawer: 'drawer .25s ease-out both' },
    },
  },
  plugins: [],
} satisfies Config;
