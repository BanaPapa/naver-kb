// 분석 요청/응답 데이터 모델. 브릿지(.analysis/*)와 프론트엔드가 공유하는 계약.

// 한 시계열의 요약통계
export interface SeriesSummary {
  latest: number | null; // 최신값
  start: number | null; // 구간 시작값
  changeAbs: number | null; // latest - start
  changePct: number | null; // (latest/start - 1) * 100
  min: number | null;
  max: number | null;
  mean: number | null;
  direction: 'up' | 'down' | 'flat'; // 추세 방향
}

export interface SeriesPoint {
  date: string;
  value: number | null;
}

export interface RegionSeries {
  summary: SeriesSummary;
  series: SeriesPoint[]; // 200포인트 초과 시 균등 샘플링됨
  sampled: boolean; // 샘플링 여부
}

export type AnalysisTab =
  | 'weekly-price'
  | 'weekly-trade'
  | 'monthly-price'
  | 'monthly-trade'
  | 'monthly-market';

export interface AnalysisDataset {
  tab: AnalysisTab;
  metric: string; // 예: 'saleIndex', 'avgSale'
  label: string; // 사람이 읽는 지표명
  unit: string;
  byRegion: Record<string, RegionSeries>;
}

export interface AnalysisScope {
  mode: 'weekly' | 'monthly' | 'mixed';
  regions: string[];
  regionLabels: Record<string, string>;
  period: { from: string; to: string };
  tabs: AnalysisTab[];
}

export interface AnalysisRequest {
  id?: string;
  kind?: 'analysis'; // 미지정=analysis. ask와 구분용.
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[];
  provider?: string;       // 추가: 미지정 시 claude-bridge
  model?: string | null;   // 추가
}

// 모델 호출 토큰 사용량. 프로바이더마다 제공 필드가 달라 모두 옵셔널.
export interface TokenUsage {
  promptTokens?: number;     // 입력 토큰
  completionTokens?: number; // 출력 토큰
  totalTokens?: number;      // 합계
  cost?: number;             // USD 비용(OpenRouter 등 제공 시)
}

export interface AnalysisResult {
  id: string;
  status: 'pending' | 'done' | 'error';
  result?: string; // 마크다운
  model?: string;
  usage?: TokenUsage;
  error?: string;
}

// 한 번의 질문/답변 턴
export interface AskTurn {
  role: 'user' | 'assistant';
  text: string;
}

// 분석 결과 기반 질문 요청. 브리지는 AnalysisRequest와 동일 엔드포인트로 받는다.
export interface AskRequest {
  id?: string;
  kind: 'ask';
  generatedAt: string;
  scope: AnalysisScope;
  datasets: AnalysisDataset[]; // 경량 컨텍스트(요약 + 성긴 시계열)
  resultMarkdown: string;      // 직전 분석 결과(전체 탭)
  history: AskTurn[];          // 직전까지의 Q/A
  question: string;
  provider?: string;
  model?: string | null;
}
