# 개발 지시서: 네이버 부동산 크롤러 웹앱

## 🎯 미션

`c:\Dev2\naver_new\` 에 네이버 부동산 매물 크롤러 독립형 웹앱을 개발해라.
PRD는 `c:\Dev2\naver_new\PRD_NaverCrawler_v2.md` 에 있다. **반드시 먼저 읽고** 시작해라.

---

## 📋 핵심 요구사항 요약

### 앱 구조
- **프론트엔드**: Vite + React + TypeScript + Vanilla CSS (다크 테마)
- **백엔드**: Express.js (Naver/KB API 프록시, 쿠키 주입)
- **한 프로젝트**에 프론트+백엔드 통합 (`concurrently`로 동시 실행)
- 추후 여러 크롤링 기능을 탭으로 추가할 예정이므로 **탭 기반 확장 가능 구조**로 설계

### 크롤링 플로우
1. **KB Land API로 3단계 지역 선택** (대지역→중지역→소지역 캐스케이딩 드롭다운)
2. 선택된 지역명을 조합하여 **Naver complexes 검색** (페이지네이션)
3. 각 단지별 **article/list 호출** (커서 페이지네이션: seed + lastInfo)
4. 결과를 **테이블 UI**로 표시 + **CSV/JSON 내보내기**

### API 상세
- KB Land: `https://api.kbland.kr/land-price/price/areaName` (헤더: `User-Agent: Mobile`)
- Naver: `https://fin.land.naver.com/front-api/v1/` (쿠키 필수, Express 프록시 경유)
- article/list 파라미터: `complexNumber`, `tradeType`, `realEstateType`, `spcMin`, `spcMax`, `order`, `page`, `size`
- 페이지네이션: 응답의 `seed` + `lastInfo`를 다음 요청에 전달, `hasNextPage`로 판단

### 코드표 (드롭다운 옵션)
**상품**: 아파트/재건축/재개발(`APT:JGC:JGB`), 분양권(`ABYG`), 오피스텔(`OPST`), 빌라(`VL`), 사무실(`SMS`), 지식산업센터(`APTHGJ`) 등 12종
**거래**: 매매(`A1`), 전세(`B1`), 월세(`B2`)
**면적**: 전체(0~1000), 59미만, 59타입, 74타입, 84타입, 85초과 (spcMin/spcMax 쌍)

### UI 디자인
- **다크 테마**: 배경 `#0d1117`, 사이드바 `#161b22`, 포인트 `#00d4aa`
- 왼쪽 사이드바 + 검색조건 패널 + Monitor/Logs 패널
- 하단에 결과 테이블
- 현대적이고 프리미엄한 UI (글래스모피즘, 미세 애니메이션)
- 폰트: Inter + Pretendard (한글)

### 쿠키 관리
- 첫 버전은 `.env` 파일에 `NAVER_COOKIE=...` 수동 입력
- 앱 내 설정 페이지에서 쿠키를 텍스트로 붙여넣는 UI도 제공
- 크롤링 시작 전 쿠키 유효성 검증 (간단한 API 호출 테스트)

---

## 🔧 개발 순서

### Phase 1: 프로젝트 초기화 + 백엔드
1. Vite + React + TypeScript 프로젝트 생성
2. Express 백엔드 설정 (server/ 디렉토리)
3. `concurrently`로 프론트+백엔드 동시 개발 서버
4. KB Land 3단계 지역 API 서비스
5. Naver API 프록시 (쿠키 주입)
6. 크롤링 엔진 (SSE로 진행 상태 스트리밍)
7. 데이터 정규화 (normalizer)

### Phase 2: 프론트엔드
1. 다크 테마 CSS 디자인 시스템
2. 탭 기반 레이아웃 (Sidebar + ContentArea)
3. 3단계 지역 드롭다운 (RegionSelect)
4. 필터 드롭다운 (상품/방식/면적)
5. Monitor 패널 (진행률, 건수)
6. Log 패널 (실시간 로그)
7. 결과 테이블 (정렬, 필터)

### Phase 3: 연동 + 마무리
1. 프론트↔백엔드 SSE 연결
2. 시작/중지 기능
3. CSV/JSON 내보내기
4. 에러 핸들링 (429 재시도, 쿠키 만료 감지)
5. 쿠키 설정 UI

---

## ⚠️ 주의사항

1. **KB Land 중지역명에 후행 공백 있음** → 반드시 `.trim()` 처리
2. **Naver API는 쿠키 없으면 429** → 모든 호출은 Express 프록시 경유
3. **차단 회피 딜레이 필수**: 요청 간 500~1500ms, 단지 간 1000~3000ms
4. **article/list 응답에 `duplicatedArticleInfo.articleInfoList`** 안에 동일 매물의 다른 중개사 정보가 있음 → 이것도 개별 Property로 변환
5. **확장 가능 구조**: 현재는 네이버 매물 탭만 개발하지만, Sidebar에 다른 탭을 쉽게 추가할 수 있도록 컴포넌트 분리
6. **프로젝트 디렉토리**: `c:\Dev2\naver_new\` (이미 `CLAUDE.md` 존재)

---

## 📁 참조 파일

| 파일 | 설명 |
|------|------|
| `c:\Dev2\naver_new\PRD_NaverCrawler_v2.md` | 전체 PRD (API 스펙, 응답 구조, 코드표) |
| `c:\Dev2\naver_new\CLAUDE.md` | 프로젝트 설정 |

---

## ✅ 완료 기준

1. `npm run dev`로 프론트+백엔드 동시 실행 가능
2. 3단계 지역 드롭다운이 KB Land API로 정상 동작
3. 검색 조건 설정 후 "데이터 수집 시작" 버튼으로 크롤링 실행
4. Monitor에서 진행률 실시간 업데이트
5. 결과 테이블에서 매물 정보 표시
6. CSV 내보내기 동작
7. 다크 테마 UI가 프리미엄하고 현대적인 디자인
