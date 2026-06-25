export * from './chart-options';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const CHART_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
];

export const MAX_REGIONS = 5;

export const METRICS = [
  { key: 'saleIndex', label: '매매지수', unit: '' },
  { key: 'jeonseIndex', label: '전세지수', unit: '' },
  { key: 'saleChange', label: '매매증감', unit: '%' },
  { key: 'jeonseChange', label: '전세증감', unit: '%' },
  { key: 'buyerAdvantage', label: '매수우위지수', unit: '' },
  { key: 'saleActivity', label: '매매거래활발', unit: '' },
  { key: 'jeonseSupply', label: '전세수급지수', unit: '' },
  { key: 'jeonseActivity', label: '전세거래활발', unit: '' },
] as const;

export type MetricKey = typeof METRICS[number]['key'];

// 주간 시계열: 요청된 4개 시트(매매지수·전세지수·매매증감·전세증감)만 차트로 표시.
export const WEEKLY_METRICS = [
  { key: 'saleIndex', label: '매매지수', unit: '' },
  { key: 'jeonseIndex', label: '전세지수', unit: '' },
  { key: 'saleChange', label: '매매증감', unit: '%' },
  { key: 'jeonseChange', label: '전세증감', unit: '%' },
] as const satisfies readonly { key: MetricKey; label: string; unit: string }[];

// 주간 거래지표 4개 시트(대지역/집계만). 화면 배치 순서대로:
// 좌상 매수우위, 우상 전세수급, 좌하 매매거래활발, 우하 전세거래활발.
export const TRADE_METRICS = [
  { key: 'buyerAdvantage', label: '매수우위지수', unit: '' },
  { key: 'jeonseSupply', label: '전세수급지수', unit: '' },
  { key: 'saleActivity', label: '매매거래활발지수', unit: '' },
  { key: 'jeonseActivity', label: '전세거래활발지수', unit: '' },
] as const satisfies readonly { key: MetricKey; label: string; unit: string }[];

// 월간 지표 (5개 시트). 단위 표기는 차트/툴팁에 사용.
export const MONTHLY_METRICS = [
  { key: 'saleAptIndex', label: '아파트 매매가격지수', unit: '' },
  { key: 'jeonseAptIndex', label: '아파트 전세가격지수', unit: '' },
  { key: 'aptSaleJeonseRatio', label: '아파트 매매대비 전세비', unit: '%' },
  { key: 'aptAvgSalePerM2', label: '㎡당 평균 매매가', unit: '만원/㎡' },
  { key: 'aptAvgJeonsePerM2', label: '㎡당 평균 전세가', unit: '만원/㎡' },
] as const;

export type MonthlyMetricKey = typeof MONTHLY_METRICS[number]['key'];

// Region groupings
export const REGION_GROUPS: Record<string, string[]> = {
  '전국': ['전국'],
  '서울': ['서울특별시', '강북14개구', '강남11개구'],
  '수도권': ['경기도', '인천광역시', '수도권'],
  '6대광역시': ['6개광역시', '부산광역시', '대구광역시', '광주광역시', '대전광역시', '울산광역시'],
  '세종/기타': ['세종특별자치시', '기타지방'],
};
