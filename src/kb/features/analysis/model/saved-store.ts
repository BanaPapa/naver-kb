import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SavedAnalysis } from './saved.types';

// 저장된 분석 결과를 localStorage에 영속한다. 최신 항목이 앞에 온다.
interface SavedStore {
  items: SavedAnalysis[];
  save: (item: Omit<SavedAnalysis, 'id' | 'createdAt'>) => string;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

function genId(): string {
  return `sa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const useSavedStore = create<SavedStore>()(
  persist(
    set => ({
      items: [],

      save: item => {
        const id = genId();
        const entry: SavedAnalysis = { ...item, id, createdAt: Date.now() };
        set(s => ({ items: [entry, ...s.items] }));
        return id;
      },

      remove: id => set(s => ({ items: s.items.filter(it => it.id !== id) })),

      rename: (id, name) =>
        set(s => ({ items: s.items.map(it => (it.id === id ? { ...it, name } : it)) })),
    }),
    { name: 'kb-analysis-saved', version: 1 },
  ),
);
