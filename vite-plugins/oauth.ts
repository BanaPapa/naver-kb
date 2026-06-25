import crypto from 'node:crypto';

export function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createVerifier(): string {
  return base64url(crypto.randomBytes(48)); // 64자 내외
}

export function challengeFor(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

export function createState(): string {
  return base64url(crypto.randomBytes(16));
}

export function createNonce(): string {
  return base64url(crypto.randomBytes(16));
}

// oauth-code/oauth-pkce authorize URL 구성에 필요한 최소 설정.
export interface AuthorizeUrlConfig {
  authorizeUrl: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  extraAuthParams?: Record<string, string>; // referrer, plan 등 프로바이더 고정 파라미터
}

export function buildAuthorizeUrl(
  cfg: AuthorizeUrlConfig,
  p: { state: string; challenge: string; nonce: string },
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: (cfg.scopes ?? []).join(' '),
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    nonce: p.nonce,
    ...(cfg.extraAuthParams ?? {}),
  });
  return `${cfg.authorizeUrl}?${params.toString()}`;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  idToken?: string;
}

interface TokenEndpointResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
}

// ChatGPT id_token(JWT)의 'https://api.openai.com/auth'.chatgpt_account_id 클레임을 추출.
export function extractChatGptAccountId(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;
  const segments = idToken.split('.');
  if (segments.length < 2) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(segments[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
    const auth = payload['https://api.openai.com/auth'] as { chatgpt_account_id?: string } | undefined;
    return auth?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

// 인가 코드(authorization_code)를 access_token으로 교환(PKCE).
export async function exchangeAuthCode(opts: {
  tokenUrl: string;
  clientId: string;
  redirectUri: string;
  verifier: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<OAuthTokenResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(opts.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      client_id: opts.clientId,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.verifier,
    }).toString(),
  });
  const tok = (await res.json().catch(() => ({}))) as TokenEndpointResponse;
  if (!res.ok || !tok.access_token) {
    throw new Error(`토큰 교환 실패 (${res.status}). 코드가 만료되었거나 잘못되었습니다.`);
  }
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : undefined,
    idToken: tok.id_token,
  };
}

export interface PkceSession {
  providerId: string;
  verifier: string;
  createdAt: number;
}

// state → 세션. dev 서버 수명 동안만 유효(메모리).
export const pkceSessions = new Map<string, PkceSession>();

export function putSession(state: string, session: PkceSession): void {
  pkceSessions.set(state, session);
  // 10분 후 정리
  setTimeout(() => pkceSessions.delete(state), 10 * 60 * 1000).unref?.();
}

export function takeSession(state: string): PkceSession | undefined {
  const s = pkceSessions.get(state);
  if (s) pkceSessions.delete(state);
  return s;
}
