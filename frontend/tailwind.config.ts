import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-cairo)', 'var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          taupe: '#605B51',
          gold: '#D8D365',
          champagne: '#E6F082',
          stone: {
            50: '#F5F4EE',
            100: '#ECEAE1',
            200: '#D8D5C8',
            300: '#B8B3A4',
            400: '#8A857A',
            500: '#605B51',
            600: '#4C4840',
            700: '#38352F',
            800: '#262420',
            900: '#181815',
            950: '#121210',
          },
          lime: {
            100: '#FAFCE0',
            200: '#F3F9B5',
            300: '#E6F082',
            400: '#D8D365',
            500: '#BDB745',
            600: '#948F2A',
            700: '#6C6818',
            800: '#48450F',
            900: '#2A2808',
          },
        },
        background: {
          DEFAULT: 'var(--background)',
          subtle: 'var(--background-subtle)',
        },
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          hover: 'var(--surface-hover)',
        },
        foreground: {
          DEFAULT: 'var(--foreground)',
          muted: 'var(--foreground-muted)',
          subtle: 'var(--foreground-subtle)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          hover: 'var(--secondary-hover)',
          foreground: 'var(--secondary-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle: 'var(--border-subtle)',
        },
        ring: 'var(--ring)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
          border: 'var(--card-border)',
        },
        skeleton: {
          DEFAULT: 'var(--skeleton)',
          highlight: 'var(--skeleton-highlight)',
        },
      },
      boxShadow: {
        'luxury': '0 2px 20px -2px rgba(96, 91, 81, 0.05), 0 0 0 1px rgba(96, 91, 81, 0.05)',
        'luxury-dark': '0 8px 32px -4px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(230, 240, 130, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
