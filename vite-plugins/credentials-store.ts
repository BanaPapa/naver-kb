import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PROVIDERS } from '../src/kb/entities/provider/model/registry';
import type { AuthMethod, ProviderStatus } from '../src/kb/entities/provider/model/provider.types';

export interface Credential {
  method: AuthMethod;
  apiKey?: string;       // apiKey 인증
  token?: string;        // session-token 구독
  accessToken?: string;  // oauth
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;    // chatgpt-codex: ChatGPT-Account-ID 헤더용(id_token에서 추출)
}
export type CredentialStore = Record<string, Credential>;

const FILE = '.analysis/providers.local.json';

function filePath(root: string): string {
  return path.join(root, FILE);
}

export async function readAll(root: string): Promise<CredentialStore> {
  const raw = await fs.readFile(filePath(root), 'utf8').catch(() => null);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CredentialStore;
  } catch {
    return {};
  }
}

export async function readOne(root: string, id: string): Promise<Credential | null> {
  return (await readAll(root))[id] ?? null;
}

async function writeAll(root: string, store: CredentialStore): Promise<void> {
  const target = filePath(root);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), 'utf8');
  await fs.rename(tmp, target);
}

export async function writeOne(root: string, id: string, cred: Credential): Promise<void> {
  const store = await readAll(root);
  await writeAll(root, { ...store, [id]: cred });
}

export async function removeOne(root: string, id: string): Promise<void> {
  const store = await readAll(root);
  const { [id]: _removed, ...rest } = store;
  await writeAll(root, rest);
}

// 비밀을 제외한 연결 상태만 반환. claude-bridge는 항상 connected.
export async function toStatuses(root: string): Promise<ProviderStatus[]> {
  const store = await readAll(root);
  return PROVIDERS.map(p => {
    if (p.apiShape === 'claude-bridge') return { id: p.id, connected: true };
    const cred = store[p.id];
    return cred
      ? { id: p.id, connected: true, method: cred.method }
      : { id: p.id, connected: false };
  });
}
