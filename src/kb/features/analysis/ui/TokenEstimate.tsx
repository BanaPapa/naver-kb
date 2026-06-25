import { useEffect, useMemo, useState } from 'react';
import type { AnalysisRequest } from '../../../entities/analysis';
import type { ModelInfo } from '../../../entities/provider/model/provider.types';
import { estimateAnalysis, loadTokenCounter, type TokenCounter } from '../lib/estimate';

type Payload = Pick<AnalysisRequest, 'scope' | 'datasets'>;

interface TokenEstimateProps {
  payload: Payload | null; // null = 아직 선택 전/계산 중
  model?: ModelInfo;
  loading?: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString();

function fmtCost(usd: number | null, free: boolean): string {
  if (free) return '무료 ($0)';
  if (usd == null) return '단가 정보 없음';
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  return `~$${usd.toFixed(usd < 0.01 ? 4 : usd < 1 ? 3 : 2)}`;
}

// 분석 전송 전 예상 입력/출력 토큰 + 비용을 실시간 표시.
export function TokenEstimate({ payload, model, loading }: TokenEstimateProps) {
  // 토크나이저는 모달이 열려 이 컴포넌트가 마운트될 때 동적 로드.
  const [count, setCount] = useState<TokenCounter | null>(null);
  useEffect(() => {
    let active = true;
    loadTokenCounter().then(fn => active && setCount(() => fn));
    return () => {
      active = false;
    };
  }, []);

  const est = useMemo(
    () => (payload && count ? estimateAnalysis(payload, count, model) : null),
    [payload, count, model],
  );

  if (loading || (payload && !count)) {
    return <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400">예상치 계산 중…</div>;
  }
  if (!est) {
    return <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-400">지역·지표를 선택하면 예상 토큰/비용을 표시합니다.</div>;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-gray-600">
        <span>
          예상 입력 <strong className="text-gray-900">{fmt(est.inputTokens)}</strong> tok
        </span>
        <span className="text-gray-300">·</span>
        <span>
          예상 출력 <strong className="text-gray-900">~{fmt(est.outputLow)}–{fmt(est.outputHigh)}</strong> tok
        </span>
        <span className="text-gray-300">·</span>
        <span>
          예상 비용 <strong className="text-gray-900">{fmtCost(est.cost.usd, est.cost.free)}</strong>
        </span>
      </div>
      {est.overContext && (
        <p className="mt-1 text-sm text-amber-600">
          ⚠ 입력이 선택 모델의 컨텍스트 한도에 근접합니다. 지역·지표·기간을 줄이는 것을 권장합니다.
        </p>
      )}
      {est.cost.usd == null && !est.cost.free && (
        <p className="mt-1 text-sm text-gray-400">선택 모델의 단가 정보가 없어 비용은 추정할 수 없습니다(구독·세션 모델 등).</p>
      )}
    </div>
  );
}
