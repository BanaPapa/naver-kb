import type { ProviderDef, ModelInfo } from '../../src/kb/entities/provider/model/provider.types';
import type { TokenUsage } from '../../src/kb/entities/analysis/model/analysis.types';
import type { Credential } from '../credentials-store';

export interface ChatInput { system: string; user: string; model: string }
export interface ChatResult { text: string; usage?: TokenUsage }
export interface Adapter {
  listModels: (def: ProviderDef, cred: Credential) => Promise<ModelInfo[]>;
  chat: (def: ProviderDef, cred: Credential, input: ChatInput) => Promise<ChatResult>;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// OpenAI 호환 usage: { prompt_tokens, completion_tokens, total_tokens, cost? }
export function parseOpenAiUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const u = raw as Record<string, unknown>;
  const usage: TokenUsage = {
    promptTokens: num(u.prompt_tokens),
    completionTokens: num(u.completion_tokens),
    totalTokens: num(u.total_tokens),
    cost: num(u.cost),
  };
  return Object.values(usage).some(v => v !== undefined) ? usage : undefined;
}

function bearer(cred: Credential): string {
  const token = cred.apiKey ?? cred.accessToken ?? cred.token;
  if (!token) throw new Error('자격증명이 없습니다.');
  return `Bearer ${token}`;
}

// 키가 있으면 Authorization을 붙이고, 없으면 익명 요청(공개 목록 조회용).
function optionalAuthHeaders(cred: Credential): Record<string, string> {
  const token = cred.apiKey ?? cred.accessToken ?? cred.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`프로바이더 오류 (${res.status}) ${await res.text().catch(() => '')}`);
  return (await res.json()) as Record<string, unknown>;
}

// OpenAI 호환 /models 응답의 모델 한 건(프로바이더별로 필드가 다를 수 있어 모두 옵셔널).
interface RawModel {
  id: string;
  name?: string;
  created?: number;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

function toNumber(v: string | undefined): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toModelInfo(m: RawModel): ModelInfo {
  const promptPrice = toNumber(m.pricing?.prompt);
  const completionPrice = toNumber(m.pricing?.completion);
  const isFree = m.id.endsWith(':free') || (promptPrice === 0 && completionPrice === 0);
  return {
    id: m.id,
    label: m.name,
    created: m.created,
    promptPrice,
    completionPrice,
    contextLength: m.context_length,
    isFree,
  };
}

export const openAiCompatible: Adapter = {
  async listModels(def, cred) {
    const json = await asJson(await fetch(`${def.baseUrl}/models`, { headers: optionalAuthHeaders(cred) }));
    const data = (json.data as RawModel[]) ?? [];
    return data.map(toModelInfo);
  },
  async chat(def, cred, { system, user, model }) {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    };
    // OpenRouter는 usage accounting을 켜야 응답에 cost가 포함된다(토큰 수는 기본 제공).
    if (def.baseUrl.includes('openrouter')) body.usage = { include: true };
    const json = await asJson(
      await fetch(`${def.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: bearer(cred), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    const choices = json.choices as { message?: { content?: string } }[] | undefined;
    return { text: choices?.[0]?.message?.content ?? '', usage: parseOpenAiUsage(json.usage) };
  },
};
