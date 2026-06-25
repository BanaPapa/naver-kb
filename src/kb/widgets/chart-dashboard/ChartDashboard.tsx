import React, { useEffect, useMemo } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { WEEKLY_METRICS, DEFAULT_CHART_OPTIONS, type MetricKey } from '../../shared/config';
import { computeDynamicYConfig, type DynamicYOptions } from '../../shared/config/y-axis';
import {
  type ChartRow,
  nearestDateIndex,
  buildChartData,
  MetricChart,
  useBrushRange,
} from './chart-primitives';
import { YAxisControl } from '../weekly-trade-dashboard/YAxisControl';

// 지수 메트릭(기준일 100 리베이스 대상) 판별
function isIndexMetric(key: MetricKey): boolean {
  return key.endsWith('Index');
}

// 차트별 동적 Y축 옵션 — 증감·누적변동률만 음수 허용(나머지는 0 이상).
function priceYOpts(id: string): DynamicYOptions {
  const allowNegative = id.endsWith('Change') || id.endsWith('Cumulative');
  return { allowNegative };
}

// 기준일 표기: (2026.1.12=100.0)
function formatBaseNote(dateStr: string): string {
  const d = new Date(dateStr);
  return `(${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}=100.0)`;
}

// 누적변동률 표기: (2026.1.12 대비)
function formatCumulativeNote(dateStr: string): string {
  const d = new Date(dateStr);
  return `(${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} 대비)`;
}

// 지수의 전주대비 변동률(%): (지수ₜ / 지수ₜ₋₁ − 1) × 100.
// 리베이스된 지수에서 파생하므로 증감이 지수 변화에 연동된다.
function toWeekOverWeek(rows: ChartRow[], selectedRegions: string[]): ChartRow[] {
  return rows.map((r, i) => {
    const out: ChartRow = { date: r.date };
    const prev = i > 0 ? rows[i - 1]! : null;
    for (const region of selectedRegions) {
      const v = r[region];
      const p = prev ? prev[region] : null;
      out[region] =
        prev && typeof v === 'number' && typeof p === 'number' && p !== 0 ? (v / p - 1) * 100 : null;
    }
    return out;
  });
}

// 누적 변동률(%): 표시 구간의 시작점을 0으로 해 종료일까지의 누적 변화.
// 각 지역별로 구간 내 첫 유효값을 기준(0)으로 (값/기준 − 1) × 100.
function toCumulative(slicedRows: ChartRow[], selectedRegions: string[]): ChartRow[] {
  if (slicedRows.length === 0) return [];
  const ref: Record<string, number> = {};
  for (const region of selectedRegions) {
    for (const row of slicedRows) {
      const v = row[region];
      if (typeof v === 'number') {
        ref[region] = v;
        break;
      }
    }
  }
  return slicedRows.map(r => {
    const out: ChartRow = { date: r.date };
    for (const region of selectedRegions) {
      const v = r[region];
      const base = ref[region];
      out[region] =
        typeof v === 'number' && typeof base === 'number' && base !== 0 ? (v / base - 1) * 100 : null;
    }
    return out;
  });
}

