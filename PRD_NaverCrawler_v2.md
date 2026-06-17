# PRD: 네이버 부동산 크롤러 (fin.land + new.land 하이브리드)

> **Version**: 3.0  
> **Date**: 2026-05-29  
> **Status**: Implemented (MVP 1.4+)  
> **변경 이력**:
> - v1.0 → v2.0 (API 파라미터 확정, 코드표 완성, 웹앱 아키텍처 전환)
> - v2.0 → v3.0 (이중 API 구조 확정: fin.land + new.land 병용 / cortarNo 기반 검색 / Bearer 토큰 자동 발급 / 실제 구현 기준으로 아키텍처·파일구조 정정)

---

## 1. 개요

### 1.1 목적
네이버 부동산의 비공개 API를 활용하여 특정 지역의 부동산 매물 정보를 수집하는 **독립형 웹 앱**을 구축한다. 상품 유형에 따라 `fin.land.naver.com`(모바일 API)과 `new.land.naver.com`(PC API)을 **병용**한다.

### 1.2 배경 (v3.0 갱신)
초기 설계(v2.0)는 `new.land.naver.com`이 nfront 차단(429)으로 사용 불가하다고 보고 `fin.land.naver.com` 단독으로 가려 했으나, 구현 과정에서 다음이 확정됨:

- **`fin.land.naver.com`** (모바일 API, 쿠키 인증): 단지 자동완성 검색 + 단지별 매물 리스트(`/complex/article/list`). 아파트·오피스텔 등 "단지" 개념이 있는 상품에 사용.
- **`new.land.naver.com`** (PC API): 적절한 헤더(쿠키 + Referer + Origin + Sec-Fetch-*)와 함께면 정상 응답. 두 갈래로 사용:
  - **단지 마커**(`/api/complexes/single-markers/2.0`): cortarNo + 바운딩박스로 단지 목록. 인증 토큰 불필요.
  - **매물 직접 조회**(`/api/articles`): 단지 개념이 없는 **빌라(VL)·단독/다가구(DDDGG)·사무실/지산** 등을 cortarNo로 직접 조회. **Authorization Bearer 토큰 필수** (자동 발급 — §3B 참조).
- **KB Land API**(`api.kbland.kr`): 3단계 지역 선택. KB의 `법정동코드`가 곧 네이버 `cortarNo`로 직결된다(핵심).

> 📌 **왜 빌라/단독만 토큰이 필요한가**: 중요도 때문이 아니라 **엔드포인트가 다르기 때문**이다. 아파트/오피스텔은 인증 비강제 엔드포인트(single-markers), 빌라/단독은 인증 강제 엔드포인트(/api/articles)를 탄다. 자세한 조사 과정은 [`docs/CASE_STUDY_naver_bearer_token.md`](./docs/CASE_STUDY_naver_bearer_token.md) 참조.

### 1.3 기술 스택 (v3.0 정정)
| 항목 | 선택 | 비고 |
|------|------|------|
| 프레임워크 | Vite + React | |
| 언어 | TypeScript | |
| 스타일 | Vanilla CSS (다크 테마) | |
| 백엔드 | **Vite dev-server 프록시** | 별도 Express 서버 없음. `vite.config.ts`의 proxy + 미들웨어가 백엔드 역할 |
| HTTP | **fetch** (브라우저 내장) | axios 미사용 |
| 토큰 자동 발급 | **puppeteer** (헤드리스 크롬) | new.land Bearer 토큰 자동 캡처 |

### 1.4 확장 계획
현재는 네이버 매물 크롤링 탭만 개발하지만, 추후 여러 크롤링 기능(상가 매물, 청약 데이터, 실거래 다운로드, 입주민 리뷰, 입지 분석, 학군 분석, 중개업소 분석 등)을 하나의 앱에 담을 예정이므로 **탭 기반 확장 가능 구조**로 설계한다.

---

## 2. 지역 선택 API (KB Land)

**Base URL**: `https://api.kbland.kr/land-price/price/areaName`

3단계 캐스케이딩 선택: 대지역(시/도) → 중지역(시/군/구) → 소지역(읍/면/동)

