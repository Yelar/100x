/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.8)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      },
      animation: {
        slideIn: 'slideIn 0.3s ease-out forwards',
        scaleIn: 'scaleIn 0.2s ease-out forwards',
      },
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%',
            color: 'var(--foreground)',
            a: {
              color: 'var(--primary)',
              '&:hover': {
                color: 'var(--primary-foreground)',
              },
            },
            '[class~="lead"]': {
              color: 'var(--foreground)',
            },
            strong: {
              color: 'var(--foreground)',
            },
            'ol > li::marker': {
              color: 'var(--muted-foreground)',
            },
            'ul > li::marker': {
              color: 'var(--muted-foreground)',
            },
            hr: {
              borderColor: 'var(--border)',
            },
            blockquote: {
              borderLeftColor: 'var(--border)',
              color: 'var(--foreground)',
            },
            h1: {
              color: 'var(--foreground)',
            },
            h2: {
              color: 'var(--foreground)',
            },
            h3: {
              color: 'var(--foreground)',
            },
            h4: {
              color: 'var(--foreground)',
            },
            'figure figcaption': {
              color: 'var(--muted-foreground)',
            },
            code: {
              color: 'var(--foreground)',
            },
            'a code': {
              color: 'var(--foreground)',
            },
            pre: {
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
            },
            thead: {
              color: 'var(--foreground)',
              borderBottomColor: 'var(--border)',
            },
            'tbody tr': {
              borderBottomColor: 'var(--border)',
            },
          },
        },
      },
    },
  },
  plugins: [typography],
} 