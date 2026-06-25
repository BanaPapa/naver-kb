import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RegionSyncStore {
  // 주간·월간 지역/기준월/기간 연동 여부.
  linked: boolean;
  // 연동 토글 직후 안내 문구(선택이 달라 한쪽 기준으로 맞췄을 때). 일시 표시 후 해제.
  notice: string | null;
  setLinked: (v: boolean) => void;
  setNotice: (s: string | null) => void;
}

export const useRegionSync = create<RegionSyncStore>()(
  persist(
    set => ({
      linked: false,
      notice: null,
      setLinked: v => set({ linked: v }),
      setNotice: s => set({ notice: s }),
    }),
    {
      name: 'kb-region-sync',
      partialize: s => ({ linked: s.linked }),
    },
  ),
);
