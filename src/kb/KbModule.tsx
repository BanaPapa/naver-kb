import { type FC, useState } from 'react';
import { StoreProvider } from './app/providers';
import { RegionSelector } from './widgets/region-selector';
import { ChartDashboard } from './widgets/chart-dashboard';
import { TradeDashboard } from './widgets/weekly-trade-dashboard';
import { MonthlyRegionCascade } from './widgets/monthly-region-cascade';
import { MonthlyChartDashboard } from './widgets/monthly-chart-dashboard';
import { MonthlyTradeDashboard } from './widgets/monthly-trade-dashboard';
import { MonthlyMarketDashboard } from './widgets/monthly-market-dashboard';
import { useAppStore } from './shared/lib/store';
import { useMonthlyStore, type ViewMode, type WeeklyTab } from './shared/lib/monthly-store';
import { AnalysisModal } from './features/analysis';
import { SlotControls } from './features/chart-slots';
import { ExportButton } from './features/data-export';

// KB 시계열 분석 모듈 — 통합 셸(naver-kb)의 'KB 시계열 분석' 탭에서 렌더된다.
// 원본 KB 앱의 App.tsx에서 좌측 사이드바(AppNav)와 eos-app 래퍼를 제거하고
// 콘텐츠(헤더 + 작업영역 + 분석 모달)만 호스트의 eos-main 안에 마운트한다.
// 모든 KB 스타일은 .kb-scope 로 한정(kb-shell.css)되어 매물시세 화면에 영향이 없다.

const MODE_TABS: { key: ViewMode; label: string }[] = [
  { key: 'weekly', label: '주간' },
  { key: 'monthly', label: '월간' },
];

// 시세·거래는 주간·월간 공용, 시장지표는 월간 전용.
const WEEKLY_TABS: { key: WeeklyTab; label: string }[] = [
  { key: 'price', label: '시세지표' },
  { key: 'trade', label: '거래지표' },
];
const MONTHLY_TABS: { key: WeeklyTab; label: string }[] = [
  ...WEEKLY_TABS,
  { key: 'market', label: '시장지표' },
];

const TAB_LABEL: Record<WeeklyTab, string> = {
  price: '시세지표',
  trade: '거래지표',
  market: '시장지표',
};

// 주간 뷰: 시세지표 / 거래지표
const WeeklyView: FC = () => {
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);
  return weeklyTab === 'trade' ? <TradeDashboard /> : <ChartDashboard />;
};

// 월간 뷰: 시세지표 / 거래지표 / 시장지표
const MonthlyView: FC = () => {
  const weeklyTab = useMonthlyStore(s => s.weeklyTab);
  if (weeklyTab === 'trade') return <MonthlyTradeDashboard />;
  if (weeklyTab === 'market') return <MonthlyMarketDashboard />;
  return <MonthlyChartDashboard />;
};

// 브레드크럼 헤더 — 분석 모듈 경로 + 우측 액션
const ShellHeader: FC<{ onOpenAnalysis: () => void }> = ({ onOpenAnalysis }) => {
  const { latestDate, totalRecords } = useAppStore();

  return (
    <header className="eos-hdr">
      <div className="eos-crumb">
        <svg className="home" viewBox="0 0 24 24">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
        <svg className="sep" viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <span>분석 모듈</span>
        <svg className="sep" viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" />
        </svg>
        <b>KB 시계열 분석</b>
        <span className="tag">LIVE</span>
      </div>

      <div className="eos-hdr-right">
        {(latestDate || totalRecords > 0) && (
          <span className="eos-pill tnum">
            <span className="d t" />
            {latestDate ? `최신 ${latestDate}` : ''}
            {latestDate && totalRecords > 0 ? ' · ' : ''}
            {totalRecords > 0 ? `${totalRecords.toLocaleString()}건` : ''}
          </span>
        )}
        <SlotControls />
        <ExportButton />
        <button className="eos-btn-primary" onClick={onOpenAnalysis}>
          <svg viewBox="0 0 24 24">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          분석
        </button>
      </div>
    </header>
  );
};

const KbModule: FC = () => {
  const { mode, setMode, weeklyTab, setWeeklyTab } = useMonthlyStore();
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [ctrlCollapsed, setCtrlCollapsed] = useState(false);

  const tabs = mode === 'monthly' ? MONTHLY_TABS : WEEKLY_TABS;
  const title = `${mode === 'monthly' ? '월간' : '주간'} ${TAB_LABEL[weeklyTab]}`;

  return (
    <StoreProvider>
      {/* display:contents → .kb-scope 박스를 만들지 않아 호스트 eos-main 레이아웃을
          그대로 사용하면서도 .kb-scope 한정 스타일은 정상 적용된다. */}
      <div className="kb-scope" style={{ display: 'contents' }}>
        <ShellHeader onOpenAnalysis={() => setAnalysisOpen(true)} />

        <div className={`eos-work${ctrlCollapsed ? ' ctrl-collapsed' : ''}`}>
          {/* 검색 조건 패널 — 지역 선택/컨트롤 */}
          <div className="eos-ctrl">
            <div className="eos-ctrl-head">
              <span className="ch-ic">
                <svg viewBox="0 0 24 24">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
              </span>
              <b>검색 조건</b>
              <button
                className="eos-ctrl-toggle"
                title="패널 접기"
                onClick={() => setCtrlCollapsed(v => !v)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            </div>
            <div className="eos-ctrl-body">
              {mode === 'weekly' ? <RegionSelector /> : <MonthlyRegionCascade />}
            </div>
          </div>

          {/* 뷰 — 차트/대시보드 */}
          <div className="eos-view">
            <div className="eos-mod-head">
              <h1>{title}</h1>
              <div className="mh-right">
                <div className="eos-seg">
                  {MODE_TABS.map(t => (
                    <button
                      key={t.key}
                      className={`eos-seg-btn${mode === t.key ? ' active' : ''}`}
                      onClick={() => setMode(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="eos-seg">
                  {tabs.map(t => (
                    <button
                      key={t.key}
                      className={`eos-seg-btn${weeklyTab === t.key ? ' active' : ''}`}
                      onClick={() => setWeeklyTab(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {mode === 'weekly' ? <WeeklyView /> : <MonthlyView />}
          </div>
        </div>

        <AnalysisModal open={analysisOpen} onClose={() => setAnalysisOpen(false)} />
      </div>
    </StoreProvider>
  );
};

export default KbModule;
