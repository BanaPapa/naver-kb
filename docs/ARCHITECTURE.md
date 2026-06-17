# 아키텍처 (as-built)

> 이 문서는 **실제 구현된 시스템**을 설명한다. 무엇을 "만들기로 했는지"(=PRD)가 아니라
> 지금 코드가 "어떻게 동작하는지"를 다룬다. 새 기능 개발·디버깅·인수인계의 기준 문서.
>
> 마지막 갱신: 2026-05-29 (MVP 1.4+, Bearer 토큰 자동 발급 추가)

---

## 1. 한 장 요약

순수 프론트엔드(React/Vite) 앱 + Vite dev-server 프록시가 백엔드 역할을 한다.
**별도 서버 프로세스(Express 등)는 없다.** 데이터는 세 곳의 비공개 API에서 온다.

```
브라우저 (React)
   │  fetch + 커스텀 헤더(X-Naver-Cookie, X-Naver-Bearer, X-Naver-Referer)
   ▼
Vite dev-server (vite.config.ts)
   ├─ /naver-api      → https://fin.land.naver.com/front-api/v1   (쿠키 주입)
   ├─ /naver-new-api  → https://new.land.naver.com                (쿠키 + Bearer 주입)
   │      └─ 미들웨어: /api/articles 요청에 Bearer 토큰 자동 주입
   │            └─ server/naverTokenProvider.mjs (puppeteer)
   └─ (KB Land는 프록시 없이 api.kbland.kr 직접 호출)
```

핵심 설계 결정 세 가지:
1. **백엔드 = 프록시.** CORS 우회 + 민감 헤더(Cookie/Authorization) 주입만 필요해서, 전용 서버 대신 Vite 프록시로 충분.
2. **이중 API.** 상품 유형에 따라 fin.land(단지 기반)와 new.land(지역 기반)를 갈라 쓴다.
3. **토큰 자동 발급.** new.land `/api/articles`의 Bearer 토큰을 puppeteer로 자동 캡처해 사용자가 손댈 필요 없게 함.

---

## 2. 데이터 소스 3곳

| 소스 | 용도 | 인증 | 호출 위치 |
|------|------|------|-----------|
| `api.kbland.kr` | 3단계 지역 선택 (법정동코드) | 없음 (`User-Agent: Mobile`) | `src/services/kbland.ts` (직접) |
| `fin.land.naver.com` | 단지 자동완성, 단지별 매물 리스트 | 쿠키 | `naverApi.ts` → `/naver-api` 프록시 |
| `new.land.naver.com` | cortarNo 기반 단지 마커 / 매물 직접 조회 | 쿠키 (+ /api/articles는 Bearer) | `naverApi.ts` → `/naver-new-api` 프록시 |

> **핵심 연결고리**: KB Land의 `법정동코드`(10자리, 예 `4145011500`)가 곧 네이버 `cortarNo`다.
> 지역만 선택하면 별도 변환 없이 new.land 검색에 바로 넣을 수 있다.

---

## 3. 검색 분기 (crawler.ts)

`CrawlerService.start()`는 상품 유형으로 두 경로 중 하나를 택한다.
판단 기준: `DIRECT_ARTICLE_TYPES = { VL, DDDGG, APTHGJ:SMS }`.

### 분기 A — 단지 기반 (아파트·오피스텔 등)
1. `getCortarBounds(cortarNo)` → `/api/cortars`로 지역 폴리곤 → 바운딩박스.
2. `getComplexesByCortarNo()` → `/api/complexes/single-markers/2.0`로 단지 목록.
   - 결과가 비면 `searchComplexes()`(fin.land 자동완성)로 **폴백**(전국 단위라 `AUTOCOMPLETE_MAX_PAGES=20`로 스캔 제한).
3. 단지별 `getArticleList()` → `POST /complex/article/list` (커서 페이지네이션: `seed` + `lastInfo`).

### 분기 B — 직접 조회 (빌라·단독/다가구·사무실)
1. (프록시 미들웨어가) Bearer 토큰 자동 주입.
2. `getArticlesByCortar()` → `/api/articles?cortarNo=..&page=1..N` (`isMoreData`로 순회).

두 경로 모두 `normalizer.ts`로 `Property`로 정규화 → 콜백으로 UI 스트리밍.

---

## 4. Bearer 토큰 자동 발급 (핵심 메커니즘)

> 배경·조사 과정은 [`CASE_STUDY_naver_bearer_token.md`](./CASE_STUDY_naver_bearer_token.md) 참조.

**문제**: new.land `/api/articles`는 `Authorization: Bearer <JWT>`가 없으면 401.
이 JWT는 `{id:"REALESTATE", iat, exp}` 형태의 HS256 서명값으로, **만료 3시간**, 로그인과 무관하게
네이버 프론트엔드 JS가 자체 생성한다(서명 비밀키 비공개 → 직접 서명 불가).

**해결**: `server/naverTokenProvider.mjs` — 네이버 JS가 만든 진짜 토큰을 가로채 재사용.

