import type { Adapter } from './openai-compatible';
import type { Credential } from '../credentials-store';

function headers(cred: Credential): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
  if (cred.apiKey) h['x-api-key'] = cred.apiKey;
  else if (cred.accessToken) h['Authorization'] = `Bearer ${cred.accessToken}`;
  else throw new Error('자격증명이 없습니다.');
  return h;
}

async function asJson(res: Response): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`Anthropic 오류 (${res.status}) ${await res.text().catch(() => '')}`);
  return (await res.json()) as Record<string, unknown>;
}

export const anthropic: Adapter = {
  async listModels(def, cred) {
    const json = await asJson(await fetch(`${def.baseUrl}/models`, { headers: headers(cred) }));
    const data = (json.data as { id: string }[]) ?? [];
    return data.map(m => ({ id: m.id }));
  },
  async chat(def, cred, { system, user, model }) {
    const json = await asJson(
      await fetch(`${def.baseUrl}/messages`, {
        method: 'POST',
        headers: headers(cred),
        body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: 'user', content: user }] }),
      }),
    );
    const content = json.content as { type: string; text?: string }[] | undefined;
    const u = json.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    const promptTokens = typeof u?.input_tokens === 'number' ? u.input_tokens : undefined;
    const completionTokens = typeof u?.output_tokens === 'number' ? u.output_tokens : undefined;
    const totalTokens = promptTokens != null || completionTokens != null ? (promptTokens ?? 0) + (completionTokens ?? 0) : undefined;
    return {
      text: content?.map(c => c.text ?? '').join('') ?? '',
      usage: promptTokens != null || completionTokens != null ? { promptTokens, completionTokens, totalTokens } : undefined,
    };
  },
};
