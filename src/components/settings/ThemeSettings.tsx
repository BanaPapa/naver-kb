import React from 'react';
import { AppSettings, ACCENT_PRESETS, ThemeMode } from '../../services/settings';

interface ThemeSettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onAccent: (color: string) => void;
}

const MODES: { key: ThemeMode; label: string; hint: string }[] = [
  { key: 'dark', label: '다크', hint: '어두운 배경 (기본)' },
  { key: 'light', label: '라이트', hint: '밝은 배경' },
];

export function ThemeSettings({ settings, onUpdate, onAccent }: ThemeSettingsProps) {
  const currentAccent = settings.accent[settings.themeMode];

  return (
    <div className="settings-page">
      <h2 className="settings-title">테마 &amp; 색상</h2>

      <div className="settings-card">
        <h3 className="settings-card-title">테마 모드</h3>
        <p className="settings-note">화면 전체의 밝기 테마를 선택합니다.</p>
        <div className="theme-mode-row">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`theme-mode-card${settings.themeMode === m.key ? ' active' : ''}`}
              onClick={() => onUpdate({ themeMode: m.key })}
            >
              <span className={`theme-mode-swatch ${m.key}`} />
              <b>{m.label}</b>
              <span className="theme-mode-hint">{m.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">강조 색상</h3>
        <p className="settings-note">
          버튼·활성 탭 등에 쓰이는 포인트 색입니다. <b>{settings.themeMode === 'dark' ? '다크' : '라이트'}</b> 테마에 적용되며, 테마별로 따로 저장됩니다.
        </p>
        <div className="accent-row">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.color}
              type="button"
              className={`accent-swatch${currentAccent.toLowerCase() === p.color.toLowerCase() ? ' active' : ''}`}
              style={{ background: p.color }}
              title={p.label}
              onClick={() => onAccent(p.color)}
            />
          ))}
          <label className="accent-custom" title="사용자 지정 색상">
            <input
              type="color"
              value={currentAccent}
              onChange={(e) => onAccent(e.target.value)}
            />
            <span>사용자 지정</span>
          </label>
        </div>
        <div className="accent-preview">
          <span className="accent-chip" style={{ background: currentAccent }} />
          <code>{currentAccent.toUpperCase()}</code>
        </div>
      </div>
    </div>
  );
}
