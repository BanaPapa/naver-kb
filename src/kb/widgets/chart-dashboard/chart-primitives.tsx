// 주간 차트 공통 요소 — 시세지표/거래지표 대시보드가 함께 사용.
import React, { useEffect, useMemo, useRef } from 'react';
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import {
  CHART_COLORS,
  DEFAULT_CHART_OPTIONS,
  seriesChartType,
  type MetricKey,
  type ChartOptions,
} from '../../shared/config';
import type { WeeklyDataRow } from '../../entities/kb-data';
import { InfoTip } from '../../shared/ui/InfoTip';
import { formatNumber } from '../../shared/lib/format';
import { ChartOptionsControl } from './ChartOptionsControl';

// date(문자열)와 임의의 숫자 시리즈 컬럼을 갖는 차트 행.
// 선언된 date:string 과 호환되도록 인덱스 시그니처에 string 을 포함한다.
export type ChartRow = { date: string; [series: string]: number | string | null };

// 기준일과 가장 가까운 데이터 날짜의 인덱스
export function nearestDateIndex(dates: string[], target: string): number {
  if (!dates.length) return -1;
  const t = new Date(target).getTime();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < dates.length; i++) {
    const diff = Math.abs(new Date(dates[i]!).getTime() - t);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

// 평면 행들을 날짜별로 묶어 차트용 데이터로 변환.
// rebase=true 이면 지수를 기준일(baseDate) 값이 100이 되도록 지역별로 재정규화한다.
export function buildChartData(
  weeklyData: WeeklyDataRow[],
  selectedRegions: string[],
  metricKey: MetricKey,
  rebase: boolean,
  baseDate: string,
): ChartRow[] {
  const byDate = new Map<string, Record<string, number | null>>();

  for (const row of weeklyData) {
    if (!selectedRegions.includes(row.region)) continue;
    if (!byDate.has(row.date)) byDate.set(row.date, {});
    const entry = byDate.get(row.date)!;
    const value = row[metricKey as keyof WeeklyDataRow] as number | null;
    entry[row.region] = value;
  }

  const rows = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values })) as ChartRow[];

  if (!rebase || !baseDate || rows.length === 0) return rows;

  // 기준일(가장 가까운 데이터 날짜)에서의 지역별 기준값으로 나눠 100 기준 재정규화
  const baseRow = rows[nearestDateIndex(rows.map(r => r.date), baseDate)]!;
  return rows.map(r => {
    const out: ChartRow = { date: r.date };
    for (const region of selectedRegions) {
      const baseValue = baseRow[region];
      const value = r[region];
      out[region] =
        typeof baseValue === 'number' && baseValue !== 0 && typeof value === 'number'
          ? (value / baseValue) * 100
          : value;
    }
    return out;
  });
}

// 각 지역에 `${region}__ma` 이동평균(trailing) 키를 덧붙인다(원본 키는 유지).
export function withMovingAverage(rows: ChartRow[], regions: string[], window: number): ChartRow[] {
  return rows.map((r, i) => {
    const out: ChartRow = { ...r };
    for (const region of regions) {
      let sum = 0;
      let cnt = 0;
      for (let k = Math.max(0, i - window + 1); k <= i; k++) {
        const v = rows[k]![region];
        if (typeof v === 'number') {
          sum += v;
          cnt++;
        }
      }
      out[`${region}__ma`] = cnt > 0 ? sum / cnt : null;
    }
    return out;
  });
}

