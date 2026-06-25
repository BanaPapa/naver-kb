// 집계 지역: 행정구역이 아니라 KB가 자체 정의한 통계 단위라 KB Land API에 없다.
// 7개뿐이고 변경 가능성이 없어 상수로 둔다. weeklyKey = 주간 데이터(weekly_data.region)의 키.
export interface AggregateRegion {
  label: string;
  weeklyKey: string;
}

export const AGGREGATE_REGIONS: AggregateRegion[] = [
  { label: '전국', weeklyKey: '전국' },
  { label: '수도권', weeklyKey: '수도권' },
  { label: '6개광역시', weeklyKey: '6개광역시' },
  { label: '5개광역시', weeklyKey: '5개광역시' },
  { label: '강북14개구', weeklyKey: '강북14개구' },
  { label: '강남11개구', weeklyKey: '강남11개구' },
  { label: '기타지방', weeklyKey: '기타지방' },
];
