import type { AnalysisScope, AnalysisTab, TokenUsage } from '../../../entities/analysis';
import { formatNumber } from '../../../shared/lib/format';

const TAB_TEXT: Record<AnalysisTab, string> = {
  'weekly-price': '주간·시세',
  'weekly-trade': '주간·거래',
  'monthly-price': '월간·시세',
  'monthly-trade': '월간·거래',
  'monthly-market': '월간·시장',
};

/** 분석 범위를 한 줄 요약 텍스트로. 저장 항목 이름·부제로 쓴다. */
export function summarizeScope(scope: AnalysisScope): string {
  const tabs = scope.tabs.map(t => TAB_TEXT[t] ?? t).join(', ');
  const regions = scope.regions.map(r => scope.regionLabels[r] ?? r).join(', ');
  return `${tabs} · ${regions} · ${scope.period.from}~${scope.period.to}`;
}

/** 토큰 사용량을 사람이 읽는 문자열로. 없으면 빈 문자열. */
export function formatUsage(u?: TokenUsage): string {
  if (!u) return '';
  const parts: string[] = [];
  if (u.promptTokens != null) parts.push(`입력 ${formatNumber(u.promptTokens)}`);
  if (u.completionTokens != null) parts.push(`출력 ${formatNumber(u.completionTokens)}`);
  if (u.totalTokens != null) parts.push(`합계 ${formatNumber(u.totalTokens)}`);
  let s = parts.length ? `${parts.join(' · ')} 토큰` : '';
  if (u.cost != null) s += `${s ? ' · ' : ''}$${u.cost.toFixed(4)}`;
  return s;
}
