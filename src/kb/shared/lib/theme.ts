import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'eos-theme';

// 저장된 테마 → 없으면 light(이미지 기본). SSR 환경이 아니므로 window 안전.
function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' || saved === 'light' ? saved : 'light';
}

// <html data-theme> + <body class="eos-body"> 동기화. 셸 토큰이 data-theme로 갈린다.
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  document.body.classList.add('eos-body');
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),
  setTheme: (theme) => {
    applyTheme(theme);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === 'light' ? 'dark' : 'light'),
}));

// 모듈 로드 시점에 즉시 적용해 첫 페인트 깜빡임 방지.
applyTheme(readInitialTheme());
