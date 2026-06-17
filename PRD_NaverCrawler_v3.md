# PRD: 네이버 부동산 크롤러 (fin.land.naver.com)

> **Version**: 3.1
> **Date**: 2026-05-26
> **Status**: Operational (검증 완료)
> **변경 이력**: v3.0 → v3.1
> - 중복 매물 수집 제거: `duplicatedArticleInfo.articleInfoList` 순회 삭제, 대표 매물만 수집 (realtorCount 배지로 중개사 수 표시)
> - 단지 필터를 `complexNumber` 기반에서 `complexName` 기반으로 변경 (같은 번호에 다른 단지명이 존재하는 케이스 대응)
> - React key 전략 변경: `complexNumber-articleNumber-brokerageName` → `idx-articleNumber` (중복 키 충돌 방지)
> - normalizer에 명시적 타입 강제 변환 추가 (`Number()`, `String()`)
> - React key 충돌로 인한 필터/정렬 무반응 버그 수정
>
> **이전 변경 이력**: v2.0 → v3.0
> - 실측을 통한 운영 현실 반영 (WAF 동작, 쿠키 필수화)
> - Express 서버 → Vite 프록시로 단순화 (실제 구현)
> - 후처리 계층(필터/정렬) 명세화
> - 실패한 우회 시도(complexClusters / m.land.naver.com)의 교훈 명시
> - 면적 필터 실배선 적용 (v2까지 dead wiring이었음)

---

## 0. 핵심 요약 (Executive Summary)

`fin.land.naver.com`의 모바일 API를 활용해 특정 지역의 부동산 매물을 수집하는 **독립형 웹앱**.

3단계 구조:
1. **수집 입력** — KB Land 3단계 지역 선택 + 상품/거래/면적 필터
2. **수집 실행** — Naver `/search/autocomplete/complexes` (Phase 1) → `/complex/article/list` (Phase 2)
3. **후처리·표시** — 결과 테이블에서 거래방식/단지/면적 추가 필터 + 정렬 + CSV/JSON 내보내기

본 PRD가 v2와 가장 다른 점:
- **쿠키는 사실상 필수** (v2에선 "선택적"으로 명시했으나 운영상 부정확).
- **Express 백엔드 없음.** Vite dev 프록시가 그 역할을 수행. (프로덕션은 Vercel Functions로 별도 설계 — §13)
- **complexClusters / m.land.naver.com 우회 금지.** 운영 사고 사례로 §2.4에 명시.

---

## 1. 개요

### 1.1 목적
네이버 부동산(`fin.land.naver.com`)의 모바일 API를 활용해 사용자가 선택한 지역·상품·거래·면적 조건의 부동산 매물 정보를 수집하고, 정렬·필터·내보내기까지 단일 화면에서 처리하는 **독립형 SPA**.

### 1.2 배경
- 기존 PC API(`new.land.naver.com`)는 nfront 보안 강화로 익명 접근 불가.
- 모바일 API(`fin.land.naver.com/front-api/v1/`)는 **유효한 세션 쿠키와 결합**된 XHR 호출에 한해 접근 가능. 익명 XHR은 WAF가 선택적으로 거부 (자세한 사항 §2).
- KB Land API(`api.kbland.kr`)로 3단계 지역 선택을 안정적으로 제공.

### 1.3 기술 스택 (실측 기반)

| 항목 | 채택 |
|------|------|
| 프레임워크 | Vite + React 18 |
| 언어 | TypeScript (strict) |
| 스타일 | Vanilla CSS, 다크 테마 |
| HTTP | Browser `fetch` (axios 사용 안 함) |
| 프록시 | **Vite dev server proxy** (개발) / Vercel Functions (프로덕션 예정) |
| 상태 관리 | React `useState` + custom hooks (`useCrawler`) |
| 저장소 | `localStorage` (Naver 쿠키 전용) |
| 빌드/실행 | `npm run dev` (포트 5174) |

### 1.4 확장 계획
현재는 네이버 매물 탭만 운영. 추후 상가/청약/실거래/리뷰/입지·학군/중개업소 분석 탭을 같은 앱에 누적할 수 있도록 **탭 기반 확장 구조** 유지.

---

## 2. ★ 운영 현실 — Naver WAF 모델

> v2에서는 다루지 않았으나, 가장 자주 부딪히는 실패 원인이므로 가장 앞에 둠.

### 2.1 WAF 격상 단계 (실측 가설)

```
[A] 깨끗한 IP
    autocomplete 등 가벼운 호출 → 쿠키 없이도 통과
                      │
                      │ 누적: 무거운 API(complexClusters/cluster API) 호출,
                      │       이상 패턴(짧은 간격, 모바일 도메인에 데스크톱 UA 등)
                      ▼
[B] 의심 IP (가장 흔히 머무는 상태)
    모든 /front-api XHR → 쿠키 없으면 429
    유효 쿠키 동봉 시 → 통과
                      │
                      │ 누적: 쿠키 없는 호출 반복, 429 누적
                      ▼
[C] IP 일시 차단
    쿠키 있어도 429
    수 분~수 시간 cooldown 후 [B]로 복귀
```