### 2.1 대지역 (Step 1)
```
GET https://api.kbland.kr/land-price/price/areaName
```
- 파라미터 없음
- 응답: 17개 시/도 (서울, 부산, 경기도 등)

### 2.2 중지역 (Step 2)
```
GET https://api.kbland.kr/land-price/price/areaName?법정동코드={code}
```
- `법정동코드`: 대지역의 2자리 코드 (예: `41` = 경기도)
- 응답: 해당 시/도의 시/군/구 목록

### 2.3 소지역 (Step 3)
```
GET https://api.kbland.kr/land-price/price/areaName?법정동코드={code}
```
- `법정동코드`: 중지역의 5자리 코드 (예: `41450` = 하남시)
- 응답: 해당 시/군/구의 읍/면/동 목록

### 2.4 KB Land 응답 구조
```json
{
  "dataHeader": { "resultCode": "10000", "message": "NO_ERROR" },
  "dataBody": {
    "data": [
      {
        "대지역명": "경기도",
        "중지역명": "하남시 ",
        "소지역명": "망월동",
        "법정동코드": "41450109"
      }
    ]
  }
}
```

> ⚠️ **주의**: `중지역명`에 후행 공백이 포함됨 (예: `"하남시 "`). 반드시 `.trim()` 처리 필요.

### 2.5 키워드 조합 규칙
선택된 지역 정보를 조합하여 네이버 검색 키워드로 사용:
```
대지역명.trim() + " " + 중지역명.trim() + " " + 소지역명.trim()
→ "경기도 하남시 망월동"
```
또는 중지역명+소지역명만 사용: `"하남시 망월동"`

---

## 3. 네이버 모바일 API 명세

**Base URL**: `https://fin.land.naver.com/front-api/v1`

### 3.1 단지 목록 검색

```
GET /search/autocomplete/complexes?keyword={keyword}&size={size}&page={page}
```

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|---|
| keyword | string | 검색어 (URL 인코딩) | `하남시 망월동` |
| size | number | 페이지당 결과 수 | `10` |
| page | number | 페이지 번호 (0-based) | `0` |

**응답 구조:**
```json
{
  "isSuccess": true,
  "result": {
    "hasNextPage": true,
    "totalCount": 47,
    "list": [
      {
        "complexNumber": 121257,
        "complexName": "미사랑데르Ⅲ",
        "type": "A02",
        "legalDivisionName": "경기도 하남시 망월동",
        "coordinates": { "xCoordinate": 127.193334, "yCoordinate": 37.561066 }
      }
    ]
  }
}
```

**핵심 필드:**
- `complexNumber` → 단지 고유번호 (후속 모든 API의 키)
- `type` → 부동산 유형 코드 (아래 코드표 참조)
- `hasNextPage` → `true`이면 page+1로 추가 요청 필요

---

### 3.2 개별 매물 리스트 (핵심 API) ✅ 실측 확정

```
POST /complex/article/list
Content-Type: application/json
```

**Request Body:**

```json
{
  "complexNumber": "27479",
  "tradeTypes": ["A1"],
  "pyeongTypes": [],
  "dongNumbers": [],
  "userChannelType": "PC",
  "articleSortType": "RANKING_DESC",
  "lastInfo": [],
  "size": 20
}
```

| 필드 | 타입 | 설명 | 예시 |
|---|---|---|---|
| complexNumber | **string** | 단지 고유번호 (문자열 필수) | `"27479"` |
| tradeTypes | string[] | 거래유형 배열 | `["A1"]`, `["A1","B1"]` |
| pyeongTypes | array | 평형 필터 (빈 배열 = 전체) | `[]` |
| dongNumbers | array | 동 필터 (빈 배열 = 전체) | `[]` |
| userChannelType | string | 채널 구분 | `"PC"` |
| articleSortType | string | 정렬 기준 | `"RANKING_DESC"` |
| lastInfo | array | 커서 (첫 요청: `[]`, 이후: 이전 응답값) | `[]` |
| size | number | 페이지당 결과 수 | `20` |

