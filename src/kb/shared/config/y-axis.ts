// 차트 Y축 설정 — 표시 데이터·기간에 따라 동적으로 산출.
// 거래지표는 0~200 고정(별도 처리)이고, 시세지표/시장지표는 데이터 스케일이 제각각이라
// 표시 구간의 실제 값에서 "깔끔한" 최소/최대·눈금단위·드롭다운 옵션을 계산한다.

export interface YAxisConfig {
  min: number;
  max: number;
  minOptions: number[];
  maxOptions: number[];
  tickStep?: number; // 눈금 간격(=드롭다운 단위). 과밀하면 MetricChart가 자동 축약.
  decimals?: number; // 축 라벨 소수자리 (0 = 정수)
}

export interface DynamicYOptions {
  // 고정 눈금단위. 평균 매매가/전세가는 2,000만원 단위로 고정한다(미지정 시 데이터로 산출).
  step?: number;
  // 음수 허용 여부. 증감·누적변동률은 true, 가격·비율·지수는 false(최소 0 이상).
  allowNegative?: boolean;
}

// {1,2,5}×10^k 계열에서 x 이상인 가장 작은 "깔끔한" 수.
// 데이터 범위에서 사람이 읽기 좋은(끝이 0으로 떨어지는) 눈금단위를 고른다.
function niceCeil(x: number): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const base = 10 ** exp;
  const f = x / base; // 1 ≤ f < 10
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

// 부동소수 오차 보정
function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

// 눈금단위에 맞는 소수자리: 정수단위면 0, 0.5/0.1면 1, 그 이하면 2.
function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

// from~to를 step 간격으로 채우되 조건에 맞는 값만 남긴다(중복 제거·오름차순).
function options(from: number, to: number, step: number, keep: (v: number) => boolean): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + step * 1e-6; v += step) {
    const r = round(v);
    if (keep(r) && !out.includes(r)) out.push(r);
  }
  return out;
}

// 표시 데이터(지역별 시계열)에서 최소/최대를 찾아 동적 Y축 설정을 생성한다.
// - 최대값: 데이터 최대 위로 한 단위(=짝수 천단위 등)의 여유를 둔, step의 배수.
// - 최소값: 데이터 최소 아래로 맞춘 step의 배수(allowNegative=false면 0 이상).
// - 드롭다운: step 단위로 기본값 주변 몇 칸을 선택지로 제공(≈ 범위의 20%).
export function computeDynamicYConfig(
  data: ReadonlyArray<Record<string, number | null | string>>,
  regions: readonly string[],
  opts: DynamicYOptions = {},
): YAxisConfig | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const row of data) {
    for (const region of regions) {
      const v = row[region];
      if (typeof v === 'number' && Number.isFinite(v)) {
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;

  // 눈금단위: 고정값이 있으면 사용, 없으면 범위의 20%(=5분할)를 깔끔한 수로 올림.
  const span = hi > lo ? hi - lo : Math.abs(hi) || 1;
  const step = opts.step ?? niceCeil(span / 5);

  // 최대값: 데이터 최대 위로 한 단위 여유 → 항상 선이 천장에 닿지 않는다.
  const max = round((Math.floor(hi / step) + 1) * step);
  // 최소값: 데이터 최소에 맞춘 단위 배수. 음수 비허용이면 0 이상.
  let min = round(Math.floor(lo / step) * step);
  if (!opts.allowNegative) min = Math.max(0, min);
  if (min >= max) min = round(max - step);

  const decimals = decimalsFor(step);
  const minFloor = opts.allowNegative ? min - step : 0;

  // 드롭다운: 최소는 바닥~기본값 주변, 최대는 기본값 주변 위아래 몇 칸.
  const minOptions = options(minFloor, min + 3 * step, step, v => v < max && (opts.allowNegative || v >= 0));
  const maxOptions = options(max - 2 * step, max + 3 * step, step, v => v > min);

  return {
    min,
    max,
    minOptions: minOptions.length ? minOptions : [min],
    maxOptions: maxOptions.length ? maxOptions : [max],
    tickStep: step,
    decimals,
  };
}
