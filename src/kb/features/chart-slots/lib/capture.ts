import { useAppStore } from '../../../shared/lib/store';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { generateSlotName } from './name';
import {
  MODE_PREFIXES,
  SNAPSHOT_SCHEMA_VERSION,
  type ChartSetSnapshot,
  type SlotMode,
  type YRange,
} from '../model/types';
import type { ChartOptions } from '../../../shared/config';

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

// 지정 prefix들로 시작하는 키만 추려 새 객체로 반환(불변).
function pickByPrefix<T>(map: Record<string, T>, prefixes: string[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(map)) {
    if (prefixes.some(p => k.startsWith(p))) out[k] = v;
  }
  return out;
}

// 지정 prefix 키들을 base에서 제거한 뒤 patch를 덮어써 병합(불변).
function mergeByPrefix<T>(
  base: Record<string, T>,
  patch: Record<string, T>,
  prefixes: string[],
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(base)) {
    if (!prefixes.some(p => k.startsWith(p))) out[k] = v;
  }
  return { ...out, ...patch };
}

// 현재 화면 상태를 스냅샷으로 캡처. 주간 선택/기간은 useAppStore, 월간은 useMonthlyStore.
export function capture(mode: SlotMode): ChartSetSnapshot {
  const m = useMonthlyStore.getState();
  const prefixes = MODE_PREFIXES[mode];

  const sel =
    mode === 'weekly'
      ? (() => {
          const a = useAppStore.getState();
          return {
            selectedRegions: a.selectedRegions,
            regionLabels: a.regionLabels,
            fromDate: a.fromDate,
            toDate: a.toDate,
            baseDate: a.baseDate,
          };
        })()
      : {
          selectedRegions: m.selectedRegions,
          regionLabels: m.regionLabels,
          fromDate: m.fromDate,
          toDate: m.toDate,
          baseDate: m.baseDate,
        };

  const snapshot: ChartSetSnapshot = {
    id: uuid(),
    name: '',
    mode,
    createdAt: Date.now(),
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    ...sel,
    weeklyTab: m.weeklyTab,
    tradeMaOn: m.tradeMaOn,
    tradeMaWindow: m.tradeMaWindow,
    baseLineOn: m.baseLineOn,
    yRanges: pickByPrefix<YRange>(m.yRanges, prefixes),
    tradeYRanges: { ...m.tradeYRanges },
    chartOptions: pickByPrefix<ChartOptions>(m.chartOptions, prefixes),
  };
  snapshot.name = generateSlotName(snapshot);
  return snapshot;
}

// 스냅샷을 현재 상태로 복원. clearYRanges 경쟁 방지 가드를 설정한 뒤 데이터 로드.
export function apply(snapshot: ChartSetSnapshot): void {
  const prefixes = MODE_PREFIXES[snapshot.mode];
  const m = useMonthlyStore.getState();

  // 1) 복원 가드(이 모드 prefix의 자동 clear를 1회 건너뜀)
  m.armSkipYRangeClear(prefixes);

  // 2) 옵션 병합 + 모드/탭
  useMonthlyStore.setState(s => ({
    mode: snapshot.mode,
    weeklyTab: snapshot.weeklyTab,
    tradeMaOn: snapshot.tradeMaOn,
    tradeMaWindow: snapshot.tradeMaWindow,
    baseLineOn: snapshot.baseLineOn,
    yRanges: mergeByPrefix(s.yRanges, snapshot.yRanges, prefixes),
    chartOptions: mergeByPrefix(s.chartOptions, snapshot.chartOptions, prefixes),
    tradeYRanges: { ...snapshot.tradeYRanges },
  }));

  // 3) 선택/기간 복원 (모드별 스토어) + 데이터 로드
  if (snapshot.mode === 'weekly') {
    useAppStore.setState({
      selectedRegions: snapshot.selectedRegions,
      regionLabels: snapshot.regionLabels,
      fromDate: snapshot.fromDate,
      toDate: snapshot.toDate,
      baseDate: snapshot.baseDate,
    });
    void useAppStore.getState().loadWeeklyData();
    void useAppStore.getState().loadTradeData();
  } else {
    useMonthlyStore.setState({
      selectedRegions: snapshot.selectedRegions,
      regionLabels: snapshot.regionLabels,
      fromDate: snapshot.fromDate,
      toDate: snapshot.toDate,
      baseDate: snapshot.baseDate,
    });
    const mm = useMonthlyStore.getState();
    if (mm.allDates.length === 0) void mm.loadDates();
    void mm.loadPriceData();
    void mm.loadTradeData();
    void mm.loadTradeRegions();
    void mm.loadMarketData();
  }
}