// 같은 날짜축의 두 시리즈를 지역별로 평균(종합지수 계산용).
export function combineAverage(a: ChartRow[], b: ChartRow[], regions: string[]): ChartRow[] {
  return a.map((ra, i) => {
    const rb = b[i];
    const out: ChartRow = { date: ra.date };
    for (const region of regions) {
      const va = ra[region];
      const vb = rb ? rb[region] : null;
      out[region] = typeof va === 'number' && typeof vb === 'number' ? (va + vb) / 2 : null;
    }
    return out;
  });
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear().toString().slice(2)}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 분기 라벨: 1분기에만 연도를 붙인다 (예: 25.1Q, 2Q, 3Q, 4Q)
export function formatQuarter(dateStr: string): string {
  const d = new Date(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  if (q === 1) return `${d.getFullYear().toString().slice(2)}.1Q`;
  return `${q}Q`;
}

// 각 연-분기의 첫 데이터 날짜를 눈금으로 추출.
// 눈금이 너무 많으면 분기 간격을 넓히되, Q1(연도 라벨)은 항상 유지한다.
export function getQuarterTicks(dates: string[], maxTicks = 14): string[] {
  if (!dates.length) return [];
  const boundaries: { date: string; q: number }[] = [];
  let prevKey = '';
  for (const ds of dates) {
    const d = new Date(ds);
    const q = Math.floor(d.getMonth() / 3); // 0=Q1 ... 3=Q4
    const key = `${d.getFullYear()}-${q}`;
    if (key !== prevKey) {
      boundaries.push({ date: ds, q });
      prevKey = key;
    }
  }
  let keepQuarters: number[];
  if (boundaries.length <= maxTicks) keepQuarters = [0, 1, 2, 3];
  else if (Math.ceil(boundaries.length / 2) <= maxTicks) keepQuarters = [0, 2];
  else keepQuarters = [0];
  let result = boundaries.filter(b => keepQuarters.includes(b.q)).map(b => b.date);
  // 연 단위(Q1만)인데도 여전히 많으면 균등하게 더 솎는다(예: 20년치 → 격년)
  if (result.length > maxTicks) {
    const step = Math.ceil(result.length / maxTicks);
    result = result.filter((_, i) => i % step === 0);
  }
  return result;
}

// 표시 구간(fromDate~toDate) ↔ 브러시 인덱스 변환 + 범위 보정 + 드래그 핸들러
export function useBrushRange(
  dates: string[],
  fromDate: string,
  toDate: string,
  setFromDate: (d: string) => void,
  setToDate: (d: string) => void,
) {
  const [startIndex, endIndex] = useMemo<[number, number]>(() => {
    if (!dates.length) return [0, 0];
    let s = dates.findIndex(d => d >= fromDate);
    if (s < 0) s = 0;
    let e = dates.length - 1;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i]! <= toDate) { e = i; break; }
    }
    if (e < s) e = dates.length - 1;
    return [s, e];
  }, [dates, fromDate, toDate]);

  // 데이터가 처음 로드됐는데 날짜 입력이 범위를 벗어나면 보정
  useEffect(() => {
    if (!dates.length) return;
    if (fromDate < dates[0]!) setFromDate(dates[0]!);
    if (toDate > dates[dates.length - 1]!) setToDate(dates[dates.length - 1]!);
  }, [dates]); // eslint-disable-line react-hooks/exhaustive-deps

  // 드래그 중 onChange가 프레임보다 자주 와도 store 갱신은 프레임당 1회로 합쳐 매끄럽게.
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ s: number; e: number } | null>(null);
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
    if (range.startIndex == null || range.endIndex == null || !dates.length) return;
    const s = Math.max(0, Math.min(range.startIndex, dates.length - 1));
    const e = Math.max(0, Math.min(range.endIndex, dates.length - 1));
    pendingRef.current = { s, e };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const p = pendingRef.current;
        pendingRef.current = null;
        if (p) {
          setFromDate(dates[p.s]!);
          setToDate(dates[p.e]!);
        }
      });
    }
  };

  return { startIndex, endIndex, handleBrushChange };
}

interface MetricChartProps {
  title: string;
  subtitle?: string;
  unit: string;
  data: ChartRow[];
  selectedRegions: string[];
  regionLabels: Record<string, string>;
  syncId?: string;
  // 기준선 값(예: 확산지수 100). 설정 시 점선 + 상/하 음영을 표시.
  referenceValue?: number;
  // 지수 기준일(=100) 세로선 위치. 데이터에 존재하는 날짜여야 그려진다.
  baseLineDate?: string;
  // 기준일 세로선 표시 여부.
  showBaseLine?: boolean;
  // 데이터에 `${region}__ma` 키가 있으면 이동평균 오버레이(점선)를 그린다.
  showMovingAverage?: boolean;
  // Y축 표시 범위. 미지정 시 데이터에 맞춰 자동.
  yDomain?: [number | 'auto', number | 'auto'];
  // Y축 눈금 간격(숫자 도메인일 때). 과밀(>16)하면 자동으로 기본 눈금으로 폴백.
  yTickStep?: number;
  // Y축 라벨 소수자리 (0 = 정수). 미지정 시 1.
  yTickDecimals?: number;
  // 제목 옆 ⓘ 설명. 차트 우측열은 align='right'로 잘림 방지.
  info?: string;
  infoAlign?: 'left' | 'right';
  // 제목 우측 끝에 표시할 컨트롤(예: 그래프별 Y축 조정)
  headerRight?: React.ReactNode;
  // 차트 옵션(형태·혼합·막대 스타일). 미지정 시 기본(선그래프).
  chartOptions?: ChartOptions;
  // 옵션 변경 콜백. 지정 시 제목 우측에 차트 옵션 팝오버를 표시한다.
  onChartOptionsChange?: (patch: Partial<ChartOptions>) => void;
}

