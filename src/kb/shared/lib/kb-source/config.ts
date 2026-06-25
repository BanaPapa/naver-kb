// KB 시계열 데이터 소스 설정.
// 기본은 'static'(public/data/*.json) — 앱은 추가 설정 없이 그대로 동작한다.
// VITE_KB_DATA_SOURCE=supabase 로 켜면 Supabase Storage 번들 + 버전 캐시를 사용한다.

export type KbDatasetKey =
  | 'weekly'
  | 'weekly-trade'
  | 'monthly'
  | 'monthly-trade'
  | 'monthly-forecast';

// 데이터셋 → 정적 파일명(public/data/) 매핑.
export const STATIC_FILE: Record<KbDatasetKey, string> = {
  'weekly': 'kb-weekly.json',
  'weekly-trade': 'kb-weekly-trade.json',
  'monthly': 'kb-monthly.json',
  'monthly-trade': 'kb-monthly-trade.json',
  'monthly-forecast': 'kb-monthly-forecast.json',
};

// 데이터셋 → Storage 번들 오브젝트명(.gz). ingest 스크립트가 동일 규칙으로 업로드한다.
export const BUNDLE_OBJECT: Record<KbDatasetKey, string> = {
  'weekly': 'weekly.json.gz',
  'weekly-trade': 'weekly-trade.json.gz',
  'monthly': 'monthly.json.gz',
  'monthly-trade': 'monthly-trade.json.gz',
  'monthly-forecast': 'monthly-forecast.json.gz',
};

// 사람이 읽는 라벨(업데이트 모달 표시용).
export const DATASET_LABEL: Record<KbDatasetKey, string> = {
  'weekly': '주간 시세',
  'weekly-trade': '주간 거래',
  'monthly': '월간 시세',
  'monthly-trade': '월간 거래',
  'monthly-forecast': '월간 전망',
};

export const KB_DATA_SOURCE: 'static' | 'supabase' =
  import.meta.env.VITE_KB_DATA_SOURCE === 'supabase' ? 'supabase' : 'static';

export const KB_BUCKET: string = import.meta.env.VITE_KB_DATA_BUCKET ?? 'kb-data';

// Storage 내 버전 매니페스트 오브젝트명.
export const VERSIONS_OBJECT = 'versions.json';
