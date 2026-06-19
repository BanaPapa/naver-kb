import React from 'react';
import { ProgressInfo, DoneSummary } from '../types';
import { CrawlerStatus } from '../hooks/useCrawler';
import { formatPriceByUnit, PriceUnit } from '../services/api';
import { TableStats } from './ResultTable';

interface MonitorProps {
  status: CrawlerStatus;
  progress: ProgressInfo | null;
  summary: DoneSummary | null;
  propertyCount: number;
  tableStats: TableStats | null;
  priceUnit: PriceUnit;
  isPresale: boolean;
}

export function Monitor({ status, progress, summary, propertyCount, tableStats, priceUnit, isPresale }: MonitorProps) {
  const progressPct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const phaseLabel = progress?.phase === 'search' ? '단지 검색' : '매물 수집';
  const stageValue = progress ? `${progress.current} / ${progress.total}` : '–';
  const complexValue = summary ? summary.totalComplexes.toLocaleString() : '–';
  const durationValue = summary ? `${Math.round(summary.duration / 1000)}초` : '–';

  const hasStats = tableStats && tableStats.count > 0;
  const avgDealStr = hasStats ? formatPriceByUnit(tableStats.avgDealPrice, priceUnit) : '–';
  const avgPyeongStr = hasStats ? formatPriceByUnit(tableStats.avgPyeongPrice, priceUnit) : '–';
  const avgPresaleStr = (hasStats && isPresale && tableStats.avgPresaleTotal > 0)
    ? formatPriceByUnit(tableStats.avgPresaleTotal, priceUnit)
    : null;
  const unitLabel = priceUnit === 'thousand' ? '천원' : '만원';

  return (
    <>
      <div className="eos-kpis">
        <div className="eos-kpi t">
          <div className="kl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 7h7v14H3zM14 3h7v18h-7z" />
            </svg>
            수집된 매물
          </div>
          <div className="kv accent tnum">{propertyCount.toLocaleString()}</div>
          <div className="kd">건</div>
        </div>

        <div className="eos-kpi avg">
          <div className="kl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            평균 매매가
          </div>
          <div className="kv tnum">{avgDealStr}</div>
          {avgPresaleStr ? (
            <div className="kd">
              <span className="kd-presale">분양권 {avgPresaleStr}{unitLabel}</span>
            </div>
          ) : (
            <div className="kd">{hasStats ? unitLabel : '대기'}</div>
          )}
        </div>

        <div className="eos-kpi pyeong">
          <div className="kl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M9 21V9" />
            </svg>
            평균 평당가
          </div>
          <div className="kv tnum">{avgPyeongStr}</div>
          <div className="kd">{hasStats ? `${unitLabel}/평` : '대기'}</div>
        </div>

        <div className="eos-kpi b">
          <div className="kl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M21 12a9 9 0 1 1-6.2-8.6" />
              <path d="M21 4v5h-5" />
            </svg>
            {phaseLabel}
          </div>
          <div className="kv tnum">{stageValue}</div>
          <div className="kd">{status === 'running' ? '진행 중' : '진행 단계'}</div>
        </div>

        <div className="eos-kpi p">
          <div className="kl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M5 21h14M6 21V8l6-4 6 4v13" />
            </svg>
            완료 단지
          </div>
          <div className="kv tnum">{complexValue}</div>
          <div className="kd">단지</div>
        </div>

        <div className="eos-kpi a">
          <div className="kl">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            소요 시간
          </div>
          <div className="kv tnum">{durationValue}</div>
          <div className="kd">{summary ? '완료' : '대기'}</div>
        </div>
      </div>

      {progress && status === 'running' && (
        <div className="nv-progress">
          {progress.complexName && (
            <div className="nv-progress-name">{progress.complexName}</div>
          )}
          <div className="nv-progress-bar">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <div className="nv-progress-pct">{progressPct}%</div>
        </div>
      )}
    </>
  );
}
