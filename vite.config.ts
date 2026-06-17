import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error — .mjs Node 모듈 (개발 서버 전용, 타입 선언 없음)
import { getNaverLandToken } from './server/naverTokenProvider.mjs';

// new.land /api/articles (빌라·단독) 는 Bearer 토큰 필수.
// 수동 토큰(x-naver-bearer)이 없으면 헤드리스 브라우저로 자동 발급해 주입한다.
// 프록시(proxyReq)보다 먼저 실행되도록 내부 미들웨어 설치 전에 등록한다.
function naverTokenInjector() {
  return {
    name: 'naver-token-injector',
    configureServer(server: { middlewares: { use: (path: string, fn: unknown) => void } }) {
      server.middlewares.use('/naver-new-api', async (req: any, _res: unknown, next: () => void) => {
        try {
          if (req.url?.startsWith('/api/articles') && !req.headers['x-naver-bearer']) {
            const cookie = req.headers['x-naver-cookie'];
            const cookieStr = Array.isArray(cookie) ? cookie[0] : cookie;
            if (cookieStr) {
              const token = await getNaverLandToken(cookieStr);
              if (token) req.headers['x-naver-bearer'] = token;
            }
          }
        } catch {
          // 토큰 발급 실패 시 토큰 없이 진행 → 네이버가 401, 기존 오류 처리로 안내
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), naverTokenInjector()],
  server: {
    port: 5174,
    proxy: {
      '/naver-api': {
        target: 'https://fin.land.naver.com/front-api/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/naver-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers['x-naver-cookie'];
            if (cookie) {
              proxyReq.setHeader('Cookie', Array.isArray(cookie) ? cookie.join('; ') : cookie);
              proxyReq.removeHeader('x-naver-cookie');
            }
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
          });
        },
      },
      '/naver-new-api': {
        target: 'https://new.land.naver.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/naver-new-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers['x-naver-cookie'];
            if (cookie) {
              proxyReq.setHeader('Cookie', Array.isArray(cookie) ? cookie.join('; ') : cookie);
              proxyReq.removeHeader('x-naver-cookie');
            }
            // Bearer JWT — new.land.naver.com /api/articles 인증에 필요
            const bearer = req.headers['x-naver-bearer'];
            if (bearer) {
              proxyReq.setHeader('Authorization', `Bearer ${Array.isArray(bearer) ? bearer[0] : bearer}`);
              proxyReq.removeHeader('x-naver-bearer');
            }
            const referer = req.headers['x-naver-referer'];
            proxyReq.setHeader(
              'Referer',
              referer ? (Array.isArray(referer) ? referer[0] : referer) : 'https://new.land.naver.com/houses',
            );
            if (referer) proxyReq.removeHeader('x-naver-referer');
            proxyReq.setHeader('Host', 'new.land.naver.com');
            proxyReq.setHeader('Origin', 'https://new.land.naver.com');
            proxyReq.setHeader('Accept-Language', 'ko-KR,ko;q=0.9');
            proxyReq.setHeader('Sec-Fetch-Site', 'same-origin');
            proxyReq.setHeader('Sec-Fetch-Mode', 'cors');
            proxyReq.setHeader('Sec-Fetch-Dest', 'empty');
            proxyReq.setHeader(
              'User-Agent',
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
            );
          });
        },
      },
    },
  },
});
