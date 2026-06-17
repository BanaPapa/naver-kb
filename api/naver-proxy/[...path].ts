// Vercel Edge Function — Naver API 프록시
// 개발: Vite proxy(vite.config.ts)가 대신 처리하므로 이 파일은 프로덕션 전용
export const config = { runtime: 'edge' };

const NAVER_BASE = 'https://fin.land.naver.com/front-api/v1';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // /api/naver-proxy/search/autocomplete/complexes → search/autocomplete/complexes
  const subPath = url.pathname.replace(/^\/api\/naver-proxy\//, '');

  const naverUrl = new URL(`${NAVER_BASE}/${subPath}`);
  url.searchParams.forEach((value, key) => {
    naverUrl.searchParams.set(key, value);
  });

  const cookie = req.headers.get('x-naver-cookie') ?? '';

  const requestHeaders = new Headers({
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Referer': 'https://fin.land.naver.com/map',
    'Origin': 'https://fin.land.naver.com',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  });

  if (cookie) {
    requestHeaders.set('Cookie', cookie);
  }

  const fetchInit: RequestInit = {
    method: req.method,
    headers: requestHeaders,
  };

  if (req.method === 'POST') {
    requestHeaders.set('Content-Type', 'application/json');
    fetchInit.body = await req.text();
  }

  const naverRes = await fetch(naverUrl.toString(), fetchInit);
  const responseText = await naverRes.text();

  return new Response(responseText, {
    status: naverRes.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
