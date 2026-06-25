import type { SeriesPoint, SeriesSummary, RegionSeries, AnalysisDataset } from '../../../entities/analysis';

// 시계열 → 요약통계. 결측(null)은 무시하고 유효값만으로 계산한다.
export function summarize(series: SeriesPoint[]): SeriesSummary {
  const valid = series.filter((p): p is { date: string; value: number } => typeof p.value === 'number');
  if (valid.length === 0) {
    return { latest: null, start: null, changeAbs: null, changePct: null, min: null, max: null, mean: null, direction: 'flat' };
  }
  const start = valid[0]!.value;
  const latest = valid[valid.length - 1]!.value;
  const changeAbs = latest - start;
  const changePct = start !== 0 ? (latest / start - 1) * 100 : null;

  let min = valid[0]!.value;
  let max = valid[0]!.value;
  let sum = 0;
  for (const p of valid) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
    sum += p.value;
  }
  const mean = sum / valid.length;

  const eps = 1e-9;
  const direction: SeriesSummary['direction'] =
    changeAbs > eps ? 'up' : changeAbs < -eps ? 'down' : 'flat';

  return { latest, start, changeAbs, changePct, min, max, mean, direction };
}

// 시계열을 maxPoints 이하로 균등 샘플링(첫·끝 보존). 페이로드 크기 제한용.
export function sampleSeries(series: SeriesPoint[], maxPoints = 200): { series: SeriesPoint[]; sampled: boolean } {
  if (series.length <= maxPoints) return { series, sampled: false };
  const step = (series.length - 1) / (maxPoints - 1);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(series[Math.round(i * step)]!);
  }
  // 마지막 포인트 보존 보장
  if (out[out.length - 1] !== series[series.length - 1]) out[out.length - 1] = series[series.length - 1]!;
  return { series: out, sampled: true };
}

// 시계열을 요약통계 + (샘플링된) 시리즈로 묶는다.
export function toRegionSeries(series: SeriesPoint[], maxPoints = 200): RegionSeries {
  const summary = summarize(series);
  const { series: sampledSeries, sampled } = sampleSeries(series, maxPoints);
  return { summary, series: sampledSeries, sampled };
}

// 모델 컨텍스트 보호용 전체 포인트 예산. 지역·지표가 많아도 페이로드 크기를 일정하게 묶는다.
export const TOTAL_POINT_BUDGET = 4000;
const MIN_POINTS_PER_SERIES = 12;

function roundValue(v: number | null): number | null {
  return v == null ? null : Math.round(v * 100) / 100;
}

// 데이터셋 전체의 원시 시계열 포인트 총량을 budget 이하로 맞춘다.
// summary는 전체 데이터로 이미 계산돼 있으므로 손대지 않고, series만 균등 재샘플링·반올림한다.
export function fitPayloadBudget(datasets: AnalysisDataset[], budget = TOTAL_POINT_BUDGET): AnalysisDataset[] {
  const totalSeries = datasets.reduce((n, d) => n + Object.keys(d.byRegion).length, 0);
  if (totalSeries === 0) return datasets;
  const perSeries = Math.max(MIN_POINTS_PER_SERIES, Math.floor(budget / totalSeries));

  return datasets.map(d => {
    const byRegion: AnalysisDataset['byRegion'] = {};
    for (const [region, rs] of Object.entries(d.byRegion)) {
      const { series, sampled } = sampleSeries(rs.series, perSeries);
      byRegion[region] = {
        summary: rs.summary,
        series: series.map(p => ({ date: p.date, value: roundValue(p.value) })),
        sampled: sampled || rs.sampled,
      };
    }
    return { ...d, byRegion };
  });
}

// Q&A 컨텍스트 경량화: 각 시리즈를 perSeries 포인트로 재샘플(요약통계는 보존).
// 분석(4,000포인트)보다 훨씬 작게 보내 멀티턴 토큰 누적을 줄인다.
export function toAskContext(datasets: AnalysisDataset[], perSeries = 40): AnalysisDataset[] {
  return datasets.map(d => {
    const byRegion: AnalysisDataset['byRegion'] = {};
    for (const [region, rs] of Object.entries(d.byRegion)) {
      const { series, sampled } = sampleSeries(rs.series, perSeries);
      byRegion[region] = {
        summary: rs.summary,
        series: series.map(p => ({ date: p.date, value: roundValue(p.value) })),
        sampled: sampled || rs.sampled,
      };
    }
    return { ...d, byRegion };
  });
}
