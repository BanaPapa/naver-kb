# Estate-OS — 하이브리드 로컬 에이전트 전환 개발문서

> **이 문서의 목적**
> 이 문서는 "긴 대화 세션"에서 도출된 결정과 그 **이유**, 그리고 앞으로의 **구체적 개발 계획**을 한곳에 모은 인수인계 문서다.
> 새 대화 세션은 이 문서만 읽고도 맥락 없이 바로 코드 작업을 이어갈 수 있어야 한다.
> 작성 시점: 2026-06-18 기준. 작성 모델: Claude Opus 4.8.

---

## 0. 한 줄 요약

네이버가 **Vercel 데이터센터 IP를 TCP 레벨에서 차단(ECONNRESET)** 하기 때문에, 배포본에서 매물검색이 0건이다.
해결책으로 **네이버 크롤링 기능만 사용자 PC의 "얇은 로컬 에이전트"로 내리고, 나머지(UI·인증·다른 탭)는 Vercel에 그대로 두는 하이브리드 구조**로 간다.
이 구조는 동시에 **복제/크랙 방어**에도 가장 강하다(클라이언트는 멍청한 중계기, 두뇌·열쇠는 서버).

---

## 1. 프로젝트 현황

- **Estate-OS**: 부동산 통합 분석 웹앱. Vite + React + TypeScript + (개발용)Express/Vite 프록시.
- **네이버 크롤링은 여러 탭 중 "하나"일 뿐이다.** 사이드바에 KB시계열, KB시세, 매물시세(=네이버), 실거래가, 청약현황, 입주민리뷰, 중개업소추출, 상업시설, 입지분석, 학군, 개발계획 등 다수 탭이 있고 대부분 "개발 예정". 현재 동작하는 건 **매물시세(네이버)** 탭.
- **KB 계열**은 `https://api.kbland.kr`를 **브라우저에서 직접** 호출(CORS 개방) → Vercel에서도 정상. 프록시 불필요.
- **네이버만** 서버 프록시가 필요했다(네이버 API는 CORS를 막아 브라우저 직접 호출 불가). → 그래서 이 문제가 네이버 탭에만 발생.

### 배포/인프라 사실
- Supabase 프로젝트: `lnvpfomcrbcxjwjqkiqu` (`https://lnvpfomcrbcxjwjqkiqu.supabase.co`)
- Vercel: `https://estate-os.vercel.app` (Team: Bana's projects / Hobby, Vite preset, Root `./`, 리전 icn1=서울)
- GitHub: `https://github.com/BanaPapa/Estate-OS` (master 브랜치에 직접 배포)
- Vercel 환경변수 설정됨: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Production+Preview)
- 로컬 `.env`도 동일 값 보유(gitignore됨)

---

## 2. 지금까지의 여정과 의사결정 (왜 이렇게 왔는가)

이 절은 "왜 이 설계인가"를 이해하기 위한 기록이다. 같은 막다른 길을 다시 파지 않도록 기각된 대안과 그 이유까지 남긴다.

### 2-1. Supabase 연결 + 관리자 승인제 가입 (완료)
- 요구: "이메일 인증 필요 없이, 관리자 승인만으로 가입 완료되는 시스템."
- 구현: `profiles` 테이블(`status`: pending/approved/rejected, `role`: user/admin) + 가입 트리거.
  - **부트스트랩: 첫 가입자가 자동으로 admin+approved.** (이미 polateria@gmail.com이 첫 관리자)
  - `is_admin()` SECURITY DEFINER 함수로 RLS 재귀 방지.
- 미승인 사용자는 `PendingApprovalScreen`, 관리자만 사이드바 "회원 승인" 탭(`MemberApproval`) 노출.
- **이 승인 시스템이 나중에 "라이선스 관제판"으로 그대로 재사용된다** (3-2, 7절 참조). 이게 핵심 자산.

