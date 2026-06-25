import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { weeklyLocal } from '../../entities/kb-data/api/weekly-local';
import { weeklyTradeLocal } from '../../entities/kb-data/api/weekly-trade-local';
import type { WeeklyDataRow } from '../../entities/kb-data';

interface AppStore {
  // Region state
  allRegions: string[];
  allTradeRegions: string[]; // 거래지표 제공 지역(대지역/집계만)
  selectedRegions: string[];
  regionLabels: Record<string, string>; // weeklyKey → 표시 라벨 (예: "덕양구" → "고양시 덕양구")
  regionsLoading: boolean;

  // Date range
  fromDate: string;
  toDate: string;

  // 지수 기준일 (이 날짜의 지수를 100으로 리베이스)
  baseDate: string;
  // 전체 주간 날짜(월요일) 목록 — 기준일 드롭다운/기간 슬라이더에 사용
  allDates: string[]; // 시세지표(2008~)
  allTradeDates: string[]; // 거래지표(2003~)

  // Data
  weeklyData: WeeklyDataRow[];
  dataLoading: boolean;
  dataError: string | null;

  // 거래지표 데이터 (매수우위·매매거래활발·전세수급·전세거래활발, 대지역만)
  tradeData: WeeklyDataRow[];
  tradeLoading: boolean;

  // Collection status
  latestDate: string | null;
  totalRecords: number;

  // Actions
  loadRegions: () => Promise<void>;
  addRegion: (region: string, label?: string) => void;
  removeRegion: (region: string) => void;
  clearRegions: () => void;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setBaseDate: (date: string) => void;
  loadWeeklyData: () => Promise<void>;
  loadTradeData: () => Promise<void>;
  loadDates: () => Promise<void>;
  loadStatus: () => Promise<void>;
}

const DEFAULT_FROM = '2023-01-01';
const DEFAULT_TO = new Date().toISOString().split('T')[0];
// KB 원본 데이터의 기준일. 이 날짜에서 모든 지수가 100.0이다.
const DEFAULT_BASE = '2026-01-12';

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
  allRegions: [],
  allTradeRegions: [],
  selectedRegions: ['서울특별시', '전국'],
  regionLabels: { 서울특별시: '서울특별시', 전국: '전국' },
  regionsLoading: false,

  fromDate: DEFAULT_FROM,
  toDate: DEFAULT_TO,
  baseDate: DEFAULT_BASE,
  allDates: [],
  allTradeDates: [],

  weeklyData: [],
  dataLoading: false,
  dataError: null,

  tradeData: [],
  tradeLoading: false,

  latestDate: null,
  totalRecords: 0,

  loadRegions: async () => {
    set({ regionsLoading: true });
    try {
      const [regions, tradeRegions] = await Promise.all([
        weeklyLocal.getRegions(),
        weeklyTradeLocal.getRegions(),
      ]);
      set({ allRegions: regions, allTradeRegions: tradeRegions, regionsLoading: false });
    } catch {
      set({ regionsLoading: false });
    }
  },

  addRegion: (region: string, label?: string) => {
    const { selectedRegions, regionLabels } = get();
    if (selectedRegions.includes(region) || selectedRegions.length >= 5) return;
    set({
      selectedRegions: [...selectedRegions, region],
      regionLabels: { ...regionLabels, [region]: label ?? region },
    });
    // 비교함 변경 즉시 차트 데이터 갱신 (별도 "비교하기" 없이도 바로 반영)
    void get().loadWeeklyData();
    void get().loadTradeData();
  },

  removeRegion: (region: string) => {
    const { selectedRegions, regionLabels } = get();
    const { [region]: _removed, ...restLabels } = regionLabels;
    set({
      selectedRegions: selectedRegions.filter(r => r !== region),
      regionLabels: restLabels,
    });
    void get().loadWeeklyData();
    void get().loadTradeData();
  },

  clearRegions: () => set({ selectedRegions: [], regionLabels: {} }),

  setFromDate: (date: string) => set({ fromDate: date }),
  setToDate: (date: string) => set({ toDate: date }),
  setBaseDate: (date: string) => set({ baseDate: date }),

  loadWeeklyData: async () => {
    const { selectedRegions } = get();
    if (selectedRegions.length === 0) {
      set({ weeklyData: [] });
      return;
    }
    set({ dataLoading: true, dataError: null });
    try {
      // 전체 기간 로드. 표시 구간(fromDate~toDate)은 차트의 브러시/날짜입력으로 조절.
      const data = await weeklyLocal.getWeeklyData(selectedRegions, '', '');
      set({ weeklyData: data, dataLoading: false });
    } catch (e) {
      set({ dataError: e instanceof Error ? e.message : 'Failed to load data', dataLoading: false });
    }
  },

  loadTradeData: async () => {
    const { selectedRegions } = get();
    if (selectedRegions.length === 0) {
      set({ tradeData: [] });
      return;
    }
    set({ tradeLoading: true });
    try {
      const data = await weeklyTradeLocal.getTradeData(selectedRegions);
      set({ tradeData: data, tradeLoading: false });
    } catch {
      set({ tradeLoading: false });
    }
  },

  loadDates: async () => {
    // 한쪽이 실패해도 다른 쪽은 로드되도록 분리
    try {
      set({ allDates: await weeklyLocal.getDates() });
    } catch {
      // ignore
    }
    try {
      set({ allTradeDates: await weeklyTradeLocal.getDates() });
    } catch {
      // ignore
    }
  },

  loadStatus: async () => {
    try {
      const status = await weeklyLocal.getCollectionStatus();
      set({ latestDate: status.latestDate, totalRecords: status.totalRecords });
    } catch {
      // ignore
    }
  },
    }),
    {
      name: 'kb-weekly',
      partialize: s => ({
        selectedRegions: s.selectedRegions,
        regionLabels: s.regionLabels,
        fromDate: s.fromDate,
        toDate: s.toDate,
        baseDate: s.baseDate,
      }),
    },
  ),
);
