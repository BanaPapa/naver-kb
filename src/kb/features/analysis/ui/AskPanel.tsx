import { useEffect, useMemo, useRef, useState } from 'react';
import { runAsk, type AnalysisScope, type AnalysisDataset, type AskTurn, type AskRequest } from '../../../entities/analysis';
import { useProviderStore } from '../../../entities/provider';
import { toAskContext } from '../lib/summarize';
import { estimateAskInputTokens, loadTokenCounter, type TokenCounter } from '../lib/estimate';
import { friendlyError } from '../lib/error-message';
import { Markdown } from './AnalysisResult';

interface AskPanelProps {
  scope: AnalysisScope;
  datasets: AnalysisDataset[]; // 원본(전송 시 경량화). 비어 있으면 결과 마크다운만.
  resultMarkdown: string;
  dataAvailable: boolean;      // 원본 데이터 사용 가능 여부(재수집 성공/신규 분석)
}

export function AskPanel({ scope, datasets, resultMarkdown, dataAvailable }: AskPanelProps) {
  const selectedProviderId = useProviderStore(s => s.selectedProviderId);
  const selectedModelId = useProviderStore(s => s.selectedModelId);
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const lightDatasets = useMemo(() => toAskContext(datasets), [datasets]);

  const [count, setCount] = useState<TokenCounter | null>(null);
  useEffect(() => {
    let active = true;
    loadTokenCounter().then(fn => active && setCount(() => fn));
    return () => { active = false; };
  }, []);
  // 무거운 부분(데이터셋·결과·히스토리)은 메모이즈하고, 입력은 키 입력마다 가볍게 더한다.
  const baseTokens = useMemo(() => {
    if (!count) return null;
    const req: AskRequest = { kind: 'ask', generatedAt: '', scope, datasets: lightDatasets, resultMarkdown, history: turns, question: '' };
    return estimateAskInputTokens(req, count);
  }, [count, scope, lightDatasets, resultMarkdown, turns]);
  const estTokens = baseTokens == null ? null : baseTokens + (count && input ? count(input) : 0);

  const ask = async () => {
    const q = input.trim();
    if (!q || pending) return;
    const history = turns;
    setTurns([...history, { role: 'user', text: q }]);
    setInput('');
    setPending(true);
    setError('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const payload: AskRequest = {
        kind: 'ask',
        generatedAt: new Date().toISOString(),
        scope,
        datasets: lightDatasets,
        resultMarkdown,
        history,
        question: q,
        provider: selectedProviderId,
        model: selectedModelId,
      };
      const res = await runAsk(payload, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      setTurns(t => [...t, { role: 'assistant', text: res.result ?? '' }]);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      // 실패하면 낙관적으로 추가한 질문 턴을 되돌리고 입력창에 복원 → 바로 재시도 가능.
      setTurns(history);
      setInput(q);
      setError(friendlyError(e instanceof Error ? e.message : ''));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h3 className="mb-2 text-sm font-bold text-gray-800">결과에 대해 질문하기</h3>
      {!dataAvailable && (
        <p className="mb-2 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          원본 데이터 없이 결과 요약을 기준으로 답합니다. 세부 수치 질문은 정확하지 않을 수 있습니다.
        </p>
      )}

      <div className="space-y-3">
        {turns.map((t, i) => (
          <div key={i} data-role={t.role} className={t.role === 'user' ? 'text-right' : ''}>
            {t.role === 'user' ? (
              <span className="inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white">{t.text}</span>
            ) : (
              <div className="rounded-lg bg-gray-50 px-3 py-2"><Markdown text={t.text} /></div>
            )}
          </div>
        ))}
        {pending && <p className="text-xs text-gray-400">답변을 기다리는 중…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      <div className="sticky bottom-0 mt-3 bg-white pt-2">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(); } }}
            placeholder="결과/데이터에 대해 질문하세요 (Enter 전송, Shift+Enter 줄바꿈)"
            rows={2}
            className="min-h-0 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={() => void ask()}
            disabled={pending || !input.trim()}
            className="flex-none rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            질문 보내기
          </button>
        </div>
        {estTokens != null && (
          <p className="mt-1 text-[11px] text-gray-400">예상 입력 ~{Math.round(estTokens).toLocaleString()} tok (멀티턴 누적)</p>
        )}
      </div>
    </div>
  );
}
