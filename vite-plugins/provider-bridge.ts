import type { Plugin } from 'vite';
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { getProvider, PROVIDERS } from '../src/kb/entities/provider/model/registry';
import type { ModelInfo, ProviderDef } from '../src/kb/entities/provider/model/provider.types';
import { readOne, writeOne, removeOne, toStatuses, type Credential } from './credentials-store';
import { getAdapter, effectiveDef } from './adapters';
import {
  createVerifier,
  challengeFor,
  createState,
  createNonce,
  putSession,
  takeSession,
  buildAuthorizeUrl,
  exchangeAuthCode,
  extractChatGptAccountId,
} from './oauth';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

// 인가 코드를 토큰으로 교환해 subscription 자격증명으로 저장(테스트 대상 헬퍼).
export async function exchangeOAuthCode(
  root: string,
  id: string,
  state: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const def = getProvider(id);
  const cfg = def?.subscription;
  if (cfg?.kind !== 'oauth-code' || !cfg.tokenUrl || !cfg.clientId || !cfg.redirectUri) {
    throw new Error(`OAuth 코드 교환을 지원하지 않는 프로바이더: ${id}`);
  }
  const trimmed = code.trim();
  if (!state || !trimmed) throw new Error('state와 코드가 필요합니다.');
  const session = takeSession(state);
  if (!session || session.providerId !== id) throw new Error('유효하지 않은 OAuth 세션입니다. 다시 로그인하세요.');
  const tok = await exchangeAuthCode({
    tokenUrl: cfg.tokenUrl,
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    verifier: session.verifier,
    code: trimmed,
    fetchImpl,
  });
  await writeOne(root, id, {
    method: 'subscription',
    accessToken: tok.accessToken,
    refreshToken: tok.refreshToken,
    expiresAt: tok.expiresAt,
  });
}

// loopback 콜백으로 받은 인가 코드를 토큰으로 교환하고, id_token에서 account_id를 추출해 저장(테스트 대상 헬퍼).
export async function completeLoopbackLogin(
  root: string,
  id: string,
  state: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const def = getProvider(id);
  const cfg = def?.subscription;
  if (cfg?.kind !== 'oauth-loopback' || !cfg.tokenUrl || !cfg.clientId || !cfg.loopbackPort) {
    throw new Error(`loopback 로그인을 지원하지 않는 프로바이더: ${id}`);
  }
  if (!state || !code) throw new Error('state와 코드가 필요합니다.');
  const session = takeSession(state);
  if (!session || session.providerId !== id) throw new Error('유효하지 않은 OAuth 세션입니다. 다시 로그인하세요.');
  const redirectUri = `http://localhost:${cfg.loopbackPort}${cfg.loopbackPath ?? '/auth/callback'}`;
  const tok = await exchangeAuthCode({
    tokenUrl: cfg.tokenUrl,
    clientId: cfg.clientId,
    redirectUri,
    verifier: session.verifier,
    code,
    fetchImpl,
  });
  await writeOne(root, id, {
    method: 'subscription',
    accessToken: tok.accessToken,
    refreshToken: tok.refreshToken,
    expiresAt: tok.expiresAt,
    accountId: extractChatGptAccountId(tok.idToken),
  });
}

// 고정 포트 loopback 콜백 서버를 띄우고, authorize에 쓸 redirect_uri를 반환한다.
const loopbackServers = new Map<string, Server>();

function closeLoopback(id: string): void {
  const s = loopbackServers.get(id);
  if (s) {
    s.close();
    loopbackServers.delete(id);
  }
}

function startLoopbackListener(root: string, def: ProviderDef): Promise<string> {
  const cfg = def.subscription!;
  const port = cfg.loopbackPort!;
  const cbPath = cfg.loopbackPath ?? '/auth/callback';
  closeLoopback(def.id);
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void (async () => {
        const u = new URL(req.url ?? '', `http://localhost:${port}`);
        if (u.pathname !== cbPath) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        try {
          const code = u.searchParams.get('code');
          const state = u.searchParams.get('state');
          if (!code || !state) throw new Error('코드/상태 누락');
          await completeLoopbackLogin(root, def.id, state, code);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end('<script>window.opener&&window.opener.postMessage({type:"oauth-done"},"*");window.close();</script>구독 연결 완료. 이 창을 닫아주세요.');
        } catch (err) {
          res.statusCode = 500;
          res.end(`로그인 실패: ${err instanceof Error ? err.message : ''}`);
        } finally {
          closeLoopback(def.id);
        }
      })();
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      loopbackServers.set(def.id, server);
      setTimeout(() => closeLoopback(def.id), 10 * 60 * 1000).unref?.();
      resolve(`http://localhost:${port}${cbPath}`);
    });
  });
}

// 모델 라이브 조회(테스트 대상 헬퍼).
export async function listProviderModels(root: string, id: string, _force: boolean): Promise<ModelInfo[]> {
  const def = getProvider(id);
  if (!def) throw new Error(`알 수 없는 프로바이더: ${id}`);
  if (def.apiShape === 'claude-bridge') return [];
  const cred = await readOne(root, id);
  if (!cred) {
    // 공개 /models 엔드포인트가 있으면 자격증명 없이도 목록만 조회 가능.
    if (def.publicModelList) return getAdapter(def.apiShape).listModels(def, { method: 'apiKey' });
    throw new Error(`연결되지 않은 프로바이더: ${id}`);
  }
  const eff = effectiveDef(def, cred);
  return getAdapter(eff.apiShape).listModels(eff, cred);
}