**운영 기본 전제: 항상 [B] 상태라고 가정한다.** → 쿠키는 옵션이 아닌 **사실상 필수**.

### 2.2 쿠키 요구 조건

설정 탭에 다음 토큰이 포함된 `Cookie:` 문자열을 입력:

- **필수**: `NID_AUT`, `NID_SES` (인증/세션 — 만료 시 갱신 필요)
- **권장**: `BUC`, `NNB`, `ASID`, `NACT`, `nid_inf` (Naver 행동/디바이스 식별)
- **참고**: `nhn.realestate.article.rlet_type_cd` 등 부동산 컨텍스트 쿠키도 함께 복사 권장

쿠키 추출 절차는 §11 운영 가이드 참조.

### 2.3 쿠키 처리 정책

| 항목 | 정책 |
|---|---|
| 저장 위치 | 브라우저 `localStorage` 키 `naver_cookie` (외부 송신 금지) |
| 전송 채널 | 프론트가 `X-Naver-Cookie` 커스텀 헤더로 전달 → Vite 프록시가 `Cookie:` 헤더로 변환 후 Naver에 전송 |
| 갱신 트리거 | 수집 중 429 누적 / `NID_SES` 만료 (보통 며칠) |
| 만료 감지 | 본 PRD v3에서는 별도 자동 감지 없음. 사용자가 로그 안내를 보고 수동 갱신 |

### 2.4 ★ 금지 사항 — 운영 사고 사례

**다음 두 가지 우회는 반드시 피한다. 사고 기록과 함께 명시:**

1. **지도 클러스터 API (`POST /complex/complexClusters`) 를 단지 목록 수집에 사용 금지.**
   - 사고 배경: v1.1 개발 중 "더 풍부한 데이터"를 이유로 단지 목록 수집을 `searchComplexes`(자동완성)에서 `complexClusters`(지도)로 교체.
   - 즉시 429가 발생. 이 엔드포인트는 인간의 지도 조작 패턴(낮은 빈도)에 맞춰 WAF가 강하게 통제.
   - 추가로, 반복 호출은 IP의 WAF 격상([B] → [C])을 가속.
   - **항상 `/search/autocomplete/complexes` 사용.**

2. **모바일 도메인(`m.land.naver.com`) 우회 호출 금지.**
   - 사고 배경: 1번 사고를 "쿠키/IP 문제"로 잘못 진단한 뒤 `m.land.naver.com/cluster/ajax/complexList`로 우회 시도.
   - 데스크톱 환경(데스크톱 User-Agent)에서 모바일 도메인을 호출 → 비정상 패턴으로 인식되어 WAF 격상 가속.
   - 매개변수 매핑(코드표)도 PC API와 달라 결과 신뢰도 낮음.
   - **단일 진실 도메인: `fin.land.naver.com/front-api/v1/`**.

이 두 사항은 §14 "재개발 가이드"에도 명시.

---

## 3. 지역 선택 API (KB Land)

### 3.1 엔드포인트

**Base URL**: `https://api.kbland.kr/land-price/price/areaName`

3단계 캐스케이딩 선택: 대지역(시/도) → 중지역(시/군/구) → 소지역(읍/면/동).

| Step | 호출 | 파라미터 |
|---|---|---|
| 1 (대지역) | `GET …/areaName` | 없음 |
| 2 (중지역) | `GET …/areaName?법정동코드={2자리}` | 대지역 코드 2자리 (예: `41` = 경기도) |
| 3 (소지역) | `GET …/areaName?법정동코드={5자리}` | 중지역 코드 5자리 (예: `41135` = 성남시 분당구) |

### 3.2 헤더

```
User-Agent: Mobile
```
> KB Land는 임의의 모바일 UA만 요구하며 쿠키 불필요.

### 3.3 응답 구조

```json
{
  "dataHeader": { "resultCode": "10000", "message": "NO_ERROR" },
  "dataBody": {
    "data": [
      {
        "대지역명": "경기도",
        "중지역명": "성남시 분당구",
        "소지역명": "정자동",
        "법정동코드": "4113510300"
      }
    ]
  }
}
```

### 3.4 ★ 데이터 정제 규칙 (중요)

| 필드 | 정제 |
|---|---|
| `대지역명` | 그대로 사용 (level 1) |
| `중지역명` | **반드시 `.trim()`** — 후행 공백 포함된 케이스 있음 (`"하남시 "`) |
| `소지역명` | `.trim()` |
| `법정동코드` | level 1 = 앞 2자리, level 2 = 앞 5자리, level 3 = 전체 10자리 |

### 3.5 ★ 키워드 조합 규칙 — Naver 자동완성 호출용