### 2-2. 이메일 인증 이슈 (해결됨)
- 최신 Supabase 대시보드의 Email Provider 패널에는 "Confirm email" 토글이 없다(UI 개편으로 위치 이동/제거). "Secure email change"는 다른 기능이니 건드리지 말 것.
- 실제로는 확인 메일이 (약간 느리게) 도착해서 링크 클릭으로 가입 완료됨. 네이버 메일은 스팸함으로 갈 수 있음.
- **남은 요구사항**: "앞으로 이메일 인증 없이 관리자 승인만으로." → `mailer_autoconfirm=true`로 끄는 게 목표. 대시보드 토글을 못 찾으면 **Supabase Personal Access Token + Management API**(`PATCH /v1/projects/{ref}/config/auth { "mailer_autoconfirm": true }`)로 처리. (다음 세션에서 사용자에게 PAT 요청)

### 2-3. Vercel 배포 → 매물검색 0건 → 근본원인 추적
배포본에서 매물이 하나도 안 나왔다. 단계별로 원인을 깠다(모두 실제 검증함):

1. **`/naver-new-api`(new.land) 프록시 자체가 없었음.** Vercel엔 fin.land용 `api/naver-proxy`만 있고 new.land용 함수·rewrite가 없었다. 아파트 단지목록(single-markers/cortars)·빌라/단독(/api/articles)이 전부 new.land를 쓰므로 치명적. → new.land 프록시 추가.
2. **edge 런타임 함수가 아예 배포 안 됨.** `/api/ping`(node)은 200인데 `export const config={runtime:'edge'}` 함수들은 404. → **`@vercel/node` Node 런타임으로 전환**하니 함수가 배포됨.
3. **catch-all `[...path].ts`가 다중 세그먼트를 못 잡음.** `/api/naver-proxy/x`(1세그먼트)=500인데 `/api/naver-proxy/a/b/c`=404. Vercel zero-config(non-Next)에서 catch-all 한계. → **rewrite로 경로를 `__path` 쿼리에 담는 방식**으로 전환(`/naver-api/(.*)` → `/api/naver-proxy?__path=$1`). 평평한 `api/naver-proxy.ts` 함수.
4. **그래도 502 `fetch failed`.** `err.cause`를 까보니 **`ECONNRESET` / "read ECONNRESET"**.

→ **최종 근본원인: 네이버가 Vercel 데이터센터 IP의 연결을 TCP에서 리셋(차단)한다.** 프록시 코드로는 못 뚫는다. 네이버가 안 막는 IP로 나가야 한다.

> 참고: 위 1~3의 수정은 "올바른 수정"이라 코드에 남아있다(아래 5절). 다만 4번(IP 차단) 때문에 Vercel 서버 경유로는 끝내 작동 불가. 이 프록시 코드는 **로컬 에이전트로 이식할 자산**으로 본다.

### 2-4. 대안 탐색과 기각 이유 (중요 — 다시 묻지 말 것)
- **브라우저 IP 우회(VPN 확장 등)** → ❌. 차단되는 건 "서버→네이버" 구간이고, 브라우저 VPN은 "브라우저→서버" 구간만 바꿈. 엉뚱한 지점. 게다가 브라우저가 네이버 직접 호출은 CORS로 막힘.
- **Firebase 등 다른 클라우드** → ❌. GCP/AWS/Netlify/Cloudflare 전부 데이터센터 IP. 네이버는 클라우드 대역을 통째로 막음. 플랫폼 바꿔도 동일.
- **도메인 변경** → ❌. 차단은 "서버의 출발지 IP" 기준이지 "사용자가 접속하는 도메인"과 무관.
- **일반 VPN(Nord/Express 등)** → ❌. 네이버가 알려진 VPN 대역도 차단. "되는 VPN"은 사실상 유료 주거용 프록시(아래)이고 별개 상품.
- **Cloudflare Tunnel(내 PC 1대를 모든 사용자 중계로)** → △. 무료지만 **모든 사용자 트래픽이 내 집 IP 1개로 몰려** 네이버가 그 IP를 의심·차단할 위험이 큼(사용자 10명+ 검색량↑ 시). 그리고 내 PC가 꺼지면 중단. → 단기 PoC용으론 가능하나 확장성 나쁨.
- **유료 주거용 프록시 서비스(ScraperAPI/BrightData/Oxylabs/Smartproxy 등)** → ○. 서버에서 호출, 24시간, 다수 사용자 안정. 단 월 비용. (장기/무인 운영 시 옵션)
- **개별 데스크톱 앱(각자 PC에서 크롤링)** → ◎ **채택**. 각 사용자가 자기 주거 IP로 나가 차단 분산. 무료. 원격 차단(라이선스)도 가능.

