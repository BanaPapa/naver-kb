// 클라이언트 사이드 주간 "거래지표" 데이터 소스 — public/data/kb-weekly-trade.json.
// 매수우위·매매거래활발·전세수급·전세거래활발 4개 지표(대지역/집계 24곳, 2003~).
// 시세지표(weekly-local.ts)와 날짜 축이 달라(2003 vs 2008) 별도 파일로 둔다.
import type { WeeklyDataRow } from '../model/kb-data.types';

const JSON_URL = '/data/kb-weekly-trade.json';
const TRADE_METRIC_KEYS = ['buyerAdvantage', 'saleActivity', 'jeonseSupply', 'jeonseActivity'] as const;

interface KBTradeJson {
  dates: string[];
  data: Record<string, Record<(typeof TRADE_METRIC_KEYS)[number], (number | null)[]>>;
}

let cache: KBTradeJson | null = null;
let loadPromise: Promise<KBTradeJson> | null = null;

async function ensureLoaded(): Promise<KBTradeJson> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = fetch(JSON_URL, { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`거래지표 데이터 로드 실패: HTTP ${r.status}`);
        return r.json() as Promise<KBTradeJson>;
      })
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

export const weeklyTradeLocal = {
  async getRegions(): Promise<string[]> {
    const { data } = await ensureLoaded();
    return Object.keys(data).sort();
  },

  async getDates(): Promise<string[]> {
    const { dates } = await ensureLoaded();
    return dates;
  },

  async getTradeData(regions: string[]): Promise<WeeklyDataRow[]> {
    const { dates, data } = await ensureLoaded();
    const rows: WeeklyDataRow[] = [];
    let id = 0;
    for (const region of regions) {
      const series = data[region];
      if (!series) continue; // 거래지표 없는 지역(중지역 등)은 건너뜀
      for (let i = 0; i < dates.length; i++) {
        rows.push({
          id: id++,
          date: dates[i]!,
          region,
          saleChange: null,
          jeonseChange: null,
          saleIndex: null,
          jeonseIndex: null,
          buyerAdvantage: series.buyerAdvantage[i] ?? null,
          saleActivity: series.saleActivity[i] ?? null,
          jeonseSupply: series.jeonseSupply[i] ?? null,
          jeonseActivity: series.jeonseActivity[i] ?? null,
        });
      }
    }
    return rows;
  },
};