선택된 지역을 Naver 검색 키워드로 조합:

```
keyword = [중지역명, 소지역명].filter(Boolean).join(' ')
        || 대지역명
```

| 선택 상태 | keyword 예시 |
|---|---|
| 대 + 중 + 소 | `"성남시 분당구 정자동"` |
| 대 + 중 (소 미선택) | `"성남시 분당구"` |
| 대 만 (중 미선택) | `"경기도"` (광역, 결과 폭이 큼) |

> ⚠️ 대만 선택 시 자동완성 결과가 폭주할 수 있으므로 UI는 **중지역 이상을 권장**하되 강제하지 않음.

---

## 4. Naver API 명세 (실측 확정)

**Base URL**: `https://fin.land.naver.com/front-api/v1`

### 4.1 단지 목록 검색 — 자동완성 (Phase 1)

```
GET /search/autocomplete/complexes?keyword={keyword}&size={size}&page={page}
```

| 파라미터 | 타입 | 설명 | 예시 |
|---|---|---|---|
| keyword | string (URL-encoded) | §3.5 키워드 | `성남시 분당구 정자동` |
| size | number | 페이지당 결과 | `10` |
| page | number | 0-based | `0..N` |

**응답:**
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

**호출 정책:**
- `withRetry` (§9.2)로 감싸 호출
- 페이지네이션: `hasNextPage`가 `true`인 동안 `page` 증가
- 결과는 **클라이언트에서 다음 두 조건으로 필터링** 후 다음 단계 진입:
  1. `legalDivisionName.includes(keyword)` — 동음이지(同音異地) 차단
  2. `NAVER_TYPE_MAP[realEstateType]`이 포함하는 `type` 만 통과 — 사용자가 고른 상품과 일치

### 4.2 개별 매물 리스트 (Phase 2)

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

| 필드 | 타입 | 비고 |
|---|---|---|
| complexNumber | **string** | 숫자로 보내면 400 — 반드시 문자열 |
| tradeTypes | string[] | 단일이라도 배열 (`["A1"]`) |
| pyeongTypes / dongNumbers | array | 빈 배열 = 전체 |
| userChannelType | string | `"PC"` 고정 |
| articleSortType | string | `"RANKING_DESC"` |
| lastInfo | array | 첫 페이지 `[]`, 이후 이전 응답의 `lastInfo` 그대로 |
| size | number | 통상 20 |

**커서 페이지네이션:**
- 응답에 `seed`, `lastInfo`, `hasNextPage`가 포함됨.
- `lastInfo`만 다음 요청 body에 그대로 실어 보내면 됨 (`seed`는 불필요).

**응답 항목 구조:** §6 참조.

### 4.3 ★ 사용하지 않는 엔드포인트 (참고)

| 엔드포인트 | 이유 |
|---|---|
| `POST /complex/complexClusters` | §2.4 사고 사례 — WAF가 엄격, 즉시 429 |
| `m.land.naver.com/cluster/ajax/complexList` | §2.4 사고 사례 — 비정상 트래픽 패턴 |
| `new.land.naver.com/api/*` (PC API) | nfront에 의해 익명 차단 |

---

## 5. 코드표 ✅ 확정

### 5.1 UI 상품 코드 → Naver 내부 `realEstateType` 매핑

UI에서 사용자가 고르는 합성 코드(`APT:JGC:JGB`) ↔ Naver 자동완성 응답의 `type` 필드.

| UI 표시명 | UI 값 | Naver `type` 매칭 |
|---|---|---|
| 아파트/재건축/재개발 | `APT:JGC:JGB` | `A01`, `A04`, `F01` |
| 아파트 분양권 | `ABYG` | `B01` |
| 오피스텔 | `OPST` | `A02` |
| 오피스텔 분양권 | `OBYG` | `B02` |
| 빌라 | `VL` | `A05`, `A06`, `A07`, `C02` |
| 단독/다가구 | `DDDGG` | `C03` |
| 사무실 | `SMS` | **미확정** (TBD §13) |
| 지식산업센터 | `APTHGJ` | **미확정** (TBD §13) |

**UI 정책:**
- SMS / APTHGJ는 옵션을 표시하되 `disabled` + "(준비 중)" 라벨.
- 매칭 코드 실측 후 활성화.

코드 위치: [src/types/index.ts](src/types/index.ts) `NAVER_TYPE_MAP`.

### 5.2 거래 코드 (`tradeType`)

| 코드 | UI 표시명 |
|---|---|
| `A1` | 매매 |
| `B1` | 전세 |
| `B2` | 월세 |

> 단기임대(`B3`) 등은 본 PRD 범위 외.

### 5.3 면적 필터 — 공급면적 vs 전용면적

