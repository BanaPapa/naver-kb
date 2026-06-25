/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // 매물시세(naver) 모듈은 바닐라 다크테마 CSS를 사용한다.
  // Tailwind preflight(전역 리셋)를 켜면 naver의 다크테마를 덮어쓰므로 비활성화하고,
  // 유틸리티는 클래스를 실제로 사용하는 KB 컴포넌트에만 적용되게 한다.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        chart: {
          1: '#3b82f6',
          2: '#ef4444',
          3: '#10b981',
          4: '#f59e0b',
        },
        // KB 모듈(.kb-scope)이 쓰는 Tailwind 회색/파랑을 Estate OS 테마 토큰으로 매핑한다.
        // 토큰은 :root[data-theme] 로 flip되므로 라이트/다크 전환을 자동으로 따라가고,
        // hover/focus 등 모든 변형 유틸에도 적용된다. (매물시세는 Tailwind 색을 쓰지 않아 무영향)
        gray: {
          50: 'var(--surface)',
          100: 'var(--surface-2)',
          200: 'var(--border)',
          300: 'var(--border-2)',
          400: 'var(--muted-2)',
          500: 'var(--muted)',
          600: 'var(--fg-2)',
          700: 'var(--fg-2)',
          800: 'var(--fg)',
          900: 'var(--fg)',
        },
        blue: {
          50: 'var(--blue-dim)',
          100: 'var(--blue-dim)',
          200: 'var(--blue-dim)',
          300: 'var(--blue)',
          400: 'var(--blue)',
          500: 'var(--blue)',
          600: 'var(--blue)',
          700: 'var(--blue)',
          800: 'var(--blue)',
          900: 'var(--blue)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
