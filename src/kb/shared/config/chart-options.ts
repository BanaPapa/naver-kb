// 차트 표현 형태 및 옵션 — 시세/거래/시장 대시보드 차트가 공용으로 사용.
// 누적형은 지수·비율 데이터를 오독할 수 있어 제외한다.

export type ChartType =
  | 'line' // 곡선
  | 'lineMarkers' // 선+점
  | 'step' // 계단
  | 'area' // 영역
  | 'bar' // 막대
  | 'scatter'; // 점

// 드롭다운 라벨(한글 표기).
export const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'line', label: '선' },
  { value: 'lineMarkers', label: '선+점' },
  { value: 'step', label: '계단' },
  { value: 'area', label: '영역' },
  { value: 'bar', label: '막대' },
  { value: 'scatter', label: '점' },
];

// 막대 두께(px) 선택지. undefined = 자동(recharts 기본 너비).
export const BAR_SIZE_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: '자동' },
  { value: 4, label: '4' },
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 16, label: '16' },
  { value: 24, label: '24' },
];

// 막대 투명도 선택지(0~1).
export const BAR_OPACITY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '100%' },
  { value: 0.85, label: '85%' },
  { value: 0.7, label: '70%' },
  { value: 0.5, label: '50%' },
  { value: 0.3, label: '30%' },
];

// 그래프별 차트 옵션.
//   type        = 전체 기본 형태
//   seriesType  = 지역(시리즈)별 개별 형태 override → 혼합차트(엑셀식 콤보)
//   barOpacity  = 막대 투명도(0~1)
//   barSize     = 막대 두께(px). 미지정 시 자동.
export interface ChartOptions {
  type: ChartType;
  seriesType: Record<string, ChartType>;
  barOpacity: number;
  barSize?: number;
}

export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  type: 'line',
  seriesType: {},
  barOpacity: 0.85,
};

// 특정 지역(시리즈)의 실효 형태 — 개별 override가 있으면 그것을, 없으면 전체 형태.
export function seriesChartType(opts: ChartOptions, region: string): ChartType {
  return opts.seriesType[region] ?? opts.type;
}

// 차트 내에 막대 시리즈가 하나라도 있는지(막대 전용 옵션 노출 판단용).
export function hasBarSeries(opts: ChartOptions, regions: string[]): boolean {
  return regions.some(r => seriesChartType(opts, r) === 'bar');
}