| 상품 유형 | 기준 면적 | UI |
|---|---|---|
| APT, ABYG, VL, DDDGG | **공급면적** (`supplySpace`) | 프리셋 (전체/59미만/59/74/84/85초과) |
| OPST, OBYG, SMS, APTHGJ | **전용면적** (`exclusiveSpace`) | 평 슬라이더 (min/max) |

판정 함수: `isExclusiveSpaceType(realEstateType)` ([src/types/index.ts](src/types/index.ts)).

프리셋 임계값(공급면적, ㎡):

| 라벨 | spcMin | spcMax |
|---|---|---|
| 전체 | 0 | 1000 |
| 59미만 | 0 | 79.3 |
| 59타입 | 79.4 | 89.2 |
| 74타입 | 89.3 | 105.7 |
| 84타입 | 105.8 | 119 |
| 85초과 | 119.1 | 1000 |

전용면적 입력 시 평 ↔ ㎡ 환산 계수: `PYEONG_TO_SQM = 3.30579`.

### 5.4 기타 코드 (응답 해석용)

| 항목 | 코드 | 의미 |
|---|---|---|
| direction | `SS` | 남향 |
| | `NN` | 북향 |
| | `ES` | 동향 |
| | `WS` | 서향 |
| priceChangeStatus | `0` / `1` / `-1` | 변동 없음 / 상승 / 하락 |
| verificationType | `OWNER` | 집주인 확인 |
| | `DOC` | 서류 확인 |
| | `MOBL` | 모바일 확인 |
| | `NDOC1` / `NDOC2` | 미확인 1/2 |
| | `NONE` | 미확인 (협회) |

---

## 6. 데이터 모델

### 6.1 Property 인터페이스 (정규화 후)

```typescript
interface Property {
  // 단지
  complexNumber: number;
  complexName: string;
  dongName: string;

  // 매물 식별
  articleNumber: string;
  realEstateType: string;     // Naver 내부 코드 (예: 'A01')
  tradeType: string;          // 'A1' | 'B1' | 'B2'

  // 가격 (모두 원 단위. rentPrice 만 만원 단위)
  dealPrice: number;
  warrantyPrice: number;
  rentPrice: number;          // 만원 단위
  managementFee: number;
  priceChangeStatus: number;
  priceChangeHistories?: Array<{ modifiedDate: string; dealPrice: number }>;

  // 면적 (㎡)
  supplySpace: number;
  exclusiveSpace: number;
  supplySpaceName: string;
  exclusiveSpaceName: string;

  // 위치/건물
  direction: string;
  floorInfo: string;          // "5/15" 형식
  targetFloor: string;
  totalFloor: string;
  address: string;            // "city division sector" 연결
  lat: number;
  lng: number;

  // 부가
  articleFeature: string;
  brokerageName: string;
  brokerName: string;
  confirmDate: string;
  buildDate: string;
  realtorCount: number;
  verificationType: string;
}
```

> ⚠️ v2의 `imageCount` 필드는 실측 응답에 없어서 제거됨.

### 6.2 정규화 위치

`Property` 변환은 [src/services/normalizer.ts](src/services/normalizer.ts)의 `normalizeArticleInfo` 단일 함수에서 처리.

**타입 강제 변환:** Naver API는 숫자 필드를 문자열로 반환하는 경우가 있어, 모든 숫자 필드는 `Number()` 래퍼(`const num = (v: unknown): number => Number(v) || 0`)로 강제 변환하고, 문자열 필드는 `String()`으로 감싼다. 이를 통해 정렬/필터 시 타입 불일치로 인한 비교 오류를 방지한다.

누락 필드는 빈 문자열 또는 0으로 채움 (UI는 `'-'` 표시로 대체).

---

## 7. 크롤링 플로우

```
[지역 선택]                          [상품/거래/면적 선택]
  대 + 중 + 소  ─────┬───── keyword ────┐         │
                    │                  │         │
                    ▼                  ▼         ▼
            ┌─────────────────────────────────────────┐
            │ Phase 1: searchComplexes(keyword, page) │
            │  · 페이지네이션 (hasNextPage 동안 반복) │
            │  · 결과 필터 2단계:                     │
            │     ① legalDivisionName ⊇ keyword       │
            │     ② type ∈ NAVER_TYPE_MAP[UI 상품]    │
            └─────────────────────────────────────────┘
                            │
                            ▼  complexes[]
            ┌─────────────────────────────────────────┐
            │ Phase 2: 각 단지별 매물 수집            │
            │   for complex in complexes:             │
            │     while hasNextPage:                  │
            │       getArticleList(...)               │
            │       for item in result.list:          │
            │         rep = item.representativeArticle │
            │         realtorCount = item.duplicated…  │
            │           .realtorCount ?? 1             │
            │         property = normalize(rep,        │
            │                     realtorCount)        │
            │         if passSpace(property):          │
            │           emit onProperty(property)      │
            │         ※ 중복 매물(같은 물건, 다른     │
            │           중개사)은 수집하지 않음.       │
            │           realtorCount 배지(+N)로 표시.  │
            │       lastInfo = result.lastInfo         │
            │     delay(1000~3000ms)  // 단지 간 휴식  │
            └─────────────────────────────────────────┘
                            │
                            ▼ properties[]
            ┌─────────────────────────────────────────┐
            │ 후처리 (ResultTable, §8)                │
            │   거래방식/단지/면적/텍스트 필터        │
            │   정렬 (가격은 trade-type별 단일 축)    │
            │   페이지네이션 (50건/페이지)            │
            │   CSV / JSON 내보내기                   │
            └─────────────────────────────────────────┘
```