> ⚠️ **주의**: `complexNumber`는 반드시 **문자열**로 전송. 숫자로 보내면 400 에러 발생.

#### 페이지네이션 (커서 기반) ✅ 실측 확정

첫 페이지 응답에서 `seed`와 `lastInfo`가 반환됨:
```json
{
  "seed": "975ab210-b451-4392-ab0a-1042b37d84b4",
  "lastInfo": [0, -559.9365442079526, "2620761116"],
  "hasNextPage": false,
  "totalCount": 15,
  "list": [...]
}
```

다음 페이지 요청 시 `lastInfo` 배열을 그대로 body의 `lastInfo` 필드로 전달. (`seed`는 요청에 불필요)

#### 응답 항목 구조 (실제 캡처 데이터 기반)

```json
{
  "representativeArticleInfo": {
    "complexName": "미사강변루나리움",
    "articleNumber": "2625707386",
    "dongName": "511동",
    "tradeType": "A1",
    "realEstateType": "A01",
    "spaceInfo": {
      "supplySpace": 112.58,
      "contractSpace": 162.64,
      "exclusiveSpace": 84.99,
      "supplySpaceName": "112B1",
      "exclusiveSpaceName": "84B1",
      "nameType": "B1"
    },
    "buildingInfo": {
      "buildingConjunctionDate": "20150930",
      "approvalElapsedYear": 11
    },
    "verificationInfo": {
      "verificationType": "OWNER",
      "exposureStartDate": "2026-05-12",
      "articleConfirmDate": "2026-05-12"
    },
    "brokerInfo": {
      "cpId": "bizmk",
      "brokerageName": "푸르지오비비(031-793-3000)공인중개사사무소",
      "brokerName": "매경부동산"
    },
    "articleDetail": {
      "direction": "WS",
      "directionStandard": "거실 기준",
      "articleFeatureDescription": "비비강추입주매물 내부컨디션 우수해요",
      "directTrade": false,
      "floorInfo": "중/20",
      "floorDetailInfo": {
        "targetFloor": "중",
        "totalFloor": "20"
      }
    },
    "address": {
      "city": "경기도",
      "division": "하남시",
      "sector": "망월동",
      "coordinates": { "xCoordinate": 127.18156, "yCoordinate": 37.567345 }
    },
    "priceInfo": {
      "dealPrice": 1350000000,
      "warrantyPrice": 0,
      "rentPrice": 0,
      "managementFeeAmount": 300000,
      "priceChangeStatus": 0,
      "priceChangeHistories": []
    }
  },
  "duplicatedArticleInfo": {
    "representativePriceInfo": {
      "dealPrice": { "minPrice": 1350000000, "maxPrice": 1350000000 }
    },
    "realtorCount": 4,
    "directTradeCount": 0,
    "articleInfoList": [ /* 동일 매물 다른 중개사 목록 (같은 구조) */ ]
  }
}
```

---

### 3.3 단지 요약 정보 (보조)

```
GET /complex/mapComplexSummaryInfo?complexNumber={complexNumber}
```

---

### 3.4 단지별 매물 수 (보조)

```
GET /complex/article/count?complexNumber={complexNumber}
```

---

## 3B. new.land.naver.com API 명세 ✅ 실측 확정 (v3.0 신규)

**Base URL**: `https://new.land.naver.com` (Vite 프록시 경로: `/naver-new-api`)

`fin.land`과 별개로, cortarNo(법정동코드) 기반 검색에 사용한다. 모든 요청에 쿠키 + `Referer: https://new.land.naver.com/...` + `Origin` + `Sec-Fetch-*` 헤더가 필요하다(프록시가 주입).

### 3B.1 지역 경계(바운딩박스) 조회

```
GET /api/cortars?cortarNo={cortarNo}&zoom=16
```
- 응답의 `cortarVertexLists`(좌표 폴리곤)에서 topLat/bottomLat/leftLon/rightLon 산출.
- 폴백: `centerLat`/`centerLon` ± 0.05도 박스.

