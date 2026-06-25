import React, { useState } from 'react';
import { AppSettings } from '../services/settings';
import { ThemeSettings } from './settings/ThemeSettings';
import { DisplaySettings } from './settings/DisplaySettings';
import { CookieSettings } from './CookieSettings';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onAccent: (color: string) => void;
}

type SettingsSection = 'theme' | 'display' | 'auth';

interface SectionDef {
  key: SettingsSection;
  label: string;
  icon: React.JSX.Element;
}

// 설정 서브 네비게이션 — 좌측 모듈 네비와 역할이 다른 '설정 도메인' 전환.
const SECTIONS: SectionDef[] = [
  {
    key: 'theme',
    label: '테마 & 색상',
    icon: (
      <svg className="ic" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.5 1-2.5s-.5-2.5 1.5-2.5H17a4 4 0 0 0 4-4c0-4.5-4-7-9-7z" />
      </svg>
    ),
  },
  {
    key: 'display',
    label: '표시 설정',
    icon: (
      <svg className="ic" viewBox="0 0 24 24">
        <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
        <path d="M9 20h6M12 4v16" />
      </svg>
    ),
  },
  {
    key: 'auth',
    label: '인증',
    icon: (
      <svg className="ic" viewBox="0 0 24 24">
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
];

export function SettingsPage({ settings, onUpdate, onAccent }: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSection>('theme');

  return (
    <div className="settings-shell">
      <nav className="settings-subnav">
        <div className="settings-subnav-head">설정</div>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`settings-subnav-item${section === s.key ? ' active' : ''}`}
            onClick={() => setSection(s.key)}
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="settings-content">
        {section === 'theme' && (
          <ThemeSettings settings={settings} onUpdate={onUpdate} onAccent={onAccent} />
        )}
        {section === 'display' && (
          <DisplaySettings settings={settings} onUpdate={onUpdate} />
        )}
        {section === 'auth' && <CookieSettings />}
      </div>
    </div>
  );
}