### 7.1 면적 필터 (`passSpace`)

수집 단계에서 미리 거르기 위해 `CrawlerOptions.spcMin / spcMax`를 사용:

```ts
const filterByExclusive = isExclusiveSpaceType(realEstateType);
const lowerBound = spcMin > 0 ? spcMin : 0;
const upperBound = spcMax > 0 ? spcMax : Infinity;
const isAllSpace = lowerBound <= 0 && !Number.isFinite(upperBound);

function passSpace(p: Property): boolean {
  if (isAllSpace) return true;
  const value = filterByExclusive ? p.exclusiveSpace : p.supplySpace;
  if (value <= 0) return true;  // 데이터 미상은 보수적 통과
  return value >= lowerBound && value <= upperBound;
}
```

> 결과 테이블에서 다시 한번 면적 범위 필터를 적용할 수 있도록 후처리 계층에도 동일 의미의 필터 제공 (§8.3).

### 7.2 딜레이 정책

| 위치 | 범위 |
|---|---|
| 동일 호출 직전 (랜덤 지연) | 500 ~ 1500 ms |
| Phase 2 내부 페이지 사이 | 500 ~ 1500 ms |
| Phase 2 단지 사이 | 1000 ~ 3000 ms |
| 429 재시도 백오프 | 5000 → 12000 → 30000 ms (+ 0~2000 ms jitter) |

---

## 8. 후처리 계층 (Result Table)

### 8.1 컨트롤

결과 테이블 툴바에 다음을 제공:

| 컨트롤 | 동작 |
|---|---|
| 전체 단지 드롭다운 | `complexName` 키로 필터 (같은 complexNumber에 다른 단지명이 존재하는 케이스에 안전) |
| 전체 거래 드롭다운 | `tradeType` 필터 (혼합 결과를 동일 축으로) |
| 최소 / 최대 면적 + 평/㎡ 토글 | 공급 또는 전용 중 어느 쪽이라도 범위 내면 통과 |
| 단지명/주소 검색 | `complexName / dongName / address / articleFeature` 부분 일치 |
| CSV / JSON 내보내기 | 현재 필터링된 집합만 출력 |

### 8.2 정렬

`Property`의 다음 키에 대해 헤더 클릭 정렬 + 방향 토글:

`complexName`, `dongName`, `tradeType`, `dealPrice` (가격), `supplySpace` (공급/전용), `floorInfo` (층), `direction`, `verificationType`.

### 8.3 가격 정렬의 단일 축 규칙

`tradeType` 별로 의미적으로 다른 가격 필드를 단일 숫자로 정규화:

| tradeType | 정렬 값 |
|---|---|
| `A1` (매매) | `dealPrice` |
| `B1` (전세) | `warrantyPrice` |
| `B2` (월세) | `warrantyPrice` (월세도 보증금 기준으로 정렬해 B1과 동일 축에 둠) |

> 거래방식이 섞이면 정렬 의미가 약해지므로 사용자가 거래방식 드롭다운으로 단일 유형으로 좁히도록 UX 안내. 월세를 임대료 기준으로 정렬하려는 요구가 있으면 향후 별도 컬럼·정렬 키 도입.

### 8.4 페이지네이션

50건 페이지 단위. 필터/정렬 변경 시 자동으로 페이지 0으로 복귀.

---

## 9. 공통 HTTP 요청 설정

### 9.1 Naver API 프록시 헤더 ([vite.config.ts](vite.config.ts))

```ts
proxyReq.setHeader('Host', 'fin.land.naver.com');
proxyReq.setHeader('Origin', 'https://fin.land.naver.com');
proxyReq.setHeader('Referer', 'https://fin.land.naver.com/map');
proxyReq.setHeader('Accept-Language', 'ko-KR,ko;q=0.9');
proxyReq.setHeader('Sec-Fetch-Site', 'same-origin');
proxyReq.setHeader('Sec-Fetch-Mode', 'cors');
proxyReq.setHeader('Sec-Fetch-Dest', 'empty');
proxyReq.setHeader(
  'User-Agent',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
);
// 프론트의 X-Naver-Cookie 커스텀 헤더를 Cookie 헤더로 변환
```

> ⚠️ **User-Agent는 고정**하라. 브라우저 UA를 그대로 forwarding하면 도메인-디바이스 불일치(예: 모바일 도메인에 데스크톱 UA)로 WAF 격상 위험.

