import type { ChartOptions } from '../../../shared/config';
import type { WeeklyTab } from '../../../shared/lib/monthly-store';

export type SlotMode = 'weekly' | 'monthly';

export interface YRange {
  min: number;
  max: number;
}

// 슬롯 1개가 담는 전체 스냅샷 — 정적 JSON에서 6개 차트를 재생성할 파라미터.
export interface ChartSetSnapshot {
  id: string;
  name: string;
  mode: SlotMode;
  createdAt: number;
  schemaVersion: number;

  selectedRegions: string[];
  regionLabels: Record<string, string>;
  fromDate: string;
  toDate: string;
  baseDate: string;
  weeklyTab: WeeklyTab;

  tradeMaOn: boolean;
  tradeMaWindow: number;
  baseLineOn: boolean;

  yRanges: Record<string, YRange>;
  tradeYRanges: Record<string, YRange>;
  chartOptions: Record<string, ChartOptions>;
}

// 슬롯 1칸 = 주간/월간 스냅샷을 함께 담는 통합 엔트리.
// 셋트 저장 시 weekly·monthly가 모두 채워지고, 단일 저장 시 한쪽만 채워진다.
export interface SlotEntry {
  id: string;
  updatedAt: number; // 마지막 저장 시각 — "언제 저장됐는지" 표시용
  weekly: ChartSetSnapshot | null;
  monthly: ChartSetSnapshot | null;
}

export const SLOT_COUNT = 20;
export const SLOTS_PER_PAGE = 10;
export const SNAPSHOT_SCHEMA_VERSION = 1;

// 모드별 prefix — capture/apply가 yRanges·chartOptions를 필터링/병합할 때 사용.
export const MODE_PREFIXES: Record<SlotMode, string[]> = {
  weekly: ['wp:', 'wt:'],
  monthly: ['mp:', 'mt:', 'mk:'],
};