### 2-5. "전체를 다 내려야 하나?" → 아니다. 하이브리드.
네이버 탭만 데스크톱으로 내리고 나머지는 Vercel에 둔다. **로컬 에이전트 패턴**(4절). 전체 앱을 Electron으로 포팅할 필요 없음.

### 2-6. 복제/크랙(특히 "AI 바이브코딩으로 뚫기") 방어 철학
- **진실**: 사용자 PC에서 도는 코드는 100% 못 막는다(DRM 불변의 법칙). 난독화는 과속방지턱일 뿐, AI 앞에선 약하다.
- **이기는 방향**: "코드를 잠그기" ❌ → **"클라이언트를 멍청하게, 두뇌·열쇠는 서버에"** ⭕.
- 실제로 훔칠 가치가 있는 건 크롤링 로직이 아니라(네트워크 탭이면 누구나 추출) **"내가 끊어도 계속 쓰는 것(라이선스 우회)"**.
- 그래서: 거절된 계정엔 **서버가 토큰을 안 준다**. 이 판단 로직은 클라이언트에 아예 없으므로 AI로 클라이언트를 뜯어도 못 바꾼다.
- **놀라운 시너지**: 2-5의 "얇은 에이전트"가 곧 가장 강한 방어다. 에이전트를 멍청하게 만들수록 (a)배포물이 작고 (b)뚫어도 쓸모없다.

---

## 3. 목표 아키텍처

### 3-1. 큰 그림
```
                  ┌─────────────────────────────────────────────┐
                  │   Vercel 웹앱  (estate-os.vercel.app)         │
   사용자 브라우저 ─┤   - 전체 UI / 모든 탭 / 로그인(Supabase)      │
                  │   - 회원승인(=라이선스 관제)                   │
                  │   - 크롤링 "지휘"(무엇을/언제) + 토큰 발급      │
                  │   - 결과 저장(슬롯: naver_slots)              │
                  └───────────────┬─────────────────────────────┘
                                  │  (네이버 탭에서만)
                                  │  http://localhost:<port> 호출
                                  ▼
                  ┌─────────────────────────────────────────────┐
                  │   로컬 에이전트  (사용자 PC, 트레이앱)         │
                  │   - 서버 발급 단기 토큰 검증 후에만 동작        │
                  │   - 네이버에 "주거 IP"로 요청/중계            │
                  │   - (선택) 네이버 로그인 내장 → 쿠키/Bearer 자동│
                  └───────────────┬─────────────────────────────┘
                                  ▼
                            네이버 (fin.land / new.land)   ← 주거 IP라 차단 안 됨
```
- **KB 계열 탭**: 변경 없음. 브라우저가 `api.kbland.kr` 직접 호출(CORS 개방) → Vercel에서 그대로 동작.
- **네이버 탭만**: 호출 대상을 `/naver-api`·`/naver-new-api`(Vercel, 차단됨) 대신 **로컬 에이전트(`http://localhost:<port>`)** 로 바꾼다.

### 3-2. 왜 이게 되나 (기술 근거)
- **https → http://localhost 호출 허용**: 브라우저는 `localhost`/`127.0.0.1`을 "안전한 출처"로 취급해 mixed-content를 막지 않는다. https Vercel 페이지가 로컬 에이전트를 호출 가능. (단 Chrome **Private Network Access(PNA)** 프리플라이트가 점차 강화 중 → 에이전트가 OPTIONS 프리플라이트에 적절한 CORS/PNA 헤더로 응답하면 됨.)
- **CORS**: 에이전트가 `Access-Control-Allow-Origin: https://estate-os.vercel.app`(+ `Access-Control-Allow-Headers`)를 응답.
- **인증/라이선스**: 에이전트는 크롤링 전 Vercel에 토큰을 요청·검증. `profiles.status`가 곧 스위치.