### 9.2 재시도 정책 (`withRetry`) — [src/services/naverApi.ts](src/services/naverApi.ts)

```ts
const backoffsMs = [5000, 12000, 30000];  // 단조 증가
for (let attempt = 0; attempt <= retries; attempt++) {
  try { return await fn(); }
  catch (err) {
    if (err.status === 429 && attempt < retries) {
      const wait = backoffsMs[attempt] + Math.random() * 2000;
      await sleep(wait);
      continue;
    }
    throw err;
  }
}
```

> 5초 고정 재시도는 WAF cooldown을 연장시키는 패턴이므로 채택 안 함.

### 9.3 에러 처리 매트릭스

| 상황 | 대응 |
|---|---|
| HTTP 429 (재시도 가능) | §9.2 백오프 |
| HTTP 429 (재시도 소진) | 사용자에게 "[설정] 탭에서 최신 Cookie를 갱신하세요" 안내 후 Phase 1 종료 |
| HTTP 4xx (기타) | 단지 단위 스킵, 로그 출력 |
| HTTP 5xx | 단지 단위 스킵 |
| 네트워크 에러 | `withRetry` 일반 경로 (재시도 안 함 — 429에만 적용) |
| 빈 응답 (`list: []`) | 정상 처리 (0건) |
| 쿠키 만료 의심 | 누적 429로 간주, 사용자 안내 |

---

## 10. 앱 아키텍처

### 10.1 실제 파일 구조

```
c:\Dev2\naver_new\
├── package.json
├── vite.config.ts                  # /naver-api 프록시 정의
├── tsconfig.json
├── PRD_NaverCrawler_v3.md          # 본 문서
├── DEV_PROMPT.md
├── CLAUDE.md
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css                   # 다크 테마 변수 + 전 컴포넌트 스타일
│   ├── types/
│   │   └── index.ts                # Property, REAL_ESTATE_TYPES, NAVER_TYPE_MAP, …
│   ├── services/
│   │   ├── naverApi.ts             # searchComplexes, getArticleList, withRetry, 쿠키 저장
│   │   ├── kbland.ts               # 3단계 지역 조회
│   │   ├── crawler.ts              # CrawlerService: Phase 1/2 + passSpace
│   │   ├── normalizer.ts           # RawArticleInfo → Property
│   │   └── api.ts                  # formatPrice, exportCSV, exportJSON
│   ├── hooks/
│   │   └── useCrawler.ts           # 크롤러 상태/콜백 React 어댑터
│   └── components/
│       ├── Layout.tsx
│       ├── Sidebar.tsx
│       ├── NaverCrawlerTab.tsx
│       ├── SearchPanel.tsx
│       ├── RegionSelect.tsx
│       ├── FilterSelect.tsx
│       ├── Monitor.tsx
│       ├── LogPanel.tsx
│       ├── ResultTable.tsx
│       └── CookieSettings.tsx
└── api/naver-proxy/[...path].ts    # Vercel Functions용 (프로덕션 예정, 현재 미사용)
```

### 10.2 데이터 흐름

```
[CookieSettings] ─writes localStorage─▶ [naverApi.getStoredCookie()]
                                              │
[SearchPanel] ─CrawlerConfig─▶ [useCrawler.start]
                                  │
                                  ▼
                          [CrawlerService.start]
                            Phase 1: searchComplexes ──┐
                                                       │
                                                       ▼
                                          (clientside type/region filter)
                                                       │
                            Phase 2: getArticleList ◀──┘
                              normalize → passSpace → onProperty(property)
                                  │
                                  ▼
                              setState properties
                                  │
                                  ▼
                          [ResultTable] — 후처리 필터/정렬/내보내기
```

### 10.3 백엔드(프로덕션) — 미래 작업 (참고)

- 로컬 개발은 Vite 프록시로 충분.
- 프로덕션 배포는 두 옵션 중 선택:
  1. **Vercel Functions** (`api/naver-proxy/[...path].ts` 활용) — 같은 origin에서 서버리스 프록시 수행. 단, Vercel IP 풀의 평판 이슈 가능 (다른 사용자가 동일 IP에서 스크래핑 시).
  2. **자체 호스트의 Express/Hono 프록시** — IP 고정, 쿠키 안전 보관, 헤더 일관성. 본 PRD 권장.

---

## 11. UI 디자인 사양

### 11.1 컬러 팔레트 (다크 테마)

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

### 11.2 레이아웃

```
┌────────────┬──────────────────────────────────────────┐
│ Sidebar    │ 상단:  [SearchPanel]   [Monitor / Log]    │
│  · 매물    │                                          │
│  · 설정    │ 하단:  [ResultTable + Toolbar]            │
└────────────┴──────────────────────────────────────────┘
```

### 11.3 SearchPanel 권장 동작

