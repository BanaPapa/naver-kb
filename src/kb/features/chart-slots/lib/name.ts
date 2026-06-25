import type { ChartSetSnapshot } from '../model/types';

// 선택 지역을 "대표 외 N" 형태로 요약. 라벨이 있으면 라벨 사용.
export function summarizeRegions(
  selectedRegions: string[],
  regionLabels: Record<string, string>,
): string {
  if (selectedRegions.length === 0) return '(빈 선택)';
  const first = regionLabels[selectedRegions[0]!] ?? selectedRegions[0]!;
  if (selectedRegions.length === 1) return first;
  return `${first} 외 ${selectedRegions.length - 1}`;
}

function yearOf(date: string): string {
  return date.slice(0, 4);
}

// 자동 슬롯 이름: "대표지역 외 N · 시작연도–종료연도".
export function generateSlotName(snapshot: ChartSetSnapshot): string {
  const regions = summarizeRegions(snapshot.selectedRegions, snapshot.regionLabels);
  const from = yearOf(snapshot.fromDate);
  const to = yearOf(snapshot.toDate);
  const period = from && to ? ` · ${from}–${to}` : '';
  return `${regions}${period}`;
}