### 3B.2 단지 마커 조회 (아파트·오피스텔) — 토큰 불필요

```
GET /api/complexes/single-markers/2.0
    ?cortarNo={cortarNo}&zoom=16&priceType=RETAIL
    &realEstateType={APT:ABYG|OPST|...}
    &leftLon=&rightLon=&topLat=&bottomLat=  (3B.1에서 산출)
    &tag=::::::::&areaMin=&areaMax=&...
```
- 응답: 단지 마커 배열. 각 항목의 `markerId`(=complexNumber), `complexName` 수집.
- **Authorization 헤더 없이도 200 응답** (인증 비강제 엔드포인트).
- 수집한 complexNumber로 §3.2(`fin.land /complex/article/list`)를 호출해 매물 상세 수집.

### 3B.3 매물 직접 조회 (빌라·단독/다가구·사무실) — **Bearer 토큰 필수**

```
GET /api/articles
    ?cortarNo={cortarNo}&order=rank&realEstateType={VL:YR:DSD|DDDGG|APTHGJ:SMS}
    &tradeType=&tag=::::::::&priceType=RETAIL&page={1..N}
    &rentPriceMin=0&rentPriceMax=900000000&priceMin=0&priceMax=900000000
    &areaMin=0&areaMax=900000000&showArticle=false&sameAddressGroup=true&articleState=
Authorization: Bearer {JWT}      ← 없으면 401
Referer: https://new.land.naver.com/houses  (사무실은 /offices)
```
- "단지" 개념이 없는 상품이라 마커가 아니라 **매물 리스트를 직접** 받는다.
- 응답: `{ isMoreData: boolean, articleList: [...] }`. `isMoreData`로 페이지 순회.
- 네이버 UI에서도 이 상품들은 별도 탭("빌라·주택", "원룸·투룸" 등)이며 같은 검색에서 여러 보조 리퀘스트가 뜨지만 **매물이 담긴 것은 `/api/articles` 하나뿐**(나머지 clusters/interests 류는 무시).

#### realEstateType 매핑 (UI → new.land)
| UI 코드 | single-markers | /api/articles | 경로 |
|---------|----------------|---------------|------|
| `APT:JGC:JGB` | `APT:ABYG` | — | 마커 → fin.land 매물 |
| `OPST` | `OPST` | — | 마커 → fin.land 매물 |
| `VL` | — | `VL:YR:DSD` | 직접 조회 |
| `DDDGG` | — | `DDDGG` | 직접 조회 |
| `APTHGJ:SMS` | — | `APTHGJ:SMS` | 직접 조회 |

---

## 3C. Bearer 토큰 자동 발급 ✅ 구현 (v3.0 신규)

### 3C.1 토큰의 정체
`/api/articles`가 요구하는 `Authorization: Bearer` 값은 **HS256 서명 JWT**다.

```
payload = { "id": "REALESTATE", "iat": <발급시각>, "exp": <iat + 10800> }
```
- **로그인 자격증명이 아님**: 페이로드에 사용자 식별자가 없고 `id`는 고정값 `REALESTATE`.
- **만료 3시간**(10800초). 네이버 프론트엔드 JS가 자체적으로 생성·서명한다(서명 비밀키 비공개).
- 따라서 비밀키를 알아내 직접 서명하기보다, **네이버 JS가 발급한 진짜 토큰을 가로채 재사용**한다.

### 3C.2 자동 발급 메커니즘
`server/naverTokenProvider.mjs` (Node, 개발 서버 컨텍스트):

1. 저장된 쿠키로 **puppeteer 헤드리스 크롬** 구동 → `https://new.land.naver.com/houses` 로드.
2. 페이지가 발생시키는 `/api/*` 요청 헤더에서 `Authorization: Bearer ...`를 가로챔(인터셉션 없이 관찰만 → SPA 정상 동작).
3. 토큰을 메모리 캐시(JWT `exp` 디코드, 만료 5분 전 갱신, 동시 요청 단일화).