export const ChartDashboard: React.FC = () => {
  const {
    weeklyData,
    selectedRegions,
    regionLabels,
    dataLoading,
    dataError,
    loadWeeklyData,
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    baseDate,
  } = useAppStore();
  const baseLineOn = useMonthlyStore(s => s.baseLineOn);
  const yRanges = useMonthlyStore(s => s.yRanges);
  const setYRange = useMonthlyStore(s => s.setYRange);
  const clearYRanges = useMonthlyStore(s => s.clearYRanges);
  const consumeSkipYRangeClear = useMonthlyStore(s => s.consumeSkipYRangeClear);
  const chartOptions = useMonthlyStore(s => s.chartOptions);
  const setChartOptions = useMonthlyStore(s => s.setChartOptions);

  // 기간·지역·기준일이 바뀌면 표시 데이터가 달라지므로 수동 Y축 override를 해제 → 자동 재계산.
  useEffect(() => {
    if (consumeSkipYRangeClear('wp:')) return; // 슬롯 복원 직후 1회 건너뜀
    clearYRanges('wp:');
  }, [clearYRanges, consumeSkipYRangeClear, fromDate, toDate, baseDate, selectedRegions]);

  const chartDataByMetric = useMemo(() => {
    if (weeklyData.length === 0 || selectedRegions.length === 0) return null;
    // 지수는 기준일=100으로 리베이스
    const saleIndex = buildChartData(weeklyData, selectedRegions, 'saleIndex', true, baseDate);
    const jeonseIndex = buildChartData(weeklyData, selectedRegions, 'jeonseIndex', true, baseDate);
    // 증감은 리베이스된 지수에서 직접 파생(전주대비 변동률) → 지수 변화에 연동
    const saleChange = toWeekOverWeek(saleIndex, selectedRegions);
    const jeonseChange = toWeekOverWeek(jeonseIndex, selectedRegions);
    return { saleIndex, jeonseIndex, saleChange, jeonseChange } as Record<MetricKey, ChartRow[]>;
  }, [weeklyData, selectedRegions, baseDate]);

  // 모든 차트가 공유하는 날짜 축
  const dates = useMemo(() => {
    if (!chartDataByMetric) return [] as string[];
    return chartDataByMetric[WEEKLY_METRICS[0].key].map(d => d.date);
  }, [chartDataByMetric]);

  // 기준일을 실제 데이터 날짜로 스냅(지수=100 표기에 사용)
  const snappedBaseDate = useMemo(() => {
    if (!dates.length) return baseDate;
    const i = nearestDateIndex(dates, baseDate);
    return dates[i] ?? baseDate;
  }, [dates, baseDate]);

  const { startIndex, endIndex } = useBrushRange(dates, fromDate, toDate, setFromDate, setToDate);

  // 선택 구간으로 잘라낸 데이터(각 차트는 이 구간만 표시)
  const slicedDataByMetric = useMemo(() => {
    if (!chartDataByMetric) return null;
    return Object.fromEntries(
      WEEKLY_METRICS.map(m => [m.key, chartDataByMetric[m.key].slice(startIndex, endIndex + 1)]),
    ) as Record<MetricKey, ChartRow[]>;
  }, [chartDataByMetric, startIndex, endIndex]);

  // 화면에 그릴 6개 차트: 지수 2 + 증감 2 + 누적변동률 2
  const chartViews = useMemo(() => {
    if (!slicedDataByMetric) return [];
    const baseNote = formatBaseNote(snappedBaseDate);
    // 누적변동률 기준 = 표시 구간의 시작일
    const startDate = slicedDataByMetric.saleIndex?.[0]?.date;
    const cumNote = startDate ? formatCumulativeNote(startDate) : undefined;
    const views: { id: string; title: string; subtitle?: string; unit: string; data: ChartRow[] }[] =
      WEEKLY_METRICS.map(m => ({
        id: m.key,
        title: m.label,
        subtitle: isIndexMetric(m.key) ? baseNote : undefined,
        unit: m.unit,
        data: slicedDataByMetric[m.key] ?? [],
      }));
    views.push(
      {
        id: 'saleCumulative',
        title: '매매 누적변동률',
        subtitle: cumNote,
        unit: '%',
        data: toCumulative(slicedDataByMetric.saleIndex ?? [], selectedRegions),
      },
      {
        id: 'jeonseCumulative',
        title: '전세 누적변동률',
        subtitle: cumNote,
        unit: '%',
        data: toCumulative(slicedDataByMetric.jeonseIndex ?? [], selectedRegions),
      },
    );
    return views;
  }, [slicedDataByMetric, snappedBaseDate, selectedRegions]);

  if (selectedRegions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-2">지역을 선택해주세요</p>
          <p className="text-gray-300 text-sm">좌측에서 지역을 추가하면 자동으로 표시됩니다</p>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-red-200 shadow-sm">
        <div className="text-center">
          <p className="text-red-500 text-sm mb-3">데이터 로딩 실패: {dataError}</p>
          <button
            onClick={loadWeeklyData}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            재시도
          </button>
        </div>
      </div>
    );
  }

  if (!chartDataByMetric || !slicedDataByMetric) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="text-center">
          <p className="text-gray-400 text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 6개 그래프 — 남은 높이를 3×2로 가득 채움 (지수·증감·누적변동률) */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2 xl:grid-rows-3">
        {chartViews.map(view => {
          const cfg = computeDynamicYConfig(view.data, selectedRegions, priceYOpts(view.id));
          const range = cfg ? yRanges[`wp:${view.id}`] ?? { min: cfg.min, max: cfg.max } : undefined;
          return (
            <MetricChart
              key={view.id}
              title={view.title}
              subtitle={view.subtitle}
              unit={view.unit}
              data={view.data}
              selectedRegions={selectedRegions}
              regionLabels={regionLabels}
              baseLineDate={snappedBaseDate}
              showBaseLine={baseLineOn}
              yDomain={range ? [range.min, range.max] : undefined}
              yTickStep={cfg?.tickStep}
              yTickDecimals={cfg?.decimals}
              chartOptions={chartOptions[`wp:${view.id}`] ?? DEFAULT_CHART_OPTIONS}
              onChartOptionsChange={patch => setChartOptions(`wp:${view.id}`, patch)}
              headerRight={
                cfg && range ? (
                  <YAxisControl
                    min={range.min}
                    max={range.max}
                    minOptions={cfg.minOptions}
                    maxOptions={cfg.maxOptions}
                    decimals={cfg.decimals}
                    onChange={(mn, mx) => setYRange(`wp:${view.id}`, mn, mx)}
                  />
                ) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
};
