import React, { useMemo } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { TRADE_METRICS, DEFAULT_CHART_OPTIONS, type MetricKey } from '../../shared/config';
import {
  type ChartRow,
  buildChartData,
  combineAverage,
  withMovingAverage,
  MetricChart,
  useBrushRange,
} from '../chart-dashboard/chart-primitives';
import { YAxisControl } from './YAxisControl';

const NEUTRAL = 100; // 확산지수 중립선

// 각 지표 설명(엑셀 원본 시트 정의 + 100 기준 해석)
const TRADE_INFO: Record<string, string> = {
  buyerAdvantage:
    '매수자/매도자 동향. 「매수자 많음」 비중에서 「매도자 많음」 비중을 빼고 100을 더한 확산지수(0~200, 100=중립). 100 초과 = 매수자가 더 많음(매수세 우위) → 가격 상승 압력. 100 미만 = 매도자가 더 많음.',
  jeonseSupply:
    '전세 수급 동향. 「수요>공급」 비중에서 「수요<공급」 비중을 빼고 100을 더한 확산지수(0~200, 100=중립). 100 초과 = 공급 부족(수요 우위) → 전세가 상승 압력. 100 미만 = 공급 충분.',
  saleActivity:
    '매매 거래 동향. 「활발함」 비중에서 「한산함」 비중을 빼고 100을 더한 확산지수(0~200, 100=중립). 100 초과 = 거래 활발. 100 미만 = 거래 한산(침체).',
  jeonseActivity:
    '전세 거래 동향. 「활발함」 비중에서 「한산함」 비중을 빼고 100을 더한 확산지수(0~200, 100=중립). 100 초과 = 전세 거래 활발. 100 미만 = 한산.',
  saleMarket:
    '매매시장 종합 = (매수우위 + 매매거래활발) ÷ 2. 매수심리와 거래활성을 합쳐 본 지표. 100 초과 = 매매시장 강세, 100 미만 = 약세.',
  jeonseMarket:
    '전세시장 종합 = (전세수급 + 전세거래활발) ÷ 2. 수급압력과 거래활성을 합쳐 본 지표. 100 초과 = 전세시장 강세, 100 미만 = 약세.',
};

export const TradeDashboard: React.FC = () => {
  const {
    tradeData,
    tradeLoading,
    selectedRegions,
    regionLabels,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
  } = useAppStore();

  // 보기 옵션: 이동평균(사이드바) + 그래프별 Y축 범위
  const { tradeMaOn, tradeMaWindow, tradeYRanges, setTradeYRange, chartOptions, setChartOptions } =
    useMonthlyStore();

  // 거래지표는 대지역/집계만 제공 — 데이터에 존재하는 지역만 그린다.
  const tradeRegionSet = useMemo(() => new Set(tradeData.map(r => r.region)), [tradeData]);
  const tradeRegions = useMemo(
    () => selectedRegions.filter(r => tradeRegionSet.has(r)),
    [selectedRegions, tradeRegionSet],
  );

  // 전체 기간 차트 데이터(지표별)
  const fullByMetric = useMemo(() => {
    if (tradeData.length === 0 || tradeRegions.length === 0) return null;
    return Object.fromEntries(
      TRADE_METRICS.map(m => [m.key, buildChartData(tradeData, tradeRegions, m.key, false, '')]),
    ) as Record<MetricKey, ChartRow[]>;
  }, [tradeData, tradeRegions]);

  const dates = useMemo(() => {
    if (!fullByMetric) return [] as string[];
    return fullByMetric[TRADE_METRICS[0].key].map(d => d.date);
  }, [fullByMetric]);

  const { startIndex, endIndex } = useBrushRange(dates, fromDate, toDate, setFromDate, setToDate);

  // 6개 차트(4개 기본 + 2개 종합). 전체기간에서 이동평균 부여 후 구간 슬라이스.
  const chartViews = useMemo(() => {
    if (!fullByMetric || tradeRegions.length === 0) return null;
    const slice = (rows: ChartRow[]) =>
      withMovingAverage(rows, tradeRegions, tradeMaWindow).slice(startIndex, endIndex + 1);

    type View = { id: string; title: string; subtitle?: string; unit: string; data: ChartRow[] };
    const base: View[] = TRADE_METRICS.map(m => ({
      id: m.key,
      title: m.label,
      unit: m.unit,
      data: slice(fullByMetric[m.key]),
    }));

    const saleMarket = combineAverage(fullByMetric.buyerAdvantage, fullByMetric.saleActivity, tradeRegions);
    const jeonseMarket = combineAverage(fullByMetric.jeonseSupply, fullByMetric.jeonseActivity, tradeRegions);
    const composites: View[] = [
      { id: 'saleMarket', title: '매매시장 종합', subtitle: '= (매수우위 + 매매거래활발) ÷ 2', unit: '', data: slice(saleMarket) },
      { id: 'jeonseMarket', title: '전세시장 종합', subtitle: '= (전세수급 + 전세거래활발) ÷ 2', unit: '', data: slice(jeonseMarket) },
    ];
    return [...base, ...composites];
  }, [fullByMetric, tradeRegions, startIndex, endIndex, tradeMaWindow]);

  if (selectedRegions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">지역을 선택해주세요</p>
          <p className="text-gray-300 text-sm">거래지표는 대지역(시/도·집계)만 제공됩니다</p>
        </div>
      </div>
    );
  }

  if (tradeLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (tradeRegions.length === 0 || !chartViews) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-1">거래지표 데이터가 있는 지역이 없습니다</p>
          <p className="text-gray-300 text-xs">거래지표는 대지역(시/도·집계)만 제공됩니다 — 좌측에서 대지역을 추가하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 6개 그래프 (3×2) — 매수우위·전세수급 / 매매거래활발·전세거래활발 / 매매종합·전세종합 */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2 xl:grid-rows-3">
        {chartViews.map((view, i) => {
          const range = tradeYRanges[view.id] ?? { min: 0, max: 200 };
          return (
            <MetricChart
              key={view.id}
              title={view.title}
              subtitle={view.subtitle}
              info={TRADE_INFO[view.id]}
              infoAlign={i % 2 === 1 ? 'right' : 'left'}
              unit={view.unit}
              data={view.data}
              selectedRegions={tradeRegions}
              regionLabels={regionLabels}
              syncId="kb-weekly-trade"
              referenceValue={NEUTRAL}
              showMovingAverage={tradeMaOn}
              yDomain={[range.min, range.max]}
              chartOptions={chartOptions[`wt:${view.id}`] ?? DEFAULT_CHART_OPTIONS}
              onChartOptionsChange={patch => setChartOptions(`wt:${view.id}`, patch)}
              headerRight={
                <YAxisControl
                  min={range.min}
                  max={range.max}
                  onChange={(mn, mx) => setTradeYRange(view.id, mn, mx)}
                />
              }
            />
          );
        })}
      </div>
    </div>
  );
};
