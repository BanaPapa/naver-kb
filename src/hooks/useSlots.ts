import { useState, useCallback, useEffect } from 'react';
import { SavedSlot, SearchMeta, CrawlerConfig, Property } from '../types';
import { isSupabaseConfigured } from '../services/supabase';
import { fetchSlots, upsertSlot, removeSlot } from '../services/slotsRepo';

export const MAX_SLOTS = 20;

let _slotSeq = 0;

export type SlotArray = (SavedSlot | null)[];

const emptySlots = (): SlotArray => Array(MAX_SLOTS).fill(null);

function makeSlot(meta: SearchMeta, config: CrawlerConfig, properties: Property[]): SavedSlot {
  return {
    id: `slot-${++_slotSeq}-${Date.now()}`,
    createdAt: Date.now(),
    meta,
    config,
    count: properties.length,
    properties,
  };
}

// 고정 20칸 저장 슬롯.
// 로그인(userId) + Supabase 설정 시 → naver_slots 테이블에 사용자별 영속.
// 미설정/비로그인 시 → 기존처럼 메모리에만 유지.
export function useSlots(userId: string | null) {
  const [slots, setSlots] = useState<SlotArray>(emptySlots);
  const useDb = isSupabaseConfigured && !!userId;

  // 로그인 상태에 따라 슬롯 로드 (DB ↔ 메모리 전환)
  useEffect(() => {
    if (!useDb) {
      setSlots(emptySlots());
      return;
    }
    let cancelled = false;
    fetchSlots()
      .then((rows) => {
        if (cancelled) return;
        const next = emptySlots();
        for (const { index, slot } of rows) {
          if (index >= 0 && index < MAX_SLOTS) next[index] = slot;
        }
        setSlots(next);
      })
      .catch((err) => console.error('슬롯 불러오기 실패:', err));
    return () => {
      cancelled = true;
    };
  }, [useDb, userId]);

  // 지정한 칸에 저장(덮어쓰기). 로컬 즉시 반영 + DB 영속(실패 시 알림).
  const saveAt = useCallback(
    (index: number, meta: SearchMeta, config: CrawlerConfig, properties: Property[]) => {
      const slot = makeSlot(meta, config, properties);
      setSlots((prev) => {
        const next = [...prev];
        next[index] = slot;
        return next;
      });
      if (useDb && userId) {
        upsertSlot(userId, index, slot).catch((err) => {
          console.error('슬롯 저장 실패:', err);
          alert(`슬롯 저장 실패: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    },
    [useDb, userId],
  );

  // 첫 빈 칸에 저장 → 저장된 index, 가득 차면 -1
  const saveFirstEmpty = useCallback(
    (meta: SearchMeta, config: CrawlerConfig, properties: Property[]): number => {
      const idx = slots.findIndex((s) => s === null);
      if (idx === -1) return -1;
      saveAt(idx, meta, config, properties);
      return idx;
    },
    [slots, saveAt],
  );

  const deleteSlot = useCallback(
    (index: number) => {
      setSlots((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
      if (useDb) {
        removeSlot(index).catch((err) => console.error('슬롯 삭제 실패:', err));
      }
    },
    [useDb],
  );

  return { slots, saveAt, saveFirstEmpty, deleteSlot };
}
