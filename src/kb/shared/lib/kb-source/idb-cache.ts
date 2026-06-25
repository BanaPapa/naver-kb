// KB 데이터 번들 영구 캐시(IndexedDB).
// 버전이 동일하면 재다운로드 없이 즉시 로드, 업데이트 시점에만 새 번들을 받는다.
// IndexedDB를 못 쓰는 환경에서는 조용히 캐시 미사용(null/no-op)으로 폴백한다.

import type { KbDatasetKey } from './config';

const DB_NAME = 'kb-data-cache';
const STORE = 'bundles';
const DB_VERSION = 1;

export interface CachedBundle {
  version: string;
  data: unknown;
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open 실패'));
  });
}

export async function getCached(key: KbDatasetKey): Promise<CachedBundle | null> {
  if (!hasIndexedDB()) return null;
  try {
    const db = await openDb();
    return await new Promise<CachedBundle | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedBundle | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB get 실패'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null; // 캐시 실패는 치명적이지 않다 — 네트워크에서 다시 받는다.
  }
}

export async function putCached(key: KbDatasetKey, version: string, data: unknown): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ version, data } satisfies CachedBundle, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB put 실패'));
    });
  } catch {
    // 저장 실패는 무시 — 다음 진입 때 다시 받으면 된다.
  }
}
