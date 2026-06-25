# KB 시계열 데이터 — Supabase Storage 전환 가이드

KB 시계열 차트 데이터의 소스를 **정적 파일(public/data/\*.json)** 에서 **Supabase Storage 번들 + 버전 캐시** 로 전환하는 방법.

## 동작 개요

- 데이터는 **전량(모든 지역)** 을 받아 메모리에 두고 즉시 전환하는 모델을 그대로 유지한다.
  (지역마다 그때그때 쿼리하지 않는다.)
- 단, **분석에 포함된 탭(데이터셋) 단위**로만 받는다. 데이터셋은 5개:
  `weekly`, `weekly-trade`, `monthly`, `monthly-trade`, `monthly-forecast`.
- 클라이언트는 진입 시 `versions.json`(작은 매니페스트)만 확인 → **IndexedDB 캐시 버전과 같으면 즉시 로드(다운로드 없음)**,
  다르면 **바뀐 번들만** 진행률 모달과 함께 내려받아 gunzip·캐시 후 사용.
- 데이터 갱신(주간 1회 / 월간 1회)은 ingest 스크립트로 번들을 재발행하면 버전이 바뀌어
  다음 접속 시 사용자에게 업데이트 모달이 뜬다.

> 버전은 파일 내용 해시라, **실제로 바뀐 데이터셋만** 재다운로드된다.

## 코드 구성 (이미 포함됨)

- `src/kb/shared/lib/kb-source/` — config / idb-cache / progress-store / loader
- `src/kb/entities/**/api/*-local.ts` — `loadKbJson(key)` 로 소스 추상화(차트·UI 무수정)
- `src/kb/features/data-update/` — 업데이트 진행률 모달(KbModule에 마운트됨)
- `scripts/kb-publish-bundles.mjs` — 번들 발행(ingest)
- `supabase/kb-storage.sql` — Storage 읽기 정책

## 활성화 절차

1. **Storage 정책 적용**: Supabase 대시보드 → SQL Editor 에서 `supabase/kb-storage.sql` 실행.

2. **번들 발행(최초 1회 + 갱신마다)**: 로컬 또는 CI에서
   ```bash
   SUPABASE_URL=<프로젝트 URL> \
   SUPABASE_SERVICE_ROLE_KEY=<service_role 키> \
   node scripts/kb-publish-bundles.mjs
   ```
   - 버킷 `kb-data` 가 없으면 자동 생성(private).
   - `public/data/*.json` 을 gzip 업로드하고 `versions.json` 을 갱신한다.
   - `public/data/*.json` 을 최신 데이터로 갈아끼운 뒤 이 스크립트만 다시 돌리면 업데이트 완료.

3. **앱 환경변수 설정**(Vercel / 로컬 `.env`):
   ```
   VITE_KB_DATA_SOURCE=supabase
   VITE_KB_DATA_BUCKET=kb-data   # 기본값과 같으면 생략 가능
   ```
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 는 기존 값을 그대로 사용(인증 세션으로 Storage 읽음).

4. **검증**:
   - 첫 접속: KB 탭 진입 시 업데이트 모달 + 진행률 → 차트 렌더.
   - 새로고침: 모달 없이 즉시 렌더(IndexedDB 캐시).
   - 데이터 재발행 후 접속: 바뀐 데이터셋만 다시 다운로드.

## 롤백

`VITE_KB_DATA_SOURCE=static` 으로 되돌리면 즉시 정적 파일 모드로 복귀한다(코드 변경 불필요).
`supabase` 모드라도 Supabase 미설정이면 자동으로 static 으로 폴백한다.

## 비고

- `public/data/*.json` 은 정적 폴백 및 ingest 입력으로 계속 유지한다(삭제하지 말 것).
- 브라우저 gzip 해제는 `DecompressionStream`(모던 브라우저 표준)을 사용한다.