```
getNaverLandToken(cookie)
  │ 캐시 유효(만료 5분 전까지)? → 캐시 반환
  │ 진행 중인 발급 있음?       → 그 Promise 공유 (단일화)
  ▼ 아니면 captureToken():
    puppeteer headless 크롬 기동
      → 쿠키 세팅 → new.land/houses 로드
      → page.on('request')로 /api/ 요청의 Authorization 헤더 관찰(인터셉션 X)
      → 첫 Bearer 캡처 → exp 디코드 → 캐시
```

**주입 지점**: `vite.config.ts`의 `naverTokenInjector` 플러그인.
`configureServer`에서 `server.middlewares.use('/naver-new-api', ...)`를 **프록시보다 먼저** 등록해,
`/api/articles` 요청에 수동 토큰(`x-naver-bearer`)이 없으면 자동 발급 토큰을 헤더에 심는다.
이후 기존 `proxyReq` 핸들러가 `x-naver-bearer` → `Authorization: Bearer`로 변환.

**우선순위**: 수동 토큰(설정 탭 입력) > 자동 발급. 발급 실패 시 토큰 없이 진행 → 401 → UI 폴백 안내.

**비용**: 첫 발급만 헤드리스 크롬 기동(~3~5초), 이후 ~3시간 캐시.
APT/OPST(분기 A)는 `/api/articles`를 안 타므로 브라우저를 절대 기동하지 않는다.

---

## 5. 프록시 헤더 주입 (vite.config.ts)

브라우저는 `Cookie`/`Authorization` 같은 헤더를 직접 못 보내므로(또는 보내면 안 되므로),
커스텀 헤더로 보내고 프록시가 표준 헤더로 변환한다.

| 클라이언트 전송 | 프록시 변환 후 |
|---|---|
| `X-Naver-Cookie` | `Cookie` |
| `X-Naver-Bearer` | `Authorization: Bearer ...` |
| `X-Naver-Referer` | `Referer` |
| (고정) | `Host`, `Origin`, `Sec-Fetch-*`, `User-Agent`, `Accept-Language` |

`credentials: 'omit'`로 브라우저 자동 쿠키는 끄고, 주입 쿠키만 사용한다.

---

## 6. 차단 회피

- 요청 간 `randomDelay(500, 1500)`, 단지 간 `randomDelay(1000, 3000)`.
- 429: `withRetry`가 지수 백오프(5/12/30초) + 지터로 최대 3회 재시도 (단조 증가로 WAF 누적 회피).
- new.land 호출 시 실제 브라우저와 동일한 헤더 셋(Referer/Origin/Sec-Fetch) 주입.

---

## 7. 인증 정보 저장

- 쿠키·수동 Bearer 토큰은 **localStorage**에만 저장(`naver_cookie`, `naver_bearer`). 외부 전송 없음.
- 자동 발급 토큰은 dev-server **메모리 캐시**(영속화 안 함).
- 쿠키는 `fin.land.naver.com` 로그인 세션에서 추출(설정 탭 안내).

---

## 8. 확장 포인트

- **새 크롤링 탭**: `Sidebar` + `Layout`이 탭 기반. 새 탭 컴포넌트를 추가하고 서비스 한 벌(`*Api.ts` + `crawler` + `normalizer`)을 붙이면 된다.
- **새 상품 유형**: `types/index.ts`의 `REAL_ESTATE_TYPES` / `NAVER_TYPE_MAP`, `crawler.ts`의 `NEW_LAND_TYPE_MAP` / `DIRECT_TYPE_API_MAP` / `DIRECT_TYPE_REFERER`에 매핑 추가.
- **프로덕션 배포 주의**: 현재 "백엔드"는 Vite **dev** 서버에 묶여 있다. `vite build`로 만든 정적 산출물에는 프록시·토큰 미들웨어가 없다. 배포하려면 동일 로직(프록시 + 토큰 발급)을 별도 Node 서버로 옮겨야 한다. → §9.

---

## 9. 알려진 한계 / TODO

- **프로덕션 서버 부재**: 프록시·토큰 발급이 dev 서버 전용. 배포 시 Express/Fastify 등으로 포팅 필요.
- **헤드리스 탐지 리스크**: 네이버가 puppeteer를 차단하면 토큰 캡처 실패 → 수동 폴백. 대비책으로 stealth 플러그인/실제 프로파일 고려 가능.
- **토큰 갱신 트리거**: 현재 만료 시간(exp) 기준 선제 갱신만. 예기치 않은 401에 대한 즉시 무효화+재발급 훅은 없음(개선 여지).
- **단일 토큰 캐시**: 멀티 계정/쿠키 동시 사용은 고려 안 됨(쿠키별 캐시 키 필요 시 확장).
- **테스트 부재**: 자동화 테스트 프레임워크 미설정. `parseCookieHeader`/`decodeExpMs`/normalizer 등은 단위 테스트 가치 높음.
