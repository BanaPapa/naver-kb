# KB 시계열분석 ↔ 매물시세 통합 계획

로컬 KB 앱(R2-PJT, React19/Vite7/Tailwind/FSD)을 naver-kb 레포(React18/Vite6/Vanilla CSS/Supabase/Vercel)에
**단일 SPA**로 병합한다. KB는 사이드바 `KB 시계열 분석` 탭(로그인 게이트 뒤)에서 실행된다.

## 결정 사항
- 호스트 = **naver-kb** (매물시세가 이미 라이브, 인증/배포 기반)
- 공통 스택 = **React 19 + Vite 7**로 정렬 (naver-kb를 위로 올림)
- KB 탭은 **로그인·승인 게이트 뒤** (앱 전체가 이미 게이트됨 → 자동 적용)
- 셸은 **호스트 것 하나만** 사용. KB는 자체 사이드바(AppNav) 버리고 콘텐츠만 마운트
- CSS: Tailwind **preflight 비활성** + KB 전역 리셋 제거. estate-os.css는 콘텐츠 규칙만

## 진행 상태 (2026-06-25)
- Stage 1 스택 정렬 ✅  / Stage 2 소스 이식 ✅ / Stage 3 분석 백엔드(dev) ✅ / Stage 4 배선 ✅ / Stage 5 검증 ✅
- 브라우저 검증: 매물시세·KB 양 탭 정상, 차트 19개 실데이터 렌더, 분석 모달 정상, naver 다크테마 무손상
- 남은 것: naver-kb로 push + PR (사용자 승인 대기). 프로덕션(Vercel) AI 분석은 dev 전용 브릿지라 미지원(원본 KB와 동일) — 차트/데이터는 프로덕션 정상.

## 단계 (각 단계 끝에 빌드 검증 게이트)

### Stage 1 — 스택 정렬 (naver-kb → React19/Vite7 + Tailwind)  ✅
- [ ] package.json: react/react-dom 19, vite 7, @vitejs/plugin-react 최신
- [ ] KB 런타임 의존성 추가: zustand, recharts, lucide-react, xlsx, gpt-tokenizer,
      @tailwindcss/forms, @tailwindcss/typography, tailwindcss/postcss/autoprefixer
- [ ] tailwind.config.js (preflight:false, content=src), postcss.config.js
- [ ] npm install, `npm run build` 통과 + 매물시세 화면 동작 확인
- 게이트: 매물시세가 업그레이드 후에도 그대로 동작

### Stage 2 — KB 소스 이식
- [ ] 로컬 src의 FSD(entities/features/widgets/shared/app) → naver-kb src로 복사
      (네임스페이스 충돌 점검: shared/lib/store 등)
- [ ] KB App.tsx → 셸 제거한 `KbModule` 콘텐츠 컴포넌트로 리팩터(ShellHeader + eos-work + AnalysisModal, StoreProvider 래핑, AppNav/eos-app 제거)
- [ ] CSS: estate-os.css에서 셸 규칙 제외 콘텐츠 규칙만 반입, KB index.css 전역 리셋 제거

### Stage 3 — AI 분석 백엔드 이식
- [ ] vite-plugins(analysis-bridge, provider-bridge) → naver-kb의 dev 미들웨어 + Vercel api/ 서버리스 쌍으로 포팅 (naver의 crawl-token 패턴 참고)

### Stage 4 — 네비게이션 연결
- [ ] Sidebar: `kb-timeseries`를 클릭 가능 탭(tab='kb')으로, AppTab에 'kb' 추가
- [ ] App.tsx: activeTab==='kb' → KbModule 렌더 (naver처럼 항상 마운트 + display 토글로 상태 보존)
- [ ] 헤더 브레드크럼/타이틀 탭별 분기

### Stage 5 — 검증 & 마무리
- [ ] typecheck/build 통과, 매물시세·KB 양 탭 수동 확인
- [ ] 커밋, naver-kb로 push, PR

## 참고 경로
- KB 소스: `C:\dev\naver-kb` (remote=R2-PJT)
- 병합 작업: `C:\dev\naver-kb-merged` (remote=naver-kb, branch=feat/kb-timeseries-merge)
