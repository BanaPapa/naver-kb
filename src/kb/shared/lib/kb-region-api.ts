// KB Land 공개 API 기반 지역(법정동) 구조 조회.
// 이 엔드포인트는 커스텀 헤더 없는 단순 GET이라 CORS 허용 + 프리플라이트가 없어
// 브라우저에서 직접 호출 가능하다. (R1-KB regionService 패턴 이식)
//
// 지역 데이터는 사실상 고정값이므로 적극적으로 캐싱한다.
//  - 메모리 캐시: 같은 세션 내 재선택은 네트워크 없이 즉시 응답
//  - localStorage: 새로고침/재실행 후 첫 선택도 즉시 응답 (TTL 30일)

const KB_BASE = 'https://api.kbland.kr/land-price/price/areaName';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'kbRegion:';

export interface RegionItem {
  code: string; // 법정동코드 substring (2자리=시도, 5자리=시군구, 10자리=읍면동)
  name: string; // 대지역명 / 중지역명 / 소지역명 (.trim())
  level: 1 | 2 | 3;
}

interface KBRawItem {
  대지역명: string;
  중지역명?: string;
  소지역명?: string;
  법정동코드: string;
}

const memCache = new Map<string, RegionItem[]>();
const pending = new Map<string, Promise<RegionItem[]>>();

function cacheKey(step: 1 | 2 | 3, parentCode?: string): string {
  return `${step}:${parentCode ?? ''}`;
}

function readPersisted(key: string): RegionItem[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; d: RegionItem[] };
    if (!parsed?.d || Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.d;
  } catch {
    return null;
  }
}

function writePersisted(key: string, data: RegionItem[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    // localStorage 미지원/용량초과는 무시 (메모리 캐시로 동작)
  }
}

async function requestRegions(step: 1 | 2 | 3, parentCode?: string): Promise<RegionItem[]> {
  const url =
    step > 1 && parentCode
      ? `${KB_BASE}?${new URLSearchParams({ 법정동코드: parentCode }).toString()}`
      : KB_BASE;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`KB Land API 오류: ${resp.status}`);

  const json = await resp.json();
  const items: KBRawItem[] = json?.dataBody?.data ?? [];

  const seen = new Set<string>();
  const result: RegionItem[] = [];

  for (const item of items) {
    let name: string;
    let code: string;
    if (step === 1) {
      name = (item.대지역명 ?? '').trim();
      code = item.법정동코드.substring(0, 2);
    } else if (step === 2) {
      name = (item.중지역명 ?? '').trim();
      code = item.법정동코드.substring(0, 5);
    } else {
      name = (item.소지역명 ?? '').trim();
      code = item.법정동코드;
    }
    if (name && !seen.has(code)) {
      seen.add(code);
      result.push({ code, name, level: step });
    }
  }

  return result;
}

export async function getRegions(step: 1 | 2 | 3, parentCode?: string): Promise<RegionItem[]> {
  const key = cacheKey(step, parentCode);

  const mem = memCache.get(key);
  if (mem) return mem;

  const persisted = readPersisted(key);
  if (persisted) {
    memCache.set(key, persisted);
    return persisted;
  }

  const inFlight = pending.get(key);
  if (inFlight) return inFlight;

  const promise = requestRegions(step, parentCode)
    .then(data => {
      memCache.set(key, data);
      writePersisted(key, data);
      return data;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, promise);
  return promise;
}

/** 캐시에 있으면 동기 즉시 반환(없으면 null). 드롭다운을 스피너 없이 채우는 데 사용. */
export function peekRegions(step: 1 | 2 | 3, parentCode?: string): RegionItem[] | null {
  const key = cacheKey(step, parentCode);
  const mem = memCache.get(key);
  if (mem) return mem;
  const persisted = readPersisted(key);
  if (persisted) {
    memCache.set(key, persisted);
    return persisted;
  }
  return null;
}

/** 백그라운드 선로딩. 캐시에 없을 때만 조용히 받아 채운다. */
export function prefetchRegions(step: 1 | 2 | 3, parentCode?: string): void {
  if (peekRegions(step, parentCode)) return;
  void getRegions(step, parentCode).catch(() => {});
}