`vite.config.ts`의 미들웨어가 프록시보다 먼저 실행되어, `/api/articles` 요청에 수동 토큰(`x-naver-bearer`)이 없으면 자동 발급 토큰을 주입한다. 발급 실패 시 토큰 없이 진행 → 네이버 401 → UI에서 수동 입력 폴백 안내.

> 사용자 관점: 설정 탭에 **쿠키만** 넣으면 빌라/단독도 아파트처럼 토큰 신경 없이 작동. 첫 검색 시 헤드리스 크롬 기동(~3~5초), 이후 ~3시간 캐시 재사용.

---

## 4. 코드표 ✅ 확정

### 4.1 상품종류 (realEstateType)

| 코드 | 설명 | 비고 |
|------|------|------|
| APT | 아파트 | APT:JGC:JGB 병기 사용 |
| JGC | 재건축 | 아파트와 함께 사용 |
| JGB | 재개발 | 아파트와 함께 사용 |
| ABYG | 아파트 분양권 | |
| OPST | 오피스텔 | |
| OBYG | 오피스텔 분양권 | |
| VL | 빌라 | |
| DDDGG | 단독/다가구 | |
| JWJT | 전원주택 | |
| SGJT | 상가주택 | |
| SMS | 사무실 | |
| APTHGJ | 지식산업센터 | |

**UI 드롭다운 구성:**
| 표시명 | 전송값 |
|--------|--------|
| 아파트/재건축/재개발 | `APT:JGC:JGB` |
| 아파트 분양권 | `ABYG` |
| 오피스텔 | `OPST` |
| 오피스텔 분양권 | `OBYG` |
| 빌라 | `VL` |
| 단독/다가구 | `DDDGG` |
| 전원주택 | `JWJT` |
| 상가주택 | `SGJT` |
| 사무실 | `SMS` |
| 지식산업센터 | `APTHGJ` |

### 4.2 거래종류 (tradeType)

| 코드 | 설명 |
|------|------|
| A1 | 매매 |
| B1 | 전세 |
| B2 | 월세 |

### 4.3 면적 필터 (공급면적 기준)

| spcMin | spcMax | UI 표시명 |
|--------|--------|-----------|
| 0 | 1000 | 전체 |
| 0 | 79.3 | 59미만 |
| 79.4 | 89.2 | 59타입 |
| 89.3 | 105.7 | 74타입 |
| 105.8 | 119 | 84타입 |
| 119.1 | 1000 | 85초과 |

### 4.4 기타 코드

| 항목 | 코드 | 의미 |
|------|------|------|
| direction | SS | 남향 |
| | NN | 북향 |
| | ES | 동향 |
| | WS | 서향 |
| priceChangeStatus | 0 | 변동 없음 |
| | 1 | 가격 상승 |
| | -1 | 가격 하락 |
| verificationType | OWNER | 집주인 확인 |
| | DOC | 서류 확인 |
| | MOBL | 모바일 확인 |
| | NDOC1 | 미확인1 |
| | NDOC2 | 미확인2 |
| | NONE | 미확인 (협회) |

---

## 5. 공통 HTTP 요청 설정

### 5.1 네이버 API 필수 헤더

```javascript
const NAVER_HEADERS = {
  'Host': 'fin.land.naver.com',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'Referer': 'https://fin.land.naver.com/map',
  'Cookie': '<.env에서 로드>',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'sec-ch-ua-platform': '"Windows"',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};
```

### 5.2 KB Land API 헤더

```javascript
const KBLAND_HEADERS = {
  'User-Agent': 'Mobile'
};
```

### 5.3 차단 회피 전략

| 항목 | 설정 |
|---|---|
| 요청 간 딜레이 | 500ms ~ 1500ms (랜덤) |
| 단지 간 딜레이 | 1000ms ~ 3000ms (랜덤) |
| 429 에러 시 | 5초 대기 후 최대 3회 재시도 |
| 쿠키 만료 시 | 수동 갱신 (설정 페이지에서 입력) |

---

## 6. 크롤링 플로우

크롤링은 상품 유형에 따라 **두 갈래**로 분기한다 (`crawler.ts`).