- 시/도 미선택 상태에서 "데이터 수집 시작" 비활성화.
- 지역 선택이 변경되면 keyword 미리보기와 법정동코드를 함께 표시.
- 상품종류가 SMS/APTHGJ면 옵션 회색 + 라벨 "(준비 중)".
- 상품종류가 전용면적 기준 유형이면 평 슬라이더로 전환, 아니면 공급면적 프리셋.

---

## 12. 운영 가이드

### 12.1 쿠키 추출 절차 (Chrome 기준)

1. Chrome에서 `https://fin.land.naver.com/` 접속 (로그인 권장).
2. F12 → Network 탭 → 필터에 `front-api` 입력.
3. 페이지의 지도를 살짝 움직이거나 검색 → `front-api/v1/*` 요청들이 표시됨.
4. 임의의 요청 클릭 → Request Headers → `cookie:` 한 줄 통째 복사.
5. 우리 앱 좌측 사이드바 ⚙️ **설정** 탭 → 텍스트박스에 붙여넣기 (헤더 이름 `Cookie:` 부분은 제외, 값만) → **쿠키 저장**.

### 12.2 429 대응 순서

1. **[설정] 탭에서 쿠키 갱신.** — 가장 흔한 원인.
2. **3분 대기 후 재시도.** — WAF cooldown은 보통 짧음.
3. 그래도 안 되면 **다른 네트워크(모바일 핫스팟 등)에서 시도** — IP 차단([C]) 여부 판별.
4. 거기서도 429면 본격적 진단 (코드 측 가능성).

### 12.3 정상 운영 체크리스트

- [ ] 쿠키가 설정 탭에 존재하는가? (`NID_AUT`, `NID_SES` 포함)
- [ ] 호출 URL이 `/naver-api/search/autocomplete/complexes` 또는 `/naver-api/complex/article/list` 인가? (다른 경로면 우회 시도 — 즉시 중단)
- [ ] User-Agent가 §9.1의 데스크톱 Chrome 고정 UA인가?
- [ ] 단지 간 딜레이가 1000~3000ms 유지되는가?

---

## 13. 보류/미해결 사항

| ID | 항목 | 상태 | 다음 단계 |
|---|---|---|---|
| TBD-1 | SMS (사무실) Naver 코드 | 미실측 | 실 매물 캡처로 `type` 코드 확인 후 `NAVER_TYPE_MAP['SMS']` 채움 |
| TBD-2 | APTHGJ (지식산업센터) Naver 코드 | 미실측 | 동상 |
| TBD-3 | 단기임대(`B3`) 지원 | 범위 외 | 시장 요구 확인 후 별도 PR |
| TBD-4 | 정렬·페이지 상태 유지 | 보류 | `searchKey` 강제 remount → properties 길이 기반 reset로 전환 검토 |
| TBD-5 | Vercel Functions 프록시 활성화 | 코드만 존재 | 프로덕션 배포 시 검증 |
| TBD-6 | 쿠키 만료 자동 감지 | 없음 | 401/403 응답 모니터링 + 사용자 알림 추가 |
| TBD-7 | 월세를 임대료 축으로 정렬 | 없음 | 별도 정렬 컬럼 또는 정렬 키 추가 |

---

## 14. ★ 재개발 가이드 (이 PRD를 보고 처음부터 만든다면)

이 절은 본 코드를 다시 만들거나 다른 부동산 사이트로 포팅할 때의 의사결정 메모.

### 14.1 절대 변경하지 말 것 — 검증된 결정

- **Phase 1 = `/search/autocomplete/complexes`.** 다른 후보(map cluster, mobile cluster) 시도 금지 (§2.4).
- **단일 도메인 `fin.land.naver.com`.** 모바일/PC 도메인 혼용 금지.
- **User-Agent 고정 데스크톱 Chrome.** 브라우저 UA forwarding 금지.
- **쿠키는 사실상 필수.** "옵셔널"로 설계하지 말 것.
- **`complexNumber`는 Phase 2 요청 시 문자열로 전송.**
- **KB Land 중지역명은 `.trim()`.**

### 14.2 처음에 반드시 결정할 사항

1. **프록시 위치**: 개발은 Vite 프록시, 프로덕션은 별도 백엔드 (Express/Hono/Vercel Functions).
2. **쿠키 저장 위치**: 사용자 본인 브라우저 `localStorage` (현 PRD). 다중 사용자가 같은 백엔드를 공유한다면 백엔드 별 사용자 쿠키 저장소 필요.
3. **상품 코드 매핑 출처**: 실 매물 응답 캡처(`type` 값) → `NAVER_TYPE_MAP` 작성. 추측 금지.
4. **결과 보존 정책**: 본 PRD는 메모리만 (브라우저 새로고침 시 휘발). IndexedDB 영구 보관이 필요하면 별도 설계.

### 14.3 점진적 확장 시 우선순위

