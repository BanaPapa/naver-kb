import React from 'react';
import {
  AppSettings,
  ControlTextRole,
  ControlTextStyle,
  DEFAULT_SETTINGS,
  FONT_OPTIONS,
  ResultDensity,
} from '../../services/settings';

interface DisplaySettingsProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
}

const DENSITY: { key: ResultDensity; label: string }[] = [
  { key: 'comfortable', label: '넓게' },
  { key: 'compact', label: '좁게' },
];

const CONTROL_TEXT_ROLES: { key: ControlTextRole; label: string; hint: string }[] = [
  { key: 'title', label: '제목', hint: '지역 선택, 상품종류, 표시기간, 거래지표 보기' },
  { key: 'item', label: '항목', hint: '선택자 값, 지역명, 이동평균 ON 등 주요 값' },
  { key: 'description', label: '설명글', hint: '대지역(시/도·집계), 분기 눈금, 보조 안내' },
  { key: 'button1', label: '버튼 1', hint: '1년, 3년, 전체, 이동평균 ON 같은 보조 버튼' },
  { key: 'button2', label: '버튼 2', hint: '데이터 수집 실행, 추가 같은 주요 실행 버튼' },
];

const FONT_BY_KEY = new Map(FONT_OPTIONS.map((f) => [f.key, f]));
const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export function DisplaySettings({ settings, onUpdate }: DisplaySettingsProps) {
  const updateControlText = (role: ControlTextRole, patch: Partial<ControlTextStyle>) => {
    onUpdate({
      controlText: {
        ...settings.controlText,
        [role]: {
          ...settings.controlText[role],
          ...patch,
        },
      },
    });
  };

  const resetControlText = () => {
    onUpdate({ controlText: DEFAULT_SETTINGS.controlText });
  };

  return (
    <div className="settings-page">
      <h2 className="settings-title">표시 설정</h2>
      <p className="settings-subnote">
        앱 전체의 표시 방식을 설정합니다. 네비게이션/검색 조건 패널 설정은 매물시세와 KB 시계열 분석에 함께 적용됩니다.
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

      <div className="settings-card">
        <div className="settings-card-head">
          <div>
            <h3 className="settings-card-title">네비게이션 패널 텍스트</h3>
            <p className="settings-note">
              좌측 검색 조건 패널의 제목, 항목, 설명글, 버튼 텍스트를 역할별로 조절합니다.
            </p>
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={resetControlText}>
            기본값
          </button>
        </div>

        <div className="control-text-grid">
          {CONTROL_TEXT_ROLES.map((role) => {
            const style = settings.controlText[role.key];
            const colorValue = isHexColor(style.color) ? style.color : '#e8ecf5';
            const fontLabel = FONT_BY_KEY.get(style.fontFamily)?.label ?? style.fontFamily;

            return (
              <section key={role.key} className="control-text-row">
                <div className="control-text-meta">
                  <span className="control-text-label">{role.label}</span>
                  <span className="control-text-hint">{role.hint}</span>
                  <span
                    className="control-text-preview"
                    style={{
                      fontFamily: FONT_BY_KEY.get(style.fontFamily)?.stack,
                      fontSize: `${style.fontSize}px`,
                      fontWeight: style.fontWeight,
                      color: style.color,
                    }}
                  >
                    미리보기
                  </span>
                </div>

                <label className="control-text-field">
                  <span>크기</span>
                  <div className="control-text-range">
                    <input
                      type="range"
                      className="settings-range"
                      min={9}
                      max={24}
                      step={0.5}
                      value={style.fontSize}
                      onChange={(e) => updateControlText(role.key, { fontSize: Number(e.target.value) })}
                    />
                    <b>{style.fontSize}px</b>
                  </div>
                </label>

                <label className="control-text-field">
                  <span>글꼴</span>
                  <select
                    className="form-select"
                    value={style.fontFamily}
                    title={fontLabel}
                    onChange={(e) => updateControlText(role.key, {
                      fontFamily: e.target.value as AppSettings['fontFamily'],
                    })}
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </label>

                <label className="control-text-field">
                  <span>굵기</span>
                  <select
                    className="form-select"
                    value={style.fontWeight}
                    onChange={(e) => updateControlText(role.key, { fontWeight: Number(e.target.value) })}
                  >
                    <option value={400}>400</option>
                    <option value={500}>500</option>
                    <option value={600}>600</option>
                    <option value={700}>700</option>
                    <option value={800}>800</option>
                  </select>
                </label>

                <label className="control-text-field">
                  <span>색상</span>
                  <div className="control-text-color">
                    <input
                      type="color"
                      value={colorValue}
                      onChange={(e) => updateControlText(role.key, { color: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => updateControlText(role.key, {
                        color: DEFAULT_SETTINGS.controlText[role.key].color,
                      })}
                    >
                      테마값
                    </button>
                  </div>
                </label>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
