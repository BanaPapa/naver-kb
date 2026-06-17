import React, { useEffect, useState } from 'react';
import {
  getStoredCookie, setStoredCookie, clearStoredCookie,
  getStoredBearer, setStoredBearer, clearStoredBearer,
} from '../services/naverApi';

export function CookieSettings() {
  const [hasCookie, setHasCookie]         = useState(false);
  const [cookiePreview, setCookiePreview] = useState('');
  const [cookieInput, setCookieInput]     = useState('');
  const [cookieMsg, setCookieMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [hasBearer, setHasBearer]         = useState(false);
  const [bearerPreview, setBearerPreview] = useState('');
  const [bearerInput, setBearerInput]     = useState('');
  const [bearerMsg, setBearerMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadCookieStatus = () => {
    const cookie = getStoredCookie();
    setHasCookie(!!cookie);
    setCookiePreview(cookie ? cookie.slice(0, 40) + '...' : '');
  };

  const loadBearerStatus = () => {
    const token = getStoredBearer();
    setHasBearer(!!token);
    setBearerPreview(token ? token.slice(0, 30) + '...' : '');
  };

  useEffect(() => {
    loadCookieStatus();
    loadBearerStatus();
  }, []);

  const handleCookieSave = () => {
    const trimmed = cookieInput.trim();
    if (!trimmed) { setCookieMsg({ type: 'err', text: '쿠키를 입력해주세요' }); return; }
    setStoredCookie(trimmed);
    setCookieMsg({ type: 'ok', text: '쿠키가 저장되었습니다' });
    setCookieInput('');
    loadCookieStatus();
  };

  const handleCookieClear = () => {
    clearStoredCookie();
    setCookieMsg({ type: 'ok', text: '쿠키가 삭제되었습니다' });
    loadCookieStatus();
  };

  const handleBearerSave = () => {
    const trimmed = bearerInput.trim();
    if (!trimmed) { setBearerMsg({ type: 'err', text: '토큰을 입력해주세요' }); return; }
    setStoredBearer(trimmed);
    setBearerMsg({ type: 'ok', text: 'Bearer 토큰이 저장되었습니다' });
    setBearerInput('');
    loadBearerStatus();
  };

  const handleBearerClear = () => {
    clearStoredBearer();
    setBearerMsg({ type: 'ok', text: '토큰이 삭제되었습니다' });
    loadBearerStatus();
  };

  return (
    <div className="settings-page">
      <h2 className="settings-title">인증 설정</h2>

      {/* ── 쿠키 ── */}
      <div className="settings-card">
        <h3 className="settings-card-title">쿠키 (모든 상품 유형 필수)</h3>

        <div className="settings-status">
          <span className="settings-label">현재 상태:</span>
          {hasCookie ? (
            <span className="status-ok">✓ 설정됨 <span className="cookie-preview">{cookiePreview}</span></span>
          ) : (
            <span className="status-err">✕ 미설정</span>
          )}
        </div>

        <div className="settings-guide">
          <h4>쿠키 가져오는 방법</h4>
          <ol>
            <li>Chrome에서 <code>fin.land.naver.com</code> 접속 후 로그인</li>
            <li>F12 → Network 탭 → 아무 요청 클릭</li>
            <li>Request Headers → <code>Cookie</code> 값 전체 복사</li>
          </ol>
          <p className="settings-note">
            💡 localStorage에만 저장되며 외부로 전송되지 않습니다.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">쿠키 붙여넣기</label>
          <textarea
            className="cookie-textarea"
            rows={5}
            placeholder="NID_AUT=...; NID_SES=...; ..."
            value={cookieInput}
            onChange={(e) => setCookieInput(e.target.value)}
          />
        </div>

        {cookieMsg && (
          <div className={`settings-message ${cookieMsg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>
            {cookieMsg.text}
          </div>
        )}

        <div className="settings-actions">
          <button className="btn-primary" onClick={handleCookieSave} disabled={!cookieInput.trim()}>
            쿠키 저장
          </button>
          {hasCookie && (
            <button className="btn-ghost" onClick={handleCookieClear}>쿠키 삭제</button>
          )}
        </div>
      </div>

      {/* ── Bearer 토큰 (자동 발급 — 수동 입력은 폴백) ── */}
      <div className="settings-card">
        <h3 className="settings-card-title">Bearer 토큰 (자동 발급 — 보통 비워두세요)</h3>

        <div className="settings-status">
          <span className="settings-label">현재 상태:</span>
          {hasBearer ? (
            <span className="status-ok">✓ 설정됨 <span className="cookie-preview">{bearerPreview}</span></span>
          ) : (
            <span className="status-err">✕ 미설정</span>
          )}
        </div>

        <div className="settings-guide">
          <p className="settings-note">
            💡 빌라·단독/다가구 검색 시, 위 쿠키만 설정돼 있으면 서버가 자동으로 토큰을
            발급합니다. 이 칸은 <strong>비워두세요.</strong>
          </p>
          <h4>수동 입력이 필요한 경우 (자동 발급 실패 시)</h4>
          <ol>
            <li>Chrome에서 <code>new.land.naver.com/houses</code> 접속 후 로그인</li>
            <li>F12 → Network 탭 → <code>articles</code> 요청 클릭</li>
            <li>Request Headers → <code>authorization</code> 값에서 <code>Bearer </code> 뒷부분만 복사</li>
          </ol>
          <p className="settings-note">
            ⚠️ 수동 입력한 토큰은 약 3시간마다 만료됩니다. 401 오류 시 재설정하거나 칸을 비워
            자동 발급을 사용하세요.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Bearer 토큰 붙여넣기</label>
          <textarea
            className="cookie-textarea"
            rows={3}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={bearerInput}
            onChange={(e) => setBearerInput(e.target.value)}
          />
        </div>

        {bearerMsg && (
          <div className={`settings-message ${bearerMsg.type === 'ok' ? 'msg-ok' : 'msg-err'}`}>
            {bearerMsg.text}
          </div>
        )}

        <div className="settings-actions">
          <button className="btn-primary" onClick={handleBearerSave} disabled={!bearerInput.trim()}>
            토큰 저장
          </button>
          {hasBearer && (
            <button className="btn-ghost" onClick={handleBearerClear}>토큰 삭제</button>
          )}
        </div>
      </div>
    </div>
  );
}
