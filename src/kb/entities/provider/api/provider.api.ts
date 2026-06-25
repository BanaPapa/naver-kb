import type { ModelInfo, ProviderStatus } from '../model/provider.types';

const BASE = '/api/providers';

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`프로바이더 요청 실패 (${res.status}) ${msg}`);
  }
  return (await res.json()) as T;
}

export async function fetchProviders(): Promise<ProviderStatus[]> {
  return jsonOrThrow<ProviderStatus[]>(await fetch(BASE, { headers: { Accept: 'application/json' } }));
}

export async function fetchModels(id: string, force = false): Promise<ModelInfo[]> {
  const q = force ? '?refresh=1' : '';
  return jsonOrThrow<ModelInfo[]>(await fetch(`${BASE}/${id}/models${q}`, { headers: { Accept: 'application/json' } }));
}

async function postCredentials(id: string, body: Record<string, unknown>): Promise<void> {
  await jsonOrThrow<unknown>(
    await fetch(`${BASE}/${id}/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function saveApiKey(id: string, apiKey: string): Promise<void> {
  await postCredentials(id, { method: 'apiKey', apiKey });
}

export async function saveSessionToken(id: string, token: string): Promise<void> {
  await postCredentials(id, { method: 'subscription', token });
}

export async function startOAuth(id: string): Promise<{ authUrl: string; state?: string }> {
  return jsonOrThrow<{ authUrl: string; state?: string }>(await fetch(`${BASE}/${id}/oauth/start`));
}

export async function exchangeOAuthCode(id: string, state: string, code: string): Promise<void> {
  await jsonOrThrow<unknown>(
    await fetch(`${BASE}/${id}/oauth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, code }),
    }),
  );
}

export async function disconnect(id: string): Promise<void> {
  await jsonOrThrow<unknown>(await fetch(`${BASE}/${id}/credentials`, { method: 'DELETE' }));
}
