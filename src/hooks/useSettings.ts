import { useState, useCallback, useEffect } from 'react';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings, applySettings } from '../services/settings';

// 앱 전역 설정 상태 훅 — 변경 시 즉시 localStorage 저장 + 문서에 반영(불변 업데이트).
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // 최초 로드 시 저장값 복원 + 적용
  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applySettings(loaded);
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next: AppSettings = { ...prev, ...patch };
      saveSettings(next);
      applySettings(next);
      return next;
    });
  }, []);

  // 강조색은 현재 테마에 한해 변경 (테마별 보관)
  const setAccent = useCallback((color: string) => {
    setSettings((prev) => {
      const next: AppSettings = {
        ...prev,
        accent: { ...prev.accent, [prev.themeMode]: color },
      };
      saveSettings(next);
      applySettings(next);
      return next;
    });
  }, []);

  return { settings, update, setAccent };
}
