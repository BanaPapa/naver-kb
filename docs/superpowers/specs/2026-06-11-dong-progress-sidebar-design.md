# 동별 실시간 진행률 시각화 + 로그 사이드바 이전

작성일: 2026-06-11

## 배경 / 목적

중지역(예: 수원 권선구)만 선택해 검색하면 하위 동(소지역)을 순회하며 수집한다.
현재는 진행 상황이 메인 뷰 하단의 텍스트 로그로만 표시되어 직관성이 떨어진다.

목표:
1. 텍스트 로그를 좌측 사이드바 하단의 빈 공간으로 이전한다.
2. 검색 중에는 직접 로그 대신 **동별 실시간 진행률 막대(에너지바)** 로 시각화한다.
   - 동을 위에서 아래로 순차 나열, 첫 동이 0%→100% 채워지며 완료 시 우측에 수집 건수 표시,
     이어서 다음 동의 막대가 작동.

## 결정 사항 (브레인스토밍 합의)

- **레이아웃 A안**: 16개 동을 모두 세로로 나열, 패널 내부 스크롤. (사용자 설명 그대로)
- **텍스트 로그**: 그래프 + 접이식 상세로그. 평소엔 진행률 그래프만, `상세 로그 ▾` 토글로 텍스트 로그 펼침.
- **단일 지역**(동 1개 / 시·도만): 막대 1개로 동일하게 표시(일관 UI).

## 데이터 모델 (`src/types/index.ts`)

```ts
export interface DongProgress {
  name: string;                          // 소지역명 (예: 고색동)
  status: 'pending' | 'active' | 'done';
  pct: number;                           // 0~100
  count: number;                         // 그 동에서 수집된 건수
  indeterminate?: boolean;               // 총량 미상(빌라/단독/지산) → 펄스 애니메이션
}
```

## 진행률 산정 방식

- **아파트류**(단지 기반): 한 동에서 `pct = 완료단지 / 전체단지 × 100`.
  단지 목록 수신 직후부터 단지 하나 완료할 때마다 막대 갱신.
  단지 수가 적은 동은 계단식으로 점프할 수 있음(총량 기반 정직한 표시).
  전체단지 0개면 즉시 100%, count=0.
- **빌라/단독/지산**(`DIRECT_ARTICLE_TYPES`, 페이지 기반, 총량 미상):
  `indeterminate=true`로 펄스 애니메이션. % 대신 누적 건수 실시간 표시.
  페이지 소진 시 `pct=100`, `indeterminate=false`로 스냅.
- 완료 순간: `status='done'`, `pct=100`, 우측에 그 동 count 표시 → 다음 동 `active`.

## 데이터 흐름

### `src/services/crawler.ts`
- `CrawlerOptions`에 `onDongs: (dongs: DongProgress[]) => void` 추가.
- `RunContext`에 `dongStates: DongProgress[]` 추가.
- `start()`: `resolveTargets()` 직후 모든 target을 `pending`(pct 0, count 0,
  indeterminate = isDirect)으로 만들어 `emitDongs()` 1회 호출 → 전체 막대가 0%로 선렌더.
- 동 순회 루프에서 현재 동 index를 helper에 전달. helper가 `ctx.dongStates[i]`를 갱신 후 `emitDongs()` 호출.
- `private emitDongs(ctx)`: `onDongs(ctx.dongStates.map(d => ({ ...d })))` (불변 복사본 전달).
- `crawlComplexTarget(ctx, target, dongIndex, naverTypes)`:
  - baseline = ctx.totalProperties; 상태 active로 전환 후 emit.
  - Phase 1(단지 목록) 후 complexes.length=0 → done, pct=100, count=0, emit, return.
  - Phase 2: 단지마다 `pct = round((i+1)/complexes.length*100)`, `count = ctx.totalProperties - baseline`, emit.
  - 종료 후 done, pct=100, count=delta, emit.
- `crawlDirectTarget(ctx, target, dongIndex)`:
  - baseline; active + indeterminate=true, emit.
  - 페이지마다 count=delta로 emit(pct 유지).
  - 종료 시 done, pct=100, indeterminate=false, count=delta, emit.

### `src/hooks/useCrawler.ts`
- `CrawlerState`에 `dongs: DongProgress[]`, `regionName: string` 추가.
- `start()`에서 초기화: `dongs: []`, `regionName: config.midName || config.legalDivisionName`.
- `onDongs` 콜백으로 `state.dongs` 갱신.

### `src/App.tsx`
- 이미 `useCrawler` 보유. `Sidebar`에 `dongs`, `logs`, `status`, `regionName`,
  `onClearLogs` 전달.

## UI 컴포넌트

### 새 컴포넌트 `src/components/CrawlProgressPanel.tsx`
- props: `dongs: DongProgress[]`, `logs: LogEntry[]`, `status`, `regionName`, `onClearLogs`.
- 렌더 조건: `(status === 'running' || status === 'done') && dongs.length > 0`. 그 외 null.
- 구조:
  - 헤더: `수집 진행 · {regionName}` + `{doneCount}/{dongs.length}`.
  - 동 리스트(스크롤, max-height): 각 동 = 이름 + 막대 + (완료 시 count / 진행 시 % / 대기 시 '대기').
    - active 동은 강조(teal), done은 막대 100%·count 강조, indeterminate는 펄스 애니메이션.
  - 푸터 `상세 로그 ▾` 토글(로컬 useState) → 펼치면 컴팩트 로그 리스트(시간·아이콘·메시지) + 지우기 버튼.

### `src/components/Sidebar.tsx`
- props 추가: `dongs`, `logs`, `status`, `regionName`, `onClearLogs`.
- 네비(`eos-nav`)와 계정 블록(`eos-acct`) 사이에 `<CrawlProgressPanel ... />` 렌더.
- `collapsed`(아이콘 전용) 상태에서는 패널 숨김.

### `src/components/NaverCrawlerTab.tsx`
- 기존 하단 `LogPanel` 제거(로그가 사이드바로 이동). `Monitor`(KPI)는 유지.

### `src/index.css`
- 사이드바 진행률 패널 스타일(`.crawl-prog`, `.cp-head`, `.cp-list`, `.cp-dong`,
  `.cp-bar`/`.cp-bar i`, indeterminate 펄스 keyframes, `.cp-log` 접이식 영역).
- 다크 테마·teal(#00d4aa) 포인트 유지.

## 엣지 케이스

- 동 1개(소지역 직접 선택)·시도만 선택 → 막대 1개로 동일 표시.
- 검색 전(idle)·설정 탭·사이드바 접힘 → 패널 숨김(기존 모습 유지).
- 동 목록 조회 실패 폴백 → 중지역 단일 막대 1개.
- 중지 시 진행 중이던 동은 마지막 상태로 정지(추가 갱신 없음).

## 테스트 / 검증

- `npm run typecheck`, `npm run build` 통과.
- 수동: 권선구(아파트) → 동별 막대 순차 진행·완료 건수 표시 확인.
  빌라/단독/지산 → indeterminate 펄스·누적 건수 확인. 소지역 단일 → 막대 1개.
  상세 로그 토글 동작. 사이드바 접힘 시 패널 숨김.

## 비목표 (YAGNI)

- 동별 재시도/일시정지 등 개별 제어 UI는 만들지 않는다.
- 진행률 추정 정교화(ETA 등)는 범위 밖.