export const MetricChart: React.FC<MetricChartProps> = ({
  title,
  subtitle,
  unit,
  data,
  selectedRegions,
  regionLabels,
  syncId = 'kb-weekly',
  referenceValue,
  baseLineDate,
  showBaseLine = false,
  showMovingAverage = false,
  yDomain,
  yTickStep,
  yTickDecimals,
  info,
  infoAlign = 'left',
  headerRight,
  chartOptions = DEFAULT_CHART_OPTIONS,
  onChartOptionsChange,
}) => {
  // 숫자 경계가 하나라도 있으면 데이터 초과분을 잘라 고정 축을 유지
  const fixedAxis = yDomain != null && yDomain.some(v => typeof v === 'number');
  // 지정 간격으로 Y축 눈금 생성. 숫자 도메인이고 눈금 수가 과하지 않을 때만(과밀 시 자동 폴백).
  const yTicks = useMemo(() => {
    if (!yDomain || !yTickStep || typeof yDomain[0] !== 'number' || typeof yDomain[1] !== 'number') return undefined;
    const lo = yDomain[0];
    const hi = yDomain[1];
    const count = Math.floor((hi - lo) / yTickStep + 1e-9);
    if (count < 1 || count > 16) return undefined;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) ticks.push(Math.round((lo + i * yTickStep) * 1000) / 1000);
    return ticks;
  }, [yDomain, yTickStep]);
  const decimals = yTickDecimals ?? 1;
  // 기준일 세로선: 표시 구간 안에 기준일이 실제로 존재할 때만 그린다(범위 밖이면 생략).
  const baseLineActive = showBaseLine && !!baseLineDate && data.some(d => d.date === baseLineDate);
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg text-xs">
        <p className="font-medium text-gray-900 mb-1">{label}</p>
        {payload
          .filter((entry: any) => !String(entry.dataKey).endsWith('__ma'))
          .map((entry: any) => (
            <p key={entry.dataKey} style={{ color: entry.color }}>
              {regionLabels[entry.dataKey] ?? entry.dataKey}:{' '}
              {entry.value != null ? `${formatNumber(entry.value, 2)}${unit}` : '-'}
            </p>
          ))}
      </div>
    );
  };

  const quarterTicks = useMemo(() => getQuarterTicks(data.map(d => d.date)), [data]);

  // 시리즈별(지역별) 실효 형태로 그린다 — 혼합차트 지원. 색상은 지역 인덱스로 순환.
  const renderSeries = (region: string, idx: number) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    const name = regionLabels[region] ?? region;
    switch (seriesChartType(chartOptions, region)) {
      case 'bar':
        return (
          <Bar
            key={region}
            dataKey={region}
            name={name}
            fill={color}
            fillOpacity={chartOptions.barOpacity}
            barSize={chartOptions.barSize}
            isAnimationActive={false}
          />
        );
      case 'area':
        return (
          <Area
            key={region}
            type="monotone"
            dataKey={region}
            name={name}
            stroke={color}
            strokeWidth={1.5}
            fill={color}
            fillOpacity={0.15}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        );
      case 'lineMarkers':
        // 선+점: 각 데이터 지점에 마커 표시(데이터가 듬성한 월간에 유용).
        return (
          <Line
            key={region}
            type="monotone"
            dataKey={region}
            name={name}
            stroke={color}
            strokeWidth={1.5}
            dot={{ r: 2, fill: color }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        );
      case 'step':
        return (
          <Line
            key={region}
            type="stepAfter"
            dataKey={region}
            name={name}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        );
      case 'scatter':
        // 선을 감추고 점만 표시 → 산점도 형태(범례는 원형 마커).
        return (
          <Line
            key={region}
            type="monotone"
            dataKey={region}
            name={name}
            stroke={color}
            strokeOpacity={0}
            dot={{ r: 2, fill: color }}
            activeDot={{ r: 4 }}
            legendType="circle"
            connectNulls={false}
            isAnimationActive={false}
          />
        );
      case 'line':
      default:
        return (
          <Line
            key={region}
            type="monotone"
            dataKey={region}
            name={name}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        );
    }
  };

  // 제목 우측 컨트롤: 차트 옵션 팝오버(선택적) + 차트별 추가 컨트롤(headerRight).
  const headerControls =
    onChartOptionsChange || headerRight ? (
      <div className="flex flex-none items-center gap-1.5">
        {onChartOptionsChange && (
          <ChartOptionsControl
            options={chartOptions}
            regions={selectedRegions}
            regionLabels={regionLabels}
            onChange={onChartOptionsChange}
          />
        )}
        {headerRight}
      </div>
    ) : null;

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-none items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-gray-700">
            {title}
            {subtitle && <span className="ml-1.5 text-xs font-normal text-gray-400">{subtitle}</span>}
            {info && <InfoTip text={info} align={infoAlign} className="ml-1.5" />}
          </h3>
          {headerControls}
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">데이터 없음</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-none items-center justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-gray-700">
          {title}
          {subtitle && <span className="ml-1.5 text-xs font-normal text-gray-400">{subtitle}</span>}
          {info && <InfoTip text={info} align={infoAlign} className="ml-1.5" />}
        </h3>
        {headerControls}
      </div>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} syncId={syncId}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            {referenceValue != null && (
              <>
                <ReferenceArea y1={referenceValue} y2={100000} fill="var(--green)" fillOpacity={0.05} ifOverflow="hidden" />
                <ReferenceArea y1={-100000} y2={referenceValue} fill="var(--red)" fillOpacity={0.05} ifOverflow="hidden" />
                <ReferenceLine y={referenceValue} stroke="var(--muted-2)" strokeDasharray="4 4" strokeWidth={1} ifOverflow="hidden" />
              </>
            )}
            {baseLineActive && (
              <ReferenceLine
                x={baseLineDate}
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
                ifOverflow="extendDomain"
                label={{ value: '기준', position: 'insideTopLeft', fontSize: 9, fill: 'var(--muted)' }}
              />
            )}
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              ticks={quarterTicks}
              tickFormatter={formatQuarter}
              interval={0}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              axisLine={false}
              tickLine={false}
              domain={yDomain ?? ['auto', 'auto']}
              allowDataOverflow={fixedAxis}
              ticks={yTicks}
              tickFormatter={v => formatNumber(v, decimals)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value: string) => regionLabels[value] ?? value}
            />
            {selectedRegions.map((region, idx) => renderSeries(region, idx))}
            {showMovingAverage &&
              selectedRegions.map((region, idx) => (
                <Line
                  key={`${region}__ma`}
                  type="monotone"
                  dataKey={`${region}__ma`}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={1}
                  strokeDasharray="5 3"
                  strokeOpacity={0.55}
                  dot={false}
                  legendType="none"
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 드래그 막대 손잡이: 시작/종료 지점을 명확히 보여주는 원형 노브(흰 배경 + 파란 테두리).
export const BrushTraveller = (props: { x?: number; y?: number; width?: number; height?: number }) => {
  const { x = 0, y = 0, width = 10, height = 0 } = props;
  const cx = x + width / 2;
  const cy = y + height / 2;
  // 막대 두께와 균형을 맞춰 살짝만 큰 노브
  const r = height / 2 + 0.5;
  return (
    <g style={{ cursor: 'pointer' }}>
      <circle cx={cx} cy={cy} r={r} fill="var(--raise)" stroke="var(--blue)" strokeWidth={1.75} />
    </g>
  );
};

interface RangeSliderProps {
  data: ChartRow[];
  dates: string[];
  startIndex: number;
  endIndex: number;
  fromDate: string;
  toDate: string;
  onBrushChange: (range: { startIndex?: number; endIndex?: number }) => void;
}

// 모든 차트가 공유하는 단일 기간 슬라이더.
// 막대 양끝을 드래그해 구간을 정하고, 막대 아래에는 분기 눈금을 표시한다.
export const RangeSlider: React.FC<RangeSliderProps> = ({
  data,
  dates,
  startIndex,
  endIndex,
  fromDate,
  toDate,
  onBrushChange,
}) => {
  const quarterTicks = useMemo(() => getQuarterTicks(dates), [dates]);
  const lastIdx = Math.max(1, dates.length - 1);

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-gray-700">
          기간 선택
          <span className="ml-2 text-xs font-normal text-gray-400">막대 양끝을 드래그하면 모든 그래프가 함께 조절됩니다</span>
        </span>
        <span className="font-mono text-sm whitespace-nowrap">
          <span className="text-blue-600">{fromDate}</span>
          <span className="text-gray-400"> ~ </span>
          <span className="text-blue-600">{toDate}</span>
        </span>
      </div>
      {/* 드래그 막대 (얇은 선 형태) */}
      <div className="h-5">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 3, right: 0, left: 0, bottom: 0 }}>
            <Brush
              dataKey="date"
              height={12}
              startIndex={startIndex}
              endIndex={endIndex}
              onChange={onBrushChange}
              travellerWidth={9}
              traveller={<BrushTraveller />}
              stroke="var(--blue-dim)"
              fill="var(--blue-dim)"
              tickFormatter={formatDate}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* 막대 아래 분기 눈금 */}
      <div className="relative h-5 mt-1">
        {quarterTicks.map(td => {
          const idx = dates.indexOf(td);
          if (idx < 0) return null;
          const left = (idx / lastIdx) * 100;
          const align =
            idx === 0 ? 'translate-x-0' : idx === dates.length - 1 ? '-translate-x-full' : '-translate-x-1/2';
          return (
            <div
              key={td}
              className={`absolute top-0 flex flex-col items-center ${align}`}
              style={{ left: `${left}%` }}
            >
              <span className="h-1.5 w-px bg-gray-300" />
              <span className="text-[10px] leading-none text-gray-400 mt-0.5 whitespace-nowrap">
                {formatQuarter(td)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
