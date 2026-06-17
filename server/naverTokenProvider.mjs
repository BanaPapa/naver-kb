// new.land.naver.com Bearer 토큰 자동 발급기 (개발 서버 전용, Node 컨텍스트)
//
// 배경: new.land.naver.com /api/articles (빌라·단독/다가구) 는 Authorization Bearer
// JWT 를 강제한다. 이 토큰은 로그인 자격증명이 아니라 네이버 프론트엔드 JS 가 만들어내는
// id:REALESTATE / 만료 3시간짜리 HS256 서명값이다(서명 비밀키는 비공개).
// 따라서 비밀키를 알아내 직접 서명하는 대신, 헤드리스 브라우저로 네이버 SPA 를 실제 구동해
// 네이버 JS 가 발급한 진짜 토큰을 /api/ 요청 헤더에서 가로채 재사용한다.
//
// 토큰은 약 3시간 유효하므로 메모리에 캐시하고 만료 5분 전에만 재발급한다.

import puppeteer from 'puppeteer';

const TOKEN_URL = 'https://new.land.naver.com/houses';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 만료 5분 전 갱신
const NAV_TIMEOUT_MS = 30_000;
const CAPTURE_TIMEOUT_MS = 20_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

/** @type {{ token: string|null, expMs: number }} */
let cached = { token: null, expMs: 0 };
/** @type {Promise<string|null>|null} */
let inflight = null;

// JWT payload 의 exp(초) → ms. 실패 시 0.
function decodeExpMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// "k=v; k2=v2" 쿠키 헤더 → puppeteer 쿠키 객체 배열 (.naver.com 도메인)
function parseCookieHeader(cookieHeader) {
  return cookieHeader
    .split(';')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      if (eq < 0) return null;
      return {
        name: pair.slice(0, eq).trim(),
        value: pair.slice(eq + 1).trim(),
        domain: '.naver.com',
        path: '/',
      };
    })
    .filter(Boolean);
}

async function captureToken(cookieHeader) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);

    const cookies = parseCookieHeader(cookieHeader);
    if (cookies.length) await page.setCookie(...cookies);

    // 가로챈 토큰을 담을 약속(promise). 인터셉션 없이 헤더만 관찰 → SPA 는 정상 동작.
    let resolveToken;
    const tokenPromise = new Promise((resolve) => {
      resolveToken = resolve;
    });
    page.on('request', (req) => {
      const auth = req.headers()['authorization'];
      if (auth && /^Bearer\s+/i.test(auth) && req.url().includes('/api/')) {
        resolveToken(auth.replace(/^Bearer\s+/i, '').trim());
      }
    });

    page.goto(TOKEN_URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }).catch(() => {});

    const token = await Promise.race([
      tokenPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), CAPTURE_TIMEOUT_MS)),
    ]);
    return token;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * 유효한 new.land 토큰을 반환한다. 캐시가 살아있으면 캐시를, 아니면 새로 발급.
 * 발급 실패 시 null (호출측은 토큰 없이 진행 → 네이버가 401 응답).
 * @param {string} cookieHeader  fin.land/네이버 세션 쿠키 문자열
 * @returns {Promise<string|null>}
 */
export async function getNaverLandToken(cookieHeader) {
  const now = Date.now();
  if (cached.token && cached.expMs - now > REFRESH_MARGIN_MS) {
    return cached.token;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const token = await captureToken(cookieHeader);
      if (token) {
        cached = { token, expMs: decodeExpMs(token) };
        const mins = Math.round((cached.expMs - Date.now()) / 60000);
        console.log(`[naver-token] 새 토큰 발급 성공 (만료까지 ~${mins}분)`);
        return token;
      }
      console.warn('[naver-token] 토큰 캡처 실패 — 헤드리스 차단 또는 쿠키 만료 가능성');
      return null;
    } catch (err) {
      console.warn(`[naver-token] 발급 오류: ${err?.message ?? err}`);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// 단독 실행 시 토큰을 한 번 발급해 출력 (검증용):
//   NAVER_COOKIE="NID_AUT=...; NID_SES=..." node server/naverTokenProvider.mjs
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('naverTokenProvider.mjs')) {
  const cookie = process.env.NAVER_COOKIE;
  if (!cookie) {
    console.error('환경변수 NAVER_COOKIE 가 필요합니다.');
    process.exit(1);
  }
  getNaverLandToken(cookie).then((t) => {
    console.log(t ? `TOKEN: ${t}` : 'TOKEN: (발급 실패)');
    process.exit(t ? 0 : 2);
  });
}
