// KB 데이터 업데이트 진행 상태 스토어.
// Supabase 번들을 새로 받을 때(버전 변경 시) 모달 + 진행률을 띄우기 위한 전역 상태.
import { create } from 'zustand';
import type { KbDatasetKey } from './config';

export interface DatasetProgress {
  key: KbDatasetKey;
  received: number; // 받은 바이트
  total: number;    // 전체 바이트(content-length, 모르면 0)
  done: boolean;
}

interface KbUpdateState {
  // 새 번들을 받는 중인 데이터셋들(받기 시작하면 추가, 끝나도 모달엔 완료로 남김)
  datasets: Record<string, DatasetProgress>;
  active: boolean; // 하나라도 다운로드 진행 중인가

  begin: (key: KbDatasetKey, total: number) => void;
  update: (key: KbDatasetKey, received: number) => void;
  finish: (key: KbDatasetKey) => void;
  reset: () => void;
}

function recomputeActive(datasets: Record<string, DatasetProgress>): boolean {
  return Object.values(datasets).some(d => !d.done);
}

export const useKbUpdateStore = create<KbUpdateState>((set) => ({
  datasets: {},
  active: false,

  begin: (key, total) =>
    set((s) => {
      const datasets = { ...s.datasets, [key]: { key, received: 0, total, done: false } };
      return { datasets, active: true };
    }),

  update: (key, received) =>
    set((s) => {
      const prev = s.datasets[key];
      if (!prev) return s;
      const datasets = { ...s.datasets, [key]: { ...prev, received } };
      return { datasets };
    }),

  finish: (key) =>
    set((s) => {
      const prev = s.datasets[key];
      if (!prev) return s;
      const datasets = { ...s.datasets, [key]: { ...prev, done: true, received: prev.total || prev.received } };
      return { datasets, active: recomputeActive(datasets) };
    }),

  reset: () => set({ datasets: {}, active: false }),
}));
