// 클라이언트 사이드 주간 데이터 소스 — 백엔드 불필요.
// public/data/kb-weekly.json(백엔드 DB 익스포트, scripts/export-weekly-json.mjs)을 1회 로드해
// 메모리에 캐싱하고, 기존 백엔드 API와 동일한 형태로 제공한다.
// 추후 Supabase 연결 시 이 모듈만 교체하면 된다.
import type { WeeklyDataRow, CollectionStatus } from '../model/kb-data.types';

const JSON_URL = '/data/kb-weekly.json';
const WEEKLY_METRIC_KEYS = ['saleIndex', 'jeonseIndex', 'saleChange', 'jeonseChange'] as const;

interface KBWeeklyJson {
  dates: string[];
  data: Record<string, Record<(typeof WEEKLY_METRIC_KEYS)[number], (number | null)[]>>;
}

let cache: KBWeeklyJson | null = null;
let loadPromise: Promise<KBWeeklyJson> | null = null;

async function ensureLoaded(): Promise<KBWeeklyJson> {
  if (cache) return cache;
  if (!loadPromise) {
    // cache: 'no-cache' — 데이터 재빌드 시 옛 JSON이 브라우저 캐시로 남지 않도록 항상 재검증
    loadPromise = fetch(JSON_URL, { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`주간 데이터 로드 실패: HTTP ${r.status}`);
        return r.json() as Promise<KBWeeklyJson>;
      })
      .then(json => {
        cache = json;
        return json;
      })
      .catch(err => {
        loadPromise = null; // 실패 시 재시도 가능
        throw err;
      });
  }
  return loadPromise;
}

export const weeklyLocal = {
  async getRegions(): Promise<string[]> {
    const { data } = await ensureLoaded();
    return Object.keys(data).sort();
  },

  async getDates(): Promise<string[]> {
    const { dates } = await ensureLoaded();
    return dates;
  },

  async getWeeklyData(regions: string[], from: string, to: string): Promise<WeeklyDataRow[]> {
    const { dates, data } = await ensureLoaded();
    const rows: WeeklyDataRow[] = [];
    let id = 0;
    for (const region of regions) {
      const series = data[region];
      if (!series) continue;
      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]!;
        if (from && date < from) continue;
        if (to && date > to) continue;
        rows.push({
          id: id++,
          date,
          region,
          saleChange: series.saleChange[i] ?? null,
          jeonseChange: series.jeonseChange[i] ?? null,
          saleIndex: series.saleIndex[i] ?? null,
          jeonseIndex: series.jeonseIndex[i] ?? null,
          buyerAdvantage: null,
          saleActivity: null,
          jeonseSupply: null,
          jeonseActivity: null,
        });
      }
    }
    return rows;
  },

  async getCollectionStatus(): Promise<CollectionStatus> {
    const { dates, data } = await ensureLoaded();
    let total = 0;
    for (const series of Object.values(data)) {
      for (const v of series.saleIndex) if (v != null) total++;
    }
    return {
      logs: [],
      latestDate: dates.length ? dates[dates.length - 1]! : null,
      totalRecords: total,
    };
  },
};
