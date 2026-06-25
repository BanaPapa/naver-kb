// 클라이언트 사이드 월간 "거래지표" 데이터 소스 — public/data/kb-monthly-trade.json.
// 매수우위·매매거래활발·전세수급·전세거래활발 4개 확산지수(대지역/집계 24곳, 2000~).
// 주간 거래지표(weekly-trade-local.ts)와 완전히 동일한 구조이며, 소스가 월간 시계열인 점만 다르다.
// 시세지표(monthly-local.ts)와 날짜축(YYYY-MM)이 달라 별도 파일로 둔다.
import type { WeeklyDataRow } from '../../kb-data';

const JSON_URL = '/data/kb-monthly-trade.json';
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
        if (!r.ok) throw new Error(`월간 거래지표 데이터 로드 실패: HTTP ${r.status}`);
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

export const monthlyTradeLocal = {
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
