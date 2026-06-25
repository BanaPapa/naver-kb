// 분석 전송 전 토큰·비용 예상치 계산.
// 입력 토큰: 실제 전송 페이로드(시스템 프롬프트 + user JSON)를 토크나이저로 정확히 측정.
// 출력 토큰: 탭 수·지표 수 기반 휴리스틱(범위). 비용: 선택 모델 단가 × 토큰.

import systemPrompt from '../../../../docs/analysis-prompt.md?raw';
import qaPrompt from '../../../../docs/analysis-qa-prompt.md?raw';
import type { AnalysisRequest, AskRequest } from '../../../entities/analysis';
import type { ModelInfo } from '../../../entities/provider/model/provider.types';

type Payload = Pick<AnalysisRequest, 'scope' | 'datasets'>;

// 텍스트 → 토큰 수. gpt-tokenizer를 주입받아 estimate 로직을 토크나이저와 분리한다.
export type TokenCounter = (text: string) => number;

// 채팅 메시지 래핑(role 등) 근사 오버헤드.
const CHAT_OVERHEAD = 8;

const MAX_REPORT_REGIONS = 5; // 분석 대상 지역 상한(탭 수 계산용)

// gpt-tokenizer(BPE 사전 포함, 수백 KB)는 분석 모달이 열릴 때만 동적 로드해 초기 번들에서 제외.
let counterPromise: Promise<TokenCounter> | null = null;
export function loadTokenCounter(): Promise<TokenCounter> {
  if (!counterPromise) {
    counterPromise = import('gpt-tokenizer').then(m => (text: string) => m.encode(text).length);
  }
  return counterPromise;
}

// analysis-runner.buildMessages 의 user 직렬화와 동일하게 토큰을 센다.
export function estimateInputTokens(payload: Payload, count: TokenCounter): number {
  const user = JSON.stringify({ scope: payload.scope, datasets: payload.datasets }, null, 2);
  return count(systemPrompt) + count(user) + CHAT_OVERHEAD;
}

// 출력은 모델이 정하므로 사전 확정 불가 — 보고서 구조(탭 수)로 범위만 추정.
// 보고서는 탭마다 결론(5문장+)·요약(3×2문장)·판단 근거 3·의문점 3·인사이트 3의
// 한국어 마크다운으로, 탭당 대략 A4 반 페이지(≈1,000~2,000 토큰) 분량이다.
// 분량은 데이터셋 수보다 탭 수에 크게 좌우되며, 데이터셋은 인용 수치를 늘려 소폭 가산한다.
export function estimateOutputTokens(payload: Payload): { low: number; high: number } {
  const regions = payload.scope.regions.length;
  const tabCount = regions > 1 ? 1 + Math.min(regions, MAX_REPORT_REGIONS) : 1; // 종합 + 지역별(최대 3)
  const datasets = payload.datasets.length;
  // 탭당: 한국어 구조 본문 기본분 + 데이터셋(인용 수치)당 소폭 가산.
  const low = tabCount * (900 + datasets * 25);
  const high = tabCount * (1700 + datasets * 60);
  return { low, high };
}

export interface CostEstimate {
  usd: number | null; // null = 단가 정보 없음(구독·세션 모델 등)
  free: boolean;
}

// promptPrice/completionPrice 는 토큰당 USD (OpenRouter pricing.prompt/completion).
// 비용은 보수적으로 출력 상한(outputHigh)을 사용.
export function estimateCost(inputTokens: number, outputHigh: number, model?: ModelInfo): CostEstimate {
  if (!model) return { usd: null, free: false };
  if (model.isFree) return { usd: 0, free: true };
  const pin = model.promptPrice;
  const pout = model.completionPrice;
  if (pin == null && pout == null) return { usd: null, free: false };
  const usd = (pin ?? 0) * inputTokens + (pout ?? 0) * outputHigh;
  return { usd, free: false };
}

export interface AnalysisEstimate {
  inputTokens: number;
  outputLow: number;
  outputHigh: number;
  cost: CostEstimate;
  overContext: boolean; // 입력이 모델 컨텍스트 한도의 90%를 넘는가
}

export function estimateAnalysis(payload: Payload, count: TokenCounter, model?: ModelInfo): AnalysisEstimate {
  const inputTokens = estimateInputTokens(payload, count);
  const { low, high } = estimateOutputTokens(payload);
  const cost = estimateCost(inputTokens, high, model);
  const overContext = !!model?.contextLength && inputTokens > model.contextLength * 0.9;
  return { inputTokens, outputLow: low, outputHigh: high, cost, overContext };
}

// Q&A 전송 페이로드의 입력 토큰 추정(Q&A 시스템 프롬프트 + 직렬화된 user 메시지).
export function estimateAskInputTokens(req: AskRequest, count: TokenCounter): number {
  const history = req.history.map(t => `${t.role === 'user' ? '질문' : '답변'}: ${t.text}`).join('\n\n');
  const user = [
    '## 직전 분석 결과',
    req.resultMarkdown,
    '',
    '## 원본 데이터(JSON)',
    JSON.stringify({ scope: req.scope, datasets: req.datasets }, null, 2),
    '',
    '## 이전 대화',
    history || '(없음)',
    '',
    '## 새 질문',
    req.question,
  ].join('\n');
  return count(qaPrompt) + count(user) + CHAT_OVERHEAD;
}