---

## 4. 현재 코드 상태 (파일별 — 다음 세션 시작점)

### 4-1. 인증/승인 (완료 — 재사용 자산)
- `supabase/schema.sql` — `profiles`(status/role) + `naver_slots` + 트리거(`handle_new_user` 첫가입자 admin) + `is_admin()` + RLS. **이미 Supabase에 적용됨.**
- `src/services/profilesRepo.ts` — fetchMyProfile / listProfiles / setProfileStatus
- `src/hooks/useAuth.ts` — 로그인 + 프로필(status/role) 로딩, `reloadProfile`
- `src/components/auth/LoginScreen.tsx` — 로그인/회원가입 + **아이디 기억하기**(localStorage `eos_remember_email`)
- `src/components/auth/PendingApprovalScreen.tsx` — 승인 대기/거절 게이트
- `src/components/admin/MemberApproval.tsx` — 관리자 회원 승인 페이지 (← **라이선스 관제판으로 확장 예정**)
- `src/App.tsx` — 인증/승인 게이트 + 관리자 탭 라우팅
- `src/components/Sidebar.tsx` — `isAdmin`이면 "회원 승인" 탭 노출. `AppTab = 'naver'|'settings'|'admin'`

### 4-2. 네이버 크롤링 로직 (에이전트로 이식할 핵심)
- `src/services/naverApi.ts` — `naverFetch`(`/naver-api`=fin.land), `naverNewFetch`(`/naver-new-api`=new.land), `naverPost`. 쿠키는 `X-Naver-Cookie`, Bearer는 `X-Naver-Bearer`, Referer는 `X-Naver-Referer` 헤더로 전달.
- `src/services/crawler.ts` — `CrawlerService`(단지목록→매물 / 빌라·단독 직접조회 / 동 순회 등 전체 오케스트레이션)
- `src/services/api.ts` — 쿠키/Bearer localStorage 저장. `NAVER_BASE='/naver-api'`, `NAVER_NEW_BASE='/naver-new-api'` ← **여기를 에이전트 베이스로 전환할 지점**
- `src/services/kbland.ts` — KB 직접 호출(변경 불필요)
- `src/services/normalizer.ts` — 응답 정규화

### 4-3. Vercel 프록시 (현재 IP차단으로 사실상 死, 에이전트로 이식)
- `api/naver-proxy.ts` — fin.land 프록시(@vercel/node, `__path` 쿼리). 헤더 주입 로직은 그대로 에이전트로 옮길 자산.
- `api/naver-new-proxy.ts` — new.land 프록시(쿠키+Bearer+Referer 주입)
- `api/ping.ts` — 진단용(나중에 제거 가능)
- `vercel.json` — `/naver-api/(.*)`→`/api/naver-proxy?__path=$1`, `/naver-new-api/(.*)`→`/api/naver-new-proxy?__path=$1`
- `vite.config.ts` — **로컬 개발용** 프록시(`/naver-api`,`/naver-new-api`) + 빌라용 Bearer 자동발급(puppeteer `server/naverTokenProvider.mjs`). 로컬 개발에선 계속 유효.

> 결정 필요: Vercel의 `api/naver-*` 프록시를 (a)그대로 두되 안 쓰거나 (b)제거. → 에이전트 전환 후 정리 권장.

---

## 5. 개발 계획 (단계별)

### Phase 1 — 로컬 에이전트 최소 버전 + 웹앱 연동 (핵심 검증)
**목표**: "다른 사람 PC에서도" 네이버 매물검색이 되는 걸 증명.

1. **에이전트 스캐폴드 (Electron 권장 — 6절 근거)**
   - 트레이앱. 로컬 HTTP 서버(예: `http://127.0.0.1:<port>`) 1개를 띄움.
   - 엔드포인트: `/naver-api/*`, `/naver-new-api/*` (현 Vercel 프록시와 동일 인터페이스로). `api/naver-proxy.ts`/`api/naver-new-proxy.ts`의 헤더 주입·fetch 로직을 거의 그대로 이식.
   - CORS/PNA 헤더로 `https://estate-os.vercel.app` 허용. OPTIONS 프리플라이트 처리.
   - `/health` 또는 `/ping` 엔드포인트(웹앱이 에이전트 실행 여부 감지용).
