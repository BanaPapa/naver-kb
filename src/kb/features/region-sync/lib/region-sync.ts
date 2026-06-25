// 주간↔월간 연동 컨트롤러.
// 연동이 켜지면 한쪽의 지역·기준월·기간 변경을 반대쪽으로 거울처럼 반영한다.
// 기준월/기간은 주간(YYYY-MM-DD) ↔ 월간(YYYY-MM) 해상도를 변환한다.
//   - 주간→월간: 그 주가 속한 '달'(YYYY-MM)
//   - 월간→주간: 그 달의 '첫 주'(시작), '마지막 주'(끝)
import { useAppStore } from '../../../shared/lib/store';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { useRegionSync } from '../model/sync-store';

type Mode = 'weekly' | 'monthly';

// 거울 반영 중 재진입(에코) 방지 가드.
let applying = false;

function monthOf(d: string): string {
  return d.slice(0, 7);
}

function sameRegions(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every(x => sb.has(x));
}

// 월간 날짜축(YYYY-MM)에서 target 달을 범위 내로 보정. 없으면 가장 가까운 이전 달.
function clampMonth(monthlyDates: string[], month: string): string | undefined {
  if (monthlyDates.length === 0) return undefined;
  if (monthlyDates.includes(month)) return month;
  const first = monthlyDates[0]!;
  const last = monthlyDates[monthlyDates.length - 1]!;
  if (month < first) return first;
  if (month > last) return last;
  let cand = first;
  for (const d of monthlyDates) {
    if (d <= month) cand = d;
    else break;
  }
  return cand;
}

// 주간 날짜축에서 해당 달의 첫 주. 없으면 그 달 1일에 가장 가까운 주.
function firstWeekOfMonth(weeklyDates: string[], month: string): string | undefined {
  if (weeklyDates.length === 0) return undefined;
  const inMonth = weeklyDates.filter(d => monthOf(d) === month);
  if (inMonth.length) return inMonth[0];
  return nearestWeek(weeklyDates, `${month}-01`);
}

// 주간 날짜축에서 해당 달의 마지막 주. 없으면 그 달 말일에 가장 가까운 주.
function lastWeekOfMonth(weeklyDates: string[], month: string): string | undefined {
  if (weeklyDates.length === 0) return undefined;
  const inMonth = weeklyDates.filter(d => monthOf(d) === month);
  if (inMonth.length) return inMonth[inMonth.length - 1];
  return nearestWeek(weeklyDates, `${month}-31`);
}

// 범위 보정: target 이하 중 가장 큰 주(없으면 첫 주).
function nearestWeek(weeklyDates: string[], target: string): string {
  let cand = weeklyDates[0]!;
  for (const d of weeklyDates) {
    if (d <= target) cand = d;
    else break;
  }
  return cand;
}

// 주간 상태 → 월간으로 반영.
function applyWeeklyToMonthly(): void {
  const w = useAppStore.getState();
  const m = useMonthlyStore.getState();
  const md = m.allDates;
  applying = true;
  useMonthlyStore.setState({
    selectedRegions: [...w.selectedRegions],
    regionLabels: { ...w.regionLabels },
    baseDate: clampMonth(md, monthOf(w.baseDate)) ?? m.baseDate,
    fromDate: clampMonth(md, monthOf(w.fromDate)) ?? m.fromDate,
    toDate: clampMonth(md, monthOf(w.toDate)) ?? m.toDate,
  });
  applying = false;
  void m.loadPriceData();
  void m.loadTradeData();
  void m.loadMarketData();
}

// 월간 상태 → 주간으로 반영.
function applyMonthlyToWeekly(): void {
  const m = useMonthlyStore.getState();
  const w = useAppStore.getState();
  const wd = w.allDates;
  applying = true;
  useAppStore.setState({
    selectedRegions: [...m.selectedRegions],
    regionLabels: { ...m.regionLabels },
    baseDate: firstWeekOfMonth(wd, m.baseDate) ?? w.baseDate,
    fromDate: firstWeekOfMonth(wd, m.fromDate) ?? w.fromDate,
    toDate: lastWeekOfMonth(wd, m.toDate) ?? w.toDate,
  });
  applying = false;
  void w.loadWeeklyData();
  void w.loadTradeData();
}

// 연동 토글 ON: 현재 보는 화면을 기준으로 반대쪽을 맞춘다.
// 선택 지역이 서로 달랐다면 안내 문구를 남긴다.
export function syncFromActiveMode(activeMode: Mode): void {
  const wRegions = useAppStore.getState().selectedRegions;
  const mRegions = useMonthlyStore.getState().selectedRegions;
  const differed = !sameRegions(wRegions, mRegions);

  if (activeMode === 'weekly') applyWeeklyToMonthly();
  else applyMonthlyToWeekly();

  if (differed) {
    const src = activeMode === 'weekly' ? '주간' : '월간';
    const dst = activeMode === 'weekly' ? '월간' : '주간';
    useRegionSync.getState().setNotice(
      `주간·월간 선택이 달라 현재 화면(${src}) 기준으로 ${dst}을 맞췄습니다.`,
    );
  } else {
    useRegionSync.getState().setNotice(null);
  }
}

// 앱 시작 시 1회 구독 설정. 연동 중 한쪽 변경을 반대쪽으로 반영.
let initialized = false;
export function initRegionSync(): void {
  if (initialized) return;
  initialized = true;

  let prevW = snapshot(useAppStore.getState());
  let prevM = snapshot(useMonthlyStore.getState());

  useAppStore.subscribe(state => {
    const next = snapshot(state);
    const changed = next !== prevW;
    prevW = next;
    if (changed && !applying && useRegionSync.getState().linked) applyWeeklyToMonthly();
  });

  useMonthlyStore.subscribe(state => {
    const next = snapshot(state);
    const changed = next !== prevM;
    prevM = next;
    if (changed && !applying && useRegionSync.getState().linked) applyMonthlyToWeekly();
  });
}

// 감시 대상 필드만 직렬화해 변경 여부 비교.
function snapshot(s: {
  selectedRegions: string[];
  baseDate: string;
  fromDate: string;
  toDate: string;
}): string {
  return `${s.selectedRegions.join('|')}#${s.baseDate}#${s.fromDate}#${s.toDate}`;
}
