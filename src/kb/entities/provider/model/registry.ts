import type { ProviderDef } from './provider.types';

// 정당한 공식 구독 OAuth가 있는 곳에만 subscription을 둔다.
// authorizeUrl/tokenUrl/clientId는 구현 시 공식 문서로 확정(현재 best-known 값).
export const PROVIDERS: ProviderDef[] = [
  {
    id: 'claude-bridge',
    label: 'Claude (현재 세션)',
    apiShape: 'claude-bridge',
    baseUrl: '',
    auth: [],
  },
  {
    id: 'openai',
    label: 'OpenAI',
    apiShape: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    auth: ['apiKey', 'subscription'],
    // ChatGPT 구독(Plus/Pro)은 Codex CLI와 동일한 공개 OAuth로 로그인하고,
    // api.openai.com이 아닌 ChatGPT 백엔드(codex/responses)로 요청한다(실험적, ToS 회색지대).
    subscription: {
      kind: 'oauth-loopback',
      authorizeUrl: 'https://auth.openai.com/oauth/authorize',
      tokenUrl: 'https://auth.openai.com/oauth/token',
      clientId: 'app_EMoamEEZ73f0CkXaXp7hrann',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      loopbackPort: 1455,
      loopbackPath: '/auth/callback',
      extraAuthParams: { id_token_add_organizations: 'true', codex_cli_simplified_flow: 'true', originator: 'codex_cli_rs' },
      apiShape: 'chatgpt-codex',
      baseUrl: 'https://chatgpt.com/backend-api/codex',
    },
    docsUrl: 'https://developers.openai.com/codex/auth',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    apiShape: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    auth: ['apiKey', 'subscription'],
    // Grok CLI(hermes-agent)와 동일한 공개 OAuth 클라이언트. 동의 화면이 코드를 표시하면
    // 사용자가 복사해 붙여넣고, 백엔드가 PKCE로 access_token으로 교환한다.
    subscription: {
      kind: 'oauth-code',
      authorizeUrl: 'https://auth.x.ai/oauth2/authorize',
      tokenUrl: 'https://auth.x.ai/oauth2/token',
      clientId: 'b1a00492-073a-47ea-816f-4c329264a828',
      scopes: ['openid', 'profile', 'email', 'offline_access', 'grok-cli:access', 'api:access'],
      redirectUri: 'http://127.0.0.1:56121/callback',
      extraAuthParams: { referrer: 'hermes-agent', plan: 'generic' },
    },
    docsUrl: 'https://docs.x.ai',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    apiShape: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    // Claude Pro/Max 구독은 API와 분리돼 있고 공개 OAuth가 없어 API 키만 지원.
    auth: ['apiKey'],
    docsUrl: 'https://docs.anthropic.com',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    apiShape: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    // /models는 공개 엔드포인트라 키 없이 무료 모델 포함 목록 조회 가능(실행엔 키 필요).
    publicModelList: true,
    auth: ['apiKey', 'subscription'],
    subscription: {
      kind: 'oauth-pkce',
      authorizeUrl: 'https://openrouter.ai/auth',
      tokenUrl: 'https://openrouter.ai/api/v1/auth/keys',
      scopes: [],
    },
    docsUrl: 'https://openrouter.ai/docs',
  },
  { id: 'google', label: 'Google (Gemini)', apiShape: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', auth: ['apiKey'], docsUrl: 'https://ai.google.dev' },
  { id: 'deepseek', label: 'DeepSeek', apiShape: 'openai-compatible', baseUrl: 'https://api.deepseek.com/v1', auth: ['apiKey'] },
  { id: 'groq', label: 'Groq', apiShape: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1', auth: ['apiKey'] },
  { id: 'mistral', label: 'Mistral', apiShape: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1', auth: ['apiKey'] },
  { id: 'together', label: 'Together', apiShape: 'openai-compatible', baseUrl: 'https://api.together.xyz/v1', auth: ['apiKey'] },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id);
}