export function providerBridge(): Plugin {
  return {
    name: 'provider-bridge',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root;

      server.middlewares.use('/api/providers', (req, res, next) => {
        const method = req.method ?? 'GET';
        const url = (req.url ?? '').split('?')[0]!.replace(/^\//, ''); // '', 'openai/models', 'openai/credentials', 'openai/oauth/start'
        const refresh = (req.url ?? '').includes('refresh=1');
        const [id, sub, action] = url.split('/');

        void (async () => {
          try {
            if (method === 'GET' && url === '') {
              sendJson(res, 200, await toStatuses(root));
              return;
            }
            if (!id || !getProvider(id)) { sendJson(res, 404, { error: '알 수 없는 프로바이더' }); return; }

            if (method === 'GET' && sub === 'models') {
              sendJson(res, 200, await listProviderModels(root, id, refresh));
              return;
            }
            if (sub === 'credentials') {
              if (method === 'POST') {
                const parsed = JSON.parse(await readBody(req)) as Partial<Credential>;
                if (parsed.method !== 'apiKey' && parsed.method !== 'subscription') { sendJson(res, 400, { error: '잘못된 method' }); return; }
                await writeOne(root, id, parsed as Credential);
                sendJson(res, 200, { ok: true });
                return;
              }
              if (method === 'DELETE') { await removeOne(root, id); sendJson(res, 200, { ok: true }); return; }
            }
            if (method === 'GET' && sub === 'oauth' && action === 'start') {
              const def = getProvider(id)!;
              const cfg = def.subscription;
              if ((cfg?.kind !== 'oauth-pkce' && cfg?.kind !== 'oauth-code' && cfg?.kind !== 'oauth-loopback') || !cfg.authorizeUrl) {
                sendJson(res, 400, { error: 'OAuth 미지원 프로바이더' });
                return;
              }
              const verifier = createVerifier();
              const state = createState();
              putSession(state, { providerId: id, verifier, createdAt: Date.now() });

              if (cfg.kind === 'oauth-loopback') {
                // 고정 포트 loopback: 우리 서버가 1455 콜백을 직접 받아 토큰 교환한다.
                const redirectUri = await startLoopbackListener(root, def);
                const authUrl = buildAuthorizeUrl(
                  {
                    authorizeUrl: cfg.authorizeUrl,
                    clientId: cfg.clientId ?? '',
                    redirectUri,
                    scopes: cfg.scopes,
                    extraAuthParams: cfg.extraAuthParams,
                  },
                  { state, challenge: challengeFor(verifier), nonce: createNonce() },
                );
                sendJson(res, 200, { authUrl });
                return;
              }

              if (cfg.kind === 'oauth-code') {
                // 코드 붙여넣기 방식: 동의 화면이 코드를 표시하면 사용자가 복사 → exchange로 교환.
                const authUrl = buildAuthorizeUrl(
                  {
                    authorizeUrl: cfg.authorizeUrl,
                    clientId: cfg.clientId ?? '',
                    redirectUri: cfg.redirectUri ?? '',
                    scopes: cfg.scopes,
                    extraAuthParams: cfg.extraAuthParams,
                  },
                  { state, challenge: challengeFor(verifier), nonce: createNonce() },
                );
                sendJson(res, 200, { authUrl, state });
                return;
              }

              // oauth-pkce: 로컬 콜백으로 자동 리다이렉트.
              const redirectUri = `http://localhost:${server.config.server.port ?? 5174}/api/oauth/callback`;
              const params = new URLSearchParams({
                response_type: 'code',
                client_id: cfg.clientId ?? '',
                redirect_uri: redirectUri,
                scope: (cfg.scopes ?? []).join(' '),
                state,
                code_challenge: challengeFor(verifier),
                code_challenge_method: 'S256',
              });
              sendJson(res, 200, { authUrl: `${cfg.authorizeUrl}?${params.toString()}`, state });
              return;
            }
            if (method === 'POST' && sub === 'oauth' && action === 'exchange') {
              const { state, code } = JSON.parse(await readBody(req)) as { state?: string; code?: string };
              await exchangeOAuthCode(root, id, state ?? '', code ?? '');
              sendJson(res, 200, { ok: true });
              return;
            }
            next();
          } catch (err) {
            sendJson(res, 500, { error: err instanceof Error ? err.message : '프로바이더 처리 실패' });
          }
        })();
      });

      server.middlewares.use('/api/oauth/callback', (req, res) => {
        void (async () => {
          try {
            const u = new URL(req.url ?? '', 'http://localhost');
            const code = u.searchParams.get('code');
            const state = u.searchParams.get('state');
            const session = state ? takeSession(state) : undefined;
            if (!code || !session) { res.statusCode = 400; res.end('잘못된 OAuth 콜백입니다. 창을 닫아주세요.'); return; }
            const def = getProvider(session.providerId)!;
            const cfg = def.subscription!;
            const redirectUri = `http://localhost:${server.config.server.port ?? 5174}/api/oauth/callback`;
            const tokenRes = await fetch(cfg.tokenUrl!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: cfg.clientId ?? '',
                redirect_uri: redirectUri,
                code_verifier: session.verifier,
              }).toString(),
            });
            const tok = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number };
            if (!tokenRes.ok || !tok.access_token) { res.statusCode = 502; res.end('토큰 교환 실패. 창을 닫고 다시 시도하세요.'); return; }
            await writeOne(root, session.providerId, {
              method: 'subscription',
              accessToken: tok.access_token,
              refreshToken: tok.refresh_token,
              expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
            });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end('<script>window.opener&&window.opener.postMessage({type:"oauth-done"},"*");window.close();</script>구독 연결 완료. 이 창을 닫아주세요.');
          } catch (err) {
            res.statusCode = 500;
            res.end(`OAuth 오류: ${err instanceof Error ? err.message : ''}`);
          }
        })();
      });

      void PROVIDERS;
    },
  };
}
