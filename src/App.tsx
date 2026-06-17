import React, { useState } from 'react';
import { Sidebar, AppTab } from './components/Sidebar';
import { NaverCrawlerTab } from './components/NaverCrawlerTab';
import { SettingsPage } from './components/SettingsPage';
import { LoginScreen } from './components/auth/LoginScreen';
import { useCrawler } from './hooks/useCrawler';
import { useSlots } from './hooks/useSlots';
import { useSettings } from './hooks/useSettings';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('naver');
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const auth = useAuth();
  const crawler = useCrawler();
  const slots = useSlots(auth.user?.id ?? null);
  const { settings, update, setAccent } = useSettings();
  const { status, properties } = crawler.state;

  const isSettings = activeTab === 'settings';

  // Supabase가 설정된 경우에만 로그인 게이트 적용. 미설정이면 기존처럼 바로 사용.
  if (auth.configured && auth.loading) {
    return <div className="auth-screen"><div className="auth-loading">불러오는 중…</div></div>;
  }
  if (auth.configured && !auth.user) {
    return <LoginScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />;
  }

  const wsState =
    status === 'running' ? 'run' : status === 'idle' ? 'off' : '';
  const statusText =
    status === 'running'
      ? '데이터 수집 중'
      : status === 'done'
        ? `${properties.length.toLocaleString()}건 수집됨`
        : status === 'stopped'
          ? '수집 중지됨'
          : status === 'error'
            ? '오류 발생'
            : '네이버 부동산 · 대기 중';

  return (
    <div className={`eos-app${sideCollapsed ? ' side-collapsed' : ''}`}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        collapsed={sideCollapsed}
        onToggleCollapse={() => setSideCollapsed((v) => !v)}
        userEmail={auth.user?.email ?? null}
        onSignOut={auth.configured ? auth.signOut : undefined}
      />

      <div className="eos-main">
        <header className="eos-hdr">
          <div className="eos-crumb">
            <svg className="home" viewBox="0 0 24 24">
              <path d="M3 11l9-7 9 7" />
              <path d="M5 10v10h14V10" />
            </svg>
            <svg className="sep" viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" />
            </svg>
            <span>{isSettings ? '시스템' : '분석 모듈'}</span>
            <svg className="sep" viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" />
            </svg>
            <b>{isSettings ? '인증 설정' : '매물시세'}</b>
            {!isSettings && <span className="tag">LIVE</span>}
          </div>

          {!isSettings && (
            <div className="eos-hdr-right">
              <div className={`eos-ws ${wsState}`}>
                <span className="wd" />
                <span>{statusText}</span>
              </div>
            </div>
          )}
        </header>

        {/* 매물시세 탭은 항상 마운트 상태로 두고 설정 탭일 때만 숨긴다.
            (언마운트하면 단위/지역/필터 등 로컬 선택 상태가 초기화되는 문제 방지) */}
        <div style={{ display: isSettings ? 'none' : 'contents' }}>
          <NaverCrawlerTab crawler={crawler} slots={slots} />
        </div>
        {isSettings && (
          <SettingsPage settings={settings} onUpdate={update} onAccent={setAccent} />
        )}
      </div>
    </div>
  );
}