1. **TBD-1/2 SMS/APTHGJ 실측** → 표 채우기. 가장 빠른 사용자 가치.
2. **TBD-6 쿠키 만료 자동 감지·알림** → 운영 부담 감소.
3. **TBD-5 Vercel Functions 검증** → 프로덕션 배포 가능 상태로.
4. **TBD-4 정렬 상태 유지** → UX 개선.
5. 다른 탭(상가/청약/실거래) 추가 — 본 탭과 독립.

### 14.4 회피해야 할 안티 패턴 (사고 사례 기록)

| 안티 패턴 | 사고 결과 | 대안 |
|---|---|---|
| "결과가 더 풍부할 것"이라며 무거운 API로 교체 (complexClusters) | 첫 호출부터 429, WAF 격상 | 명확한 요구사항 없이 엔드포인트 교체 금지. 단지 목록은 자동완성으로 충분. |
| 429를 즉시 "IP 차단/쿠키 만료"로 단정 | 잘못된 우회(모바일 도메인) 시도로 WAF 격상 가속 | 먼저 호출한 API와 호출 빈도를 점검. 정상 브라우저에서 동일 페이지 로드되는지 비교. |
| 도메인 변경(`m.land.naver.com`) | 디바이스-도메인 불일치로 의심 패턴 | 단일 도메인 유지. |
| 429에 5초 고정 재시도 × 3 | WAF cooldown을 연장 | 지수 백오프 + 지터. |
| 쿠키를 "환경 변수"로 코드/리포지토리에 하드코딩 | 만료 시 재배포 필요, 누수 위험 | 사용자 입력 + localStorage. |
| `duplicatedArticleInfo.articleInfoList`를 대표 매물과 함께 수집 | 동일 articleNumber의 중복 행 → React key 충돌 → DOM 업데이트 무반응 (필터/정렬이 useMemo에서는 정상이나 화면에 반영 안 됨) | 대표 매물만 수집, `realtorCount` 배지로 중개사 수 표시. React key는 index 기반(`idx-articleNumber`)으로 항상 유일하게 보장. |
| `complexNumber`를 단지 필터 키로 사용 | 동일 complexNumber에 다른 단지명(예: 호반써밋/파라곤)이 매핑되어 필터가 혼합된 결과를 반환 | `complexName`을 필터 키로 사용. |
| API 응답의 숫자 필드를 타입 검증 없이 사용 | API가 숫자를 문자열로 반환 시 `"10000" < "9000"` (사전순 비교)으로 정렬 오류 | normalizer에서 `Number()` / `String()` 으로 명시적 타입 강제 변환. |

---

## 부록 A-1. v3.0 → v3.1 변경 요약

| 영역 | v3.0 명세 | v3.1 실제 / 결정 |
|---|---|---|
| 중복 매물 | `duplicatedArticleInfo.articleInfoList` 순회하여 모든 중개사 매물 수집 | 대표 매물만 수집, `realtorCount` 배지로 중개사 수 표시 |
| 단지 필터 키 | `complexNumber` 기반 드롭다운 | `complexName` 기반 (같은 번호에 다른 단지명 존재하는 케이스 대응) |
| React key | `complexNumber-articleNumber-brokerageName` | `idx-articleNumber` (중복 키 충돌 방지) |
| normalizer 타입 | 암묵적 JS 타입 변환 의존 | `Number()` / `String()` 명시적 강제 변환 |
| 필터/정렬 동작 | useMemo 로직은 정상이나 DOM에 미반영 (key 충돌) | 정상 동작 확인 |

## 부록 A-2. v2 → v3 변경 요약

| 영역 | v2 명세 | v3 실제 / 결정 |
|---|---|---|
| 백엔드 | Express.js + axios | Vite dev 프록시, native fetch |
| 쿠키 | "쿠키 기반 인증 (선택적)" | **필수**로 간주 (§2) |
| Phase 1 API | autocomplete 명시 | autocomplete 유지 + 사용 안 함 API 명시 (§4.3) |
| 면적 필터 | UI 명세만 존재 | 크롤러 + 결과 테이블에 실배선 (§7.1, §8.1) |
| 결과 후처리 | 정렬/필터 명세 부족 | 거래방식·단지번호 키·면적 범위·검색·내보내기 명시 (§8) |
| 가격 정렬 | 별도 명세 없음 | trade-type별 단일 축 정의 (§8.3) |
| 재시도 | 5초 고정 × 3 | 5/12/30s + jitter (§9.2) |
| SMS/APTHGJ | 코드만 정의 | UI 비활성, TBD로 분리 (§5.1, §13) |
| `imageCount` | Property 필드 | 제거 (§6.1) |
| 사고/교훈 | 없음 | §2.4, §14.4에 명시 |
| 운영 가이드 | 단편적 | 쿠키 추출 절차 + 429 대응 순서 (§12) |

---

**END OF DOCUMENT**
