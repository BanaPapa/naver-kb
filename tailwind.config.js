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
        }
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
