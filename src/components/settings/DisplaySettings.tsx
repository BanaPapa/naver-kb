import React from 'react';
import { AppSettings, FONT_OPTIONS, ResultDensity } from '../../services/settings';

interface DisplaySettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

const DENSITY: { key: ResultDensity; label: string }[] = [
  { key: 'comfortable', label: '넓게' },
  { key: 'compact', label: '좁게' },
];

export function DisplaySettings({ settings, onUpdate }: DisplaySettingsProps) {
  return (
    <div className="settings-page">
      <h2 className="settings-title">표시 설정 · 매물시세</h2>
      <p className="settings-subnote">
        현재 모듈(매물시세)의 표시 방식을 설정합니다. 추후 다른 모듈에도 개별 적용할 예정입니다.
      </p>

      <div className="settings-card">
        <h3 className="settings-card-title">글꼴</h3>
        <div className="select-wrapper">
          <select
            className="form-select"
            value={settings.fontFamily}
            onChange={(e) => onUpdate({ fontFamily: e.target.value as AppSettings['fontFamily'] })}
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">화면 배율 (글씨 크기)</h3>
        <p className="settings-note">전체 UI를 비율로 키우거나 줄입니다.</p>
        <div className="scale-row">
          <input
            type="range"
            className="settings-range"
            min={0.85}
            max={1.3}
            step={0.05}
            value={settings.uiScale}
            onChange={(e) => onUpdate({ uiScale: Number(e.target.value) })}
          />
          <span className="scale-value">{Math.round(settings.uiScale * 100)}%</span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => onUpdate({ uiScale: 1 })}>
            기본값
          </button>
        </div>
      </div>

      <div className="settings-card">
        <h3 className="settings-card-title">검색 결과 밀도</h3>
        <p className="settings-note">결과 표의 행 간격을 조절합니다.</p>
        <div className="seg-toggle">
          {DENSITY.map((d) => (
            <button
              key={d.key}
              type="button"
              className={`seg-btn${settings.resultDensity === d.key ? ' active' : ''}`}
              onClick={() => onUpdate({ resultDensity: d.key })}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