```
[KB Land 3단계 지역 선택]  대지역 → 중지역 → 소지역
    │  legalDivisionCode = KB 법정동코드 = 네이버 cortarNo
    ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 분기 A: 아파트/오피스텔 (단지 기반)                              │
 │   1. GET new.land /api/cortars → 바운딩박스 산출               │
 │   2. GET new.land /api/complexes/single-markers/2.0           │
 │        → cortarNo+박스로 단지 목록(complexNumber) 수집          │
 │        (실패/빈 결과 시 fin.land 자동완성 검색으로 폴백)        │
 │   3. 각 complexNumber → POST fin.land /complex/article/list    │
 │        → 커서 페이지네이션(seed + lastInfo)로 매물 상세 수집    │
 ├───────────────────────────────────────────────────────────────┤
 │ 분기 B: 빌라/단독·다가구/사무실 (직접 조회, 단지 없음)          │
 │   1. (자동) Bearer 토큰 발급/캐시 — §3C                        │
 │   2. GET new.land /api/articles?cortarNo=..&page=1..N         │
 │        → isMoreData로 페이지 순회, 매물 직접 수집              │
 └───────────────────────────────────────────────────────────────┘
    │
    ▼
[데이터 정규화 → Property 객체]  normalizeArticleInfo / normalizeNewLandArticle
    │
    ▼
[결과 테이블 UI + 내보내기 (Excel/JSON)]
```

> DIRECT_ARTICLE_TYPES = `{ VL, DDDGG, APTHGJ:SMS }` 는 분기 B, 그 외는 분기 A.

---

## 7. 데이터 모델

### 7.1 Property 인터페이스

```typescript
interface Property {
  // 단지 정보
  complexNumber: number;
  complexName: string;
  dongName: string;

  // 매물 정보
  articleNumber: string;
  realEstateType: string;
  tradeType: string;

  // 가격 정보
  dealPrice: number;
  warrantyPrice: number;
  rentPrice: number;
  managementFee: number;
  priceChangeStatus: number;
  priceChangeHistories?: Array<{ modifiedDate: string; dealPrice: number }>;

  // 면적 정보
  supplySpace: number;
  exclusiveSpace: number;
  supplySpaceName: string;
  exclusiveSpaceName: string;

  // 위치/건물 정보
  direction: string;
  floorInfo: string;
  targetFloor: string;
  totalFloor: string;
  address: string;
  lat: number;
  lng: number;

  // 부가 정보
  articleFeature: string;
  brokerageName: string;
  brokerName: string;
  confirmDate: string;
  buildDate: string;
  realtorCount: number;
  imageCount: number;
  verificationType: string;
}
```

---

## 8. 앱 아키텍처

### 8.1 파일 구조

> ⚠️ v3.0 정정: 별도 Express 서버는 없다. "백엔드"는 `vite.config.ts`의 프록시 +
> 토큰 주입 미들웨어이며, API 호출 서비스는 모두 `src/services/`(브라우저)에 있다.

```
C:\dev2\naver_new\
├── package.json
├── vite.config.ts                # 프록시(/naver-api, /naver-new-api) + 토큰 주입 미들웨어 = 백엔드
├── tsconfig.json
├── server/
│   └── naverTokenProvider.mjs    # (Node) puppeteer로 new.land Bearer 토큰 자동 발급·캐시
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css                 # 다크 테마
│   ├── types/
│   │   └── index.ts              # Property, 코드표 상수(REAL_ESTATE_TYPES, NAVER_TYPE_MAP 등)
│   ├── components/
│   │   ├── Layout.tsx            # 탭 기반 레이아웃 (확장 대비)
│   │   ├── Sidebar.tsx
│   │   ├── SearchPanel.tsx
│   │   ├── RegionSelect.tsx      # 3단계 지역 드롭다운
│   │   ├── FilterSelect.tsx      # 상품/방식/면적
│   │   ├── Monitor.tsx
│   │   ├── LogPanel.tsx
│   │   ├── ResultTable.tsx
│   │   ├── NaverCrawlerTab.tsx   # 네이버 매물 탭 (현재 유일 탭)
│   │   └── CookieSettings.tsx    # 쿠키 + Bearer 토큰(폴백) 설정
│   ├── services/
│   │   ├── kbland.ts             # KB Land 3단계 지역 API (api.kbland.kr 직접 호출)
│   │   ├── naverApi.ts           # fin.land + new.land API 호출
│   │   ├── crawler.ts            # 크롤링 메인 로직 (분기 A/B)
│   │   ├── normalizer.ts         # 응답 → Property 변환
│   │   ├── api.ts                # Excel/JSON 내보내기 + 포맷 유틸
│   │   └── utils.ts              # randomDelay 등
│   └── hooks/
│       └── useCrawler.ts
├── docs/
│   ├── ARCHITECTURE.md           # as-built 아키텍처 (개발자용)
│   └── CASE_STUDY_naver_bearer_token.md  # 401 조사 사례 (학습/강의용)
├── PRD_NaverCrawler_v2.md
├── DEV_PROMPT.md
└── CLAUDE.md
```

