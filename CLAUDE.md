# 네이버 부동산 크롤러

## 프로젝트 개요
네이버 부동산 모바일 API(fin.land.naver.com)를 활용한 매물 수집 독립형 웹앱.
Vite + React + TypeScript + Express.js 구성.

## 핵심 문서
- `PRD_NaverCrawler_v2.md` — 전체 PRD v3.0 (fin.land + new.land 이중 API, 코드표, Bearer 토큰)
- `DEV_PROMPT.md` — 개발 지시서 (개발 순서, 주의사항, 완료 기준)
- `docs/ARCHITECTURE.md` — as-built 아키텍처 (개발/디버깅/인수인계 기준)
- `docs/CASE_STUDY_naver_bearer_token.md` — 빌라 401 조사 사례 (학습/강의용)

## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

Available skills: /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /sync-gbrain, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

## 개발 규칙
- 다크 테마 UI (배경 #0d1117, 포인트 #00d4aa)
- Vanilla CSS 사용 (TailwindCSS 미사용)
- 탭 기반 확장 가능 구조 (추후 다른 크롤링 기능 추가 예정)
- KB Land API 응답의 중지역명은 반드시 .trim() 처리
- Naver API 호출은 Express 프록시 경유 (쿠키 주입)
- 차단 회피: 요청 간 500~1500ms 랜덤 딜레이

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
