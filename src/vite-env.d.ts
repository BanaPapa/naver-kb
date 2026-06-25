/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  // KB 시계열 데이터 소스: 'static'(public/data/*.json, 기본) | 'supabase'(Storage 번들 + 버전 캐시)
  readonly VITE_KB_DATA_SOURCE?: 'static' | 'supabase';
  // KB 데이터 번들이 저장된 Supabase Storage 버킷명 (기본 'kb-data')
  readonly VITE_KB_DATA_BUCKET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
