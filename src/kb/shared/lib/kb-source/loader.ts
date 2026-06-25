// KB 시계열 데이터 통합 로더.
// - static: public/data/*.json 을 그대로 fetch (기본, 기존 동작)
// - supabase: Storage 버킷의 버전 매니페스트를 확인 → IndexedDB 캐시와 비교 →
//   바뀐 데이터셋만 .gz 번들을 진행률과 함께 내려받아 gunzip·캐시 후 사용.
// 어느 경우든 반환 형태(파싱된 JSON 객체)는 동일해 상위 *-local.ts 는 무수정으로 동작한다.

import { supabase } from '../../../../services/supabase';
import {
  KB_DATA_SOURCE,
  KB_BUCKET,
  BUNDLE_OBJECT,
  STATIC_FILE,
  VERSIONS_OBJECT,
  type KbDatasetKey,
} from './config';
import { getCached, putCached } from './idb-cache';
import { useKbUpdateStore } from './progress-store';

type VersionManifest = Partial<Record<KbDatasetKey, string>>;

// ── static 경로 ──────────────────────────────────────────────
async function loadStatic<T>(key: KbDatasetKey): Promise<T> {
  const url = `/data/${STATIC_FILE[key]}`;
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`KB 데이터 로드 실패(${key}): HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ── supabase 경로 ────────────────────────────────────────────
let manifestPromise: Promise<VersionManifest> | null = null;

async function loadManifest(): Promise<VersionManifest> {
  if (!supabase) throw new Error('Supabase 미설정: KB 데이터 매니페스트를 로드할 수 없습니다.');
  if (!manifestPromise) {
    manifestPromise = supabase.storage
      .from(KB_BUCKET)
      .download(VERSIONS_OBJECT)
      .then(async ({ data, error }) => {
        if (error || !data) throw error ?? new Error('versions.json 다운로드 실패');
        return JSON.parse(await data.text()) as VersionManifest;
      })
      .catch((err) => {
        manifestPromise = null; // 실패 시 재시도 허용
        throw err;
      });
  }
  return manifestPromise;
}

// DecompressionStream 으로 gzip 해제 (모던 브라우저 표준).
async function gunzipToJson<T>(bytes: Blob): Promise<T> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new Error('이 브라우저는 gzip 해제(DecompressionStream)를 지원하지 않습니다.');
  const stream = bytes.stream().pipeThrough(new DS('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text) as T;
}

async function downloadBundleWithProgress(key: KbDatasetKey): Promise<Blob> {
  if (!supabase) throw new Error('Supabase 미설정: KB 번들을 받을 수 없습니다.');
  const path = BUNDLE_OBJECT[key];
  const { data: signed, error } = await supabase.storage
    .from(KB_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !signed?.signedUrl) throw error ?? new Error(`서명 URL 발급 실패(${key})`);

  const res = await fetch(signed.signedUrl);
  if (!res.ok || !res.body) throw new Error(`번들 다운로드 실패(${key}): HTTP ${res.status}`);

  const total = Number(res.headers.get('content-length')) || 0;
  const store = useKbUpdateStore.getState();
  store.begin(key, total);

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      useKbUpdateStore.getState().update(key, received);
    }
  }
  useKbUpdateStore.getState().finish(key);
  return new Blob(chunks as BlobPart[], { type: 'application/gzip' });
}

async function loadFromSupabase<T>(key: KbDatasetKey): Promise<T> {
  const manifest = await loadManifest();
  const version = manifest[key];
  if (!version) throw new Error(`매니페스트에 데이터셋 버전이 없습니다(${key}).`);

  const cached = await getCached(key);
  if (cached && cached.version === version) {
    return cached.data as T; // 버전 동일 → 즉시 캐시 사용(다운로드 없음)
  }

  const gz = await downloadBundleWithProgress(key);
  const data = await gunzipToJson<T>(gz);
  await putCached(key, version, data);
  return data;
}

// ── 공개 API ─────────────────────────────────────────────────
export async function loadKbJson<T>(key: KbDatasetKey): Promise<T> {
  // supabase 모드라도 클라이언트가 미설정이면 안전하게 static 으로 폴백.
  if (KB_DATA_SOURCE === 'supabase' && supabase) {
    return loadFromSupabase<T>(key);
  }
  return loadStatic<T>(key);
}
