import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { capture, apply } from '../lib/capture';
import {
  SLOT_COUNT,
  type ChartSetSnapshot,
  type SlotEntry,
  type SlotMode,
} from './types';

type SlotArray = (SlotEntry | null)[];

interface SlotStore {
  slots: SlotArray;
  // 현재 모드 화면을 슬롯에 저장. includeBoth=true면 주간·월간을 함께(셋트) 저장.
  saveToSlot: (mode: SlotMode, index: number, includeBoth: boolean) => void;
  // 슬롯을 불러온다. preferMode 쪽 스냅샷을 우선 적용하고, 없으면 반대쪽을 적용.
  loadSlot: (index: number, preferMode: SlotMode) => void;
  // 슬롯 전체(주간·월간 모두) 비우기.
  deleteSlot: (index: number) => void;
  // 슬롯의 한쪽 모드만 비우기.
  deleteMode: (index: number, mode: SlotMode) => void;
  // 슬롯에 담긴 양쪽 스냅샷 이름을 함께 변경.
  renameSlot: (index: number, name: string) => void;
}

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `slot-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function emptySlots(): SlotArray {
  return Array(SLOT_COUNT).fill(null);
}

function inRange(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < SLOT_COUNT;
}

// 불변 업데이트: 해당 인덱스만 교체한 새 배열 반환.
function replaceAt(arr: SlotArray, index: number, value: SlotEntry | null): SlotArray {
  const next = [...arr];
  next[index] = value;
  return next;
}

export const useSlotStore = create<SlotStore>()(
  persist(
    (set, get) => ({
      slots: emptySlots(),

      saveToSlot: (mode, index, includeBoth) => {
        if (!inRange(index)) return;
        const other: SlotMode = mode === 'weekly' ? 'monthly' : 'weekly';
        set(s => {
          const cur = s.slots[index];
          const base: SlotEntry = cur ?? { id: uuid(), updatedAt: 0, weekly: null, monthly: null };
          const next: SlotEntry = {
            ...base,
            updatedAt: Date.now(),
            [mode]: capture(mode),
            ...(includeBoth ? { [other]: capture(other) } : {}),
          };
          return { slots: replaceAt(s.slots, index, next) };
        });
      },

      loadSlot: (index, preferMode) => {
        if (!inRange(index)) return;
        const entry = get().slots[index];
        if (!entry) return;
        const other: SlotMode = preferMode === 'weekly' ? 'monthly' : 'weekly';
        const snap = entry[preferMode] ?? entry[other];
        if (snap) apply(snap);
      },

      deleteSlot: index => {
        if (!inRange(index)) return;
        set(s => ({ slots: replaceAt(s.slots, index, null) }));
      },

      deleteMode: (index, mode) => {
        if (!inRange(index)) return;
        set(s => {
          const cur = s.slots[index];
          if (!cur) return {};
          const next: SlotEntry = { ...cur, [mode]: null };
          // 양쪽 모두 비면 슬롯 자체를 제거.
          const emptied = !next.weekly && !next.monthly;
          return { slots: replaceAt(s.slots, index, emptied ? null : next) };
        });
      },

      renameSlot: (index, name) => {
        if (!inRange(index)) return;
        set(s => {
          const cur = s.slots[index];
          if (!cur) return {};
          const rename = (snap: ChartSetSnapshot | null): ChartSetSnapshot | null =>
            snap ? { ...snap, name } : null;
          return {
            slots: replaceAt(s.slots, index, {
              ...cur,
              weekly: rename(cur.weekly),
              monthly: rename(cur.monthly),
            }),
          };
        });
      },
    }),
    {
      name: 'kb-chart-slots',
      version: 2,
      // v1(분리된 weekly[]/monthly[]) → v2(통합 slots[]) 마이그레이션 + 길이 보정.
      migrate: (persisted: unknown) => {
        const p = persisted as
          | { slots?: SlotArray; weekly?: (ChartSetSnapshot | null)[]; monthly?: (ChartSetSnapshot | null)[] }
          | undefined;
        const base = emptySlots();

        if (Array.isArray(p?.slots)) {
          for (let i = 0; i < SLOT_COUNT; i++) base[i] = p.slots[i] ?? null;
          return { slots: base } as SlotStore;
        }

        const w = Array.isArray(p?.weekly) ? p.weekly : [];
        const m = Array.isArray(p?.monthly) ? p.monthly : [];
        for (let i = 0; i < SLOT_COUNT; i++) {
          const weekly = w[i] ?? null;
          const monthly = m[i] ?? null;
          if (weekly || monthly) {
            base[i] = {
              id: uuid(),
              updatedAt: weekly?.createdAt ?? monthly?.createdAt ?? Date.now(),
              weekly,
              monthly,
            };
          }
        }
        return { slots: base } as SlotStore;
      },
    },
  ),
);