2. **웹앱: 에이전트 감지 + 베이스 전환**
   - `src/services/api.ts`의 `NAVER_BASE`/`NAVER_NEW_BASE`를 동적으로: 에이전트가 떠 있으면 `http://127.0.0.1:<port>/naver-api`, 아니면 비활성 + 안내.
   - 네이버 탭 진입 시 `/health` 핑 → 없으면 "로컬 프로그램 다운로드/실행" 버튼 노출.
3. **인증 토큰 게이트 (최소형)**
   - Vercel에 `/api/crawl-token` 추가: 요청자의 Supabase 세션 검증 → `status==='approved'` && (구독 유효) → **서버 비밀키로 서명한 단기 JWT(예 10분)** 발급.
   - 에이전트는 크롤링 시작 시 이 토큰을 받아(웹앱이 전달) 보유, 만료 시 재요청. (Phase 1은 "있으면 동작" 수준, 강한 루프검증은 Phase 2)
4. **검증**: choiyujin 등 다른 PC에 에이전트 설치 → 배포본 로그인 → 네이버 탭 검색 → 그 PC의 주거 IP로 결과 수집되는지 확인.

### Phase 2 — 라이선스/원격차단 강화 + 쿠키 자동화
1. **관제판 확장**: `profiles`에 `subscription_end_date`(timestamptz, null=무기한) 등 추가. `MemberApproval`에 사용기간/일시정지 UI.
2. **서버를 루프 안에**: 에이전트가 배치마다(또는 N분 하트비트) Vercel에 검증 요청 → 서버가 revoke/만료면 거부 → 즉시 중단. "한 번 체크하고 끝" 금지.
3. **기기/계정 바인딩 + 이상탐지**: 한 계정이 여러 IP/기기에서 동시 → 플래그/차단. 계정당 일일 검색량 제한(서버 카운팅).
4. **쿠키/Bearer 자동화**: 에이전트 내장 브라우저창(Electron `BrowserWindow`)으로 네이버 로그인 → 쿠키/Bearer 자동 수집. 사용자 수동 복붙 제거. 빌라/단독 Bearer 문제도 자연 해결.
5. **이메일 인증 끄기**: `mailer_autoconfirm=true` (PAT + Management API). 가입 즉시 승인대기 화면으로.

### Phase 3 — 배포/운영 다듬기
1. **자동 업데이트**: Electron auto-updater(예: electron-updater + GitHub Releases). 네이버 API 변경 시 에이전트만 업데이트 배포.
2. **코드서명**: Windows SmartScreen/백신 경고 줄이려면 코드서명 인증서(연 $100~400). 소규모면 생략하고 "알 수 없는 게시자" 클릭 통과 안내로 시작.
3. **크로스플랫폼**: Windows 우선. mac/Linux는 수요 생기면.
4. **Vercel 정리**: 死 상태인 `api/naver-*` 프록시 제거 또는 주석. `vite.config.ts`는 로컬 개발용으로 유지.

---

## 6. Electron vs Tauri 결정

**Phase 1은 Electron 권장.** 근거:
- 크롤링 스택이 전부 TypeScript/Node 호환(`naverApi.ts`, `crawler.ts`, `api/naver-*.ts`). Electron 메인 프로세스=Node라 **거의 그대로 이식**, 주거 IP로 나가고 CORS 없음.
- 내장 `BrowserWindow`로 네이버 로그인/쿠키 수집이 쉬움(Phase 2).
- Tauri는 더 가볍고(바이너리 ~10MB vs Electron ~80MB) 예쁘지만 HTTP 계층을 Rust/플러그인으로 옮겨야 해 손이 더 감. 개인 도구에 용량 차이는 큰 의미 없음.
- **결론: 빨리 동작 검증엔 Electron. 나중에 경량화가 정말 필요하면 Tauri 재검토.**

