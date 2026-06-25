import type { ApiShape, ProviderDef } from '../../src/kb/entities/provider/model/provider.types';
import type { Credential } from '../credentials-store';
import { openAiCompatible, type Adapter } from './openai-compatible';
import { anthropic } from './anthropic';
import { gemini } from './gemini';
import { chatgptCodex } from './chatgpt-codex';

export type { Adapter, ChatInput, ChatResult } from './openai-compatible';

export function getAdapter(shape: ApiShape): Adapter {
  switch (shape) {
    case 'openai-compatible': return openAiCompatible;
    case 'anthropic': return anthropic;
    case 'gemini': return gemini;
    case 'chatgpt-codex': return chatgptCodex;
    case 'claude-bridge': throw new Error('claude-bridge는 어댑터가 아닌 디스크 흐름으로 처리됩니다.');
  }
}

// 구독 인증은 apiKey 경로와 다른 엔드포인트(apiShape/baseUrl)를 쓸 수 있다(예: OpenAI 구독 → chatgpt-codex).
// 자격증명 method에 따라 실제로 사용할 ProviderDef를 해석한다.
export function effectiveDef(def: ProviderDef, cred: Credential): ProviderDef {
  const sub = def.subscription;
  if (cred.method === 'subscription' && sub?.apiShape && sub?.baseUrl) {
    return { ...def, apiShape: sub.apiShape, baseUrl: sub.baseUrl };
  }
  return def;
}
