import type { AnalysisRequest, AnalysisResult, AskRequest } from '../model/analysis.types';

// dev 브릿지 엔드포인트. 추후 실제 모델 API로 바뀌어도 이 모듈 인터페이스는 유지한다.
const BASE = '/api/analysis';

export interface PollOptions {
  intervalMs?: number; // 폴링 간격 (기본 1500ms)
  timeoutMs?: number; // 타임아웃 (기본 5분)
  signal?: AbortSignal; // 취소
}

// 분석 요청 전송 → 생성된 id 반환.
export async function postAnalysis(payload: AnalysisRequest | AskRequest): Promise<string> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`분석 요청 실패 (${res.status}) ${msg}`);
  }
  const data = (await res.json()) as { id?: string; error?: string };
  if (!data.id) throw new Error(data.error ?? '분석 id를 받지 못했습니다.');
  return data.id;
}

// 응답이 done 이 될 때까지 폴링. 타임아웃·취소 지원.
export async function pollAnalysis(id: string, opts: PollOptions = {}): Promise<AnalysisResult> {
  const intervalMs = opts.intervalMs ?? 1500;
  const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) throw new DOMException('취소됨', 'AbortError');

    const res = await fetch(`${BASE}/${id}`, { signal: opts.signal });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`분석 조회 실패 (${res.status}) ${msg}`);
    }
    const data = (await res.json()) as Omit<AnalysisResult, 'id'>;
    if (data.status === 'done') return { id, ...data };
    if (data.status === 'error') throw new Error(data.error ?? '분석 중 오류가 발생했습니다.');

    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('분석이 지연되고 있습니다 (타임아웃).');
}

// 요청 전송 + 결과 폴링을 한 번에.
export async function runAnalysis(
  payload: AnalysisRequest,
  opts: PollOptions = {},
): Promise<AnalysisResult> {
  const id = await postAnalysis(payload);
  return pollAnalysis(id, opts);
}

// 질문 요청 + 결과 폴링. 엔드포인트·폴링은 분석과 동일하게 재사용.
export async function runAsk(payload: AskRequest, opts: PollOptions = {}): Promise<AnalysisResult> {
  const id = await postAnalysis(payload);
  return pollAnalysis(id, opts);
}