> 단, 이 문서를 읽는 새 세션은 사용자에게 한 번 더 확인할 것: "Electron으로 진행 OK?"

---

## 7. 복제/크랙 방어 상세 설계

원칙: **클라이언트는 멍청한 중계기, 두뇌·열쇠는 서버.** AI로 클라이언트를 뜯어도 서버 판단은 못 바꾼다.

효과 순:
1. **얇은 에이전트(아키텍처)** — 에이전트는 "URL 받아 네이버에서 가져와 돌려주기"만. 무엇을/언제/인증/조립은 Vercel이 지휘. 뚫어도 두뇌 없는 중계기라 무용.
2. **서버 발급 단기 서명 토큰** — 크롤링마다 Vercel이 서명(서버 비밀키)한 10분 토큰 필요. revoke/만료 즉시 반영. 위조 불가.
3. **서버를 루프 안에 상시** — 배치마다 서버 검증. 일회성 체크(지우면 끝) 금지.
4. **계정+기기 바인딩, 이상탐지, 빈도제한** — 공유/남용 탐지.
5. **난독화/패킹/무결성체크** — 보조(시간끌기)일 뿐 주 방어선 아님.

**솔직한 한계(문서에 명시)**: 완벽한 복제방지는 불가능. 목표는 "캐주얼 사용자에게 실익이 없게". 소규모 신뢰그룹엔 1~4면 충분.

---

## 8. 다음 세션 시작 체크리스트 / 열린 결정

- [ ] 사용자에게 **Electron 진행 확인** (6절).
- [ ] 에이전트 **포트 번호** 확정(예: 5174 충돌 피해 고정 포트 또는 범위 탐색).
- [ ] 에이전트 폴더 위치 결정: 이 repo 안 `agent/` 서브패키지 vs 별도 repo. (모노레포 `agent/` 권장 — 프록시 코드 공유 쉬움)
- [ ] `/api/crawl-token` 서명 키: Vercel 환경변수 `CRAWL_TOKEN_SECRET` 추가 필요(사용자 작업).
- [ ] 이메일 인증 끄기용 **Supabase PAT** 사용자에게 요청(2-2).
- [ ] Vercel `api/naver-*` 프록시 유지/제거 결정(4-3).
- [ ] `subscription_end_date` 등 `profiles` 스키마 확장 SQL 준비(Phase 2).

---

## 9. 핵심 사실 빠른 참조

| 항목 | 값/내용 |
|---|---|
| 근본 차단 | 네이버가 Vercel(데이터센터) IP를 ECONNRESET으로 차단. icn1(서울) 리전도 동일 |
| 안 막히는 길 | 주거 IP에서 네이버 호출 = 사용자 PC 로컬 에이전트(채택) 또는 유료 주거 프록시 |
| KB 계열 | `api.kbland.kr` 브라우저 직접 호출, CORS 개방 → Vercel 정상, 변경 불필요 |
| 인증 | Supabase 이메일 + `profiles` 승인제, 첫 가입자=admin. 곧 라이선스 관제로 확장 |
| 첫 관리자 | polateria@gmail.com (approved/admin) |
| 프록시 헤더 | fin.land/new.land 공통: UA, Referer, Origin, Sec-Fetch-*. 쿠키=`X-Naver-Cookie`, Bearer=`X-Naver-Bearer`(빌라/단독 /api/articles 필수), Referer=`X-Naver-Referer` |
| 빌라/단독 토큰 | new.land `/api/articles`는 Bearer JWT 필수. 로컬은 puppeteer 자동발급(`server/naverTokenProvider.mjs`), 에이전트는 내장 브라우저로 수집 예정 |
| 관련 문서 | `docs/ARCHITECTURE.md`, `docs/CASE_STUDY_naver_bearer_token.md`, `PRD_NaverCrawler_v2.md`, `DEV_PROMPT.md` |

---

*끝. 새 세션은 4·5·8절을 시작점으로 삼아 Phase 1부터 진행할 것.*