### 8.2 확장 가능 구조 설계

```
Layout.tsx
├── Sidebar (탭 메뉴)
│   ├── 네이버 매물 ← 현재 개발 대상
│   ├── 상가 매물 (추후)
│   ├── 청약 데이터 (추후)
│   ├── 실거래 다운로드 (추후)
│   └── ...
├── ContentArea (선택된 탭의 컨텐츠)
│   └── NaverCrawlerTab/
│       ├── SearchPanel + RegionSelect + FilterSelect
│       ├── Monitor + LogPanel
│       └── ResultTable
└── Settings (쿠키 등 공통 설정)
```

---

## 9. UI 디자인 사양

### 9.1 컬러 팔레트 (다크 테마)

| 용도 | 색상 |
|------|------|
| 배경 | `#0d1117` |
| 사이드바 배경 | `#161b22` |
| 카드 배경 | `#1c2128` |
| 포인트 (시안/틸) | `#00d4aa` |
| 텍스트 (기본) | `#e6edf3` |
| 텍스트 (보조) | `#8b949e` |
| CTA 버튼 | 블루→시안 그라디언트 |
| 에러 | `#f85149` |

### 9.2 레이아웃 참고

검색 조건 패널 (왼쪽) + Monitor/Logs (오른쪽) 2컬럼 구성.
하단에 결과 테이블.

---

## 10. 에러 처리

| 상황 | 대응 |
|---|---|
| HTTP 429 | 지수 백오프(5/12/30초) + 지터로 최대 3회 재시도 (`withRetry`) |
| HTTP 401 (new.land /api/articles) | Bearer 토큰 자동 재발급. 발급 실패 시 설정 탭 수동 입력 안내 |
| HTTP 4xx | 로그 출력, 해당 단지 스킵 |
| 네트워크 에러 | 로그 출력 후 해당 단계 중단 |
| 빈 응답 (list: []) | 정상 처리 (매물 0건) |
| 쿠키 만료 | 에러 메시지 + 설정 페이지로 유도 |

---

## 11. 기존 코드 참조

### 11.1 VBA 지역 선택 로직 (Area_Select)

기존 VBA 매크로에서 KB Land API를 호출하는 3단계 로직:
```vba
' 대지역 (num=1): https://api.kbland.kr/land-price/price/areaName
' 중지역 (num=2): ?법정동코드=XX
' 소지역 (num=3): ?법정동코드=XXXXX
```

### 11.2 기존 NaverCrawlerService (TypeScript, 차단됨)

기존 PC API 기반 코드 구조 참조:
- `NaverCrawlerService` 클래스 패턴 (logCallback + statusCallback)
- `run()` → `getRegionMeta()` → `getMarkers()` → `getArticlesByComplex()` 흐름
- `mapToProperty()` 데이터 변환 패턴

> ⚠️ 기존 코드는 `new.land.naver.com/api` (PC API)를 사용하므로 **엔드포인트와 응답 구조가 다름**.
> 전체 흐름 패턴만 참고하고, API 호출부는 본 PRD v2.0 기준으로 새로 작성할 것.
