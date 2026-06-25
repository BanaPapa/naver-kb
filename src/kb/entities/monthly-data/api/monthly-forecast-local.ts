// 클라이언트 사이드 월간 "전망지표" 데이터 소스 — public/data/kb-monthly-forecast.json.
// KB부동산 매매/전세 가격 전망지수(0~200 확산지수, 100 중립). 대지역/집계 24곳만 제공.
// 시장지표 탭의 중간행에서 사용하며, 중지역 선택 시 대지역(시도)으로 폴백해 표현한다.
import type { MonthlyForecastRegion, TimeseriesPoint } from '../model/monthly-data.types';
import { loadKbJson } from '../../../shared/lib/kb-source/loader';

const FORECAST_METRIC_KEYS = ['saleForecast', 'jeonseForecast'] as const;

interface KBForecastJson {
  dates: string[];
  data: Record<string, Record<(typeof FORECAST_METRIC_KEYS)[number], (number | null)[]>>;
}

let cache: KBForecastJson | null = null;
let loadPromise: Promise<KBForecastJson> | null = null;

async function ensureLoaded(): Promise<KBForecastJson> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = loadKbJson<KBForecastJson>('monthly-forecast')
      .then(json => {
        cache = json;
        return json;
      })
      .catch(err => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

// 선택 키 → 전망지표 키. 전망은 대지역만 있으므로 중지역("시도|시군구")이면 시도로 폴백한다.
function forecastKeyFor(key: string): string {
  return key.includes('|') ? key.split('|')[0]! : key;
}

function toPoints(dates: string[], arr: (number | null)[] | undefined): TimeseriesPoint[] {
  if (!arr) return [];
  const out: TimeseriesPoint[] = [];
  for (let i = 0; i < dates.length; i++) {
    const v = arr[i];
    if (v != null) out.push({ date: dates[i]!, value: v });
  }
  return out;
}

export const monthlyForecastLocal = {
  async getDates(): Promise<string[]> {
    const { dates } = await ensureLoaded();
    return dates;
  },

  async getForecastData(keys: string[]): Promise<MonthlyForecastRegion[]> {
    const { dates, data } = await ensureLoaded();
    return keys.map(key => {
      const series = data[forecastKeyFor(key)];
      return {
        key, // 원래 선택 키를 유지(색/라벨 매칭). 값은 대지역 전망.
        saleForecast: toPoints(dates, series?.saleForecast),
        jeonseForecast: toPoints(dates, series?.jeonseForecast),
      };
    });
  },
};
