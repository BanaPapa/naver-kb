import { randomUUID } from 'node:crypto';
import type { ModelInfo } from '../../src/kb/entities/provider/model/provider.types';
import type { TokenUsage } from '../../src/kb/entities/analysis/model/analysis.types';
import type { Credential } from '../credentials-store';
import type { Adapter, ChatResult } from './openai-compatible';

// Codex /models는 client_version으로 minimal_client_version 필터링을 한다.
// '0.0.0'은 버전 게이팅을 우회해 현재 list 모델 전부를 돌려주는 센티넬로 동작한다.
const CODEX_CLIENT_VERSION = '0.0.0';

interface CodexModel {
  slug?: string;
  display_name?: string;
  visibility?: string;       // 'list' | 'hide'
  supported_in_api?: boolean;
  context_window?: number;
}

function baseHeaders(cred: Credential): Record<string, string> {
  if (!cred.accessToken) throw new Error('ChatGPT 구독 토큰이 없습니다. 다시 로그인하세요.');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cred.accessToken}`,
    originator: 'codex_cli_rs',
  };
  if (cred.accountId) headers['chatgpt-account-id'] = cred.accountId;
  return headers;
}

interface ResponsesUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

interface ResponsesOutputItem {
  type?: string;
  content?: { type?: string; text?: string }[];
}

interface ResponsesJson {
  output?: ResponsesOutputItem[];
  usage?: ResponsesUsage;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function mapUsage(raw: ResponsesUsage | undefined): TokenUsage | undefined {
  if (!raw) return undefined;
  const usage: TokenUsage = {
    promptTokens: num(raw.input_tokens),
    completionTokens: num(raw.output_tokens),
    totalTokens: num(raw.total_tokens),
  };
  return Object.values(usage).some(v => v !== undefined) ? usage : undefined;
}

function textFromOutput(output: ResponsesOutputItem[] | undefined): string {
  if (!Array.isArray(output)) return '';
  return output
    .flatMap(item => item.content ?? [])
    .filter(c => c.type === 'output_text' && typeof c.text === 'string')
    .map(c => c.text as string)
    .join('');
}

// Codex Responses 응답을 파싱한다. SSE 스트림과 단일 JSON 응답을 모두 처리.
export function parseCodexResponse(raw: string): ChatResult {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as ResponsesJson;
      return { text: textFromOutput(json.output), usage: mapUsage(json.usage) };
    } catch {
      // SSE 파싱으로 폴백
    }
  }

  let text = '';
  let usage: TokenUsage | undefined;
  for (const line of trimmed.split(/\r?\n/)) {
    const m = line.match(/^data:\s?(.*)$/);
    if (!m) continue;
    const payload = m[1]!.trim();
    if (!payload || payload === '[DONE]') continue;
    let evt: { type?: string; delta?: string; response?: ResponsesJson };
    try {
      evt = JSON.parse(payload);
    } catch {
      continue;
    }
    if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
      text += evt.delta;
    } else if (evt.type === 'response.completed' && evt.response) {
      usage = mapUsage(evt.response.usage) ?? usage;
      if (!text) text = textFromOutput(evt.response.output);
    }
  }
  return { text, usage };
}

export const chatgptCodex: Adapter = {
  // Codex 백엔드의 실제 지원 모델을 라이브 조회한다(하드코딩 X). visibility==='list'만 노출.
  async listModels(def, cred) {
    const res = await fetch(`${def.baseUrl}/models?client_version=${CODEX_CLIENT_VERSION}`, {
      headers: { ...baseHeaders(cred), Accept: 'application/json' },
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`ChatGPT 구독 모델 조회 오류 (${res.status}) ${raw.slice(0, 300)}`);
    const json = JSON.parse(raw) as { models?: CodexModel[] };
    return (json.models ?? [])
      .filter(m => m.slug && m.visibility === 'list' && m.supported_in_api !== false)
      .map<ModelInfo>(m => ({ id: m.slug!, label: m.display_name ?? m.slug, contextLength: m.context_window }));
  },

  async chat(def, cred, { system, user, model }) {
    const headers: Record<string, string> = {
      ...baseHeaders(cred),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'OpenAI-Beta': 'responses=experimental',
      session_id: randomUUID(),
    };

    const body = {
      model,
      instructions: system,
      input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: user }] }],
      store: false,
      stream: true,
    };

    const res = await fetch(`${def.baseUrl}/responses`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`ChatGPT 구독 오류 (${res.status}) ${raw.slice(0, 500)}`);
    return parseCodexResponse(raw);
  },
};
