import { useSlotStore } from '../../chart-slots';
import type { SlotEntry } from '../../chart-slots';

interface SlotPickerListProps {
  selectedIndex: number | null;
  onSelect: (entry: SlotEntry, index: number) => void;
}

// 슬롯에 담긴 모드 배지.
function contentBadge(entry: SlotEntry): string {
  if (entry.weekly && entry.monthly) return '주간 · 월간';
  if (entry.weekly) return '주간';
  return '월간';
}

// 대표 이름(주간 우선, 없으면 월간).
function entryName(entry: SlotEntry): string {
  return entry.weekly?.name ?? entry.monthly?.name ?? '(빈 슬롯)';
}

// 모드별 지역 수 요약.
function countsText(entry: SlotEntry): string {
  const parts: string[] = [];
  if (entry.weekly) parts.push(`주간 ${entry.weekly.selectedRegions.length}개`);
  if (entry.monthly) parts.push(`월간 ${entry.monthly.selectedRegions.length}개`);
  return parts.join(' · ');
}

// 저장된 슬롯 목록(통합, 1행 1슬롯) — 선택 시 그 슬롯 데이터로 바로 분석한다.
export function SlotPickerList({ selectedIndex, onSelect }: SlotPickerListProps) {
  const slots = useSlotStore(s => s.slots);
  const filled = slots
    .map((entry, index) => ({ entry, index }))
    .filter((x): x is { entry: SlotEntry; index: number } => x.entry !== null);

  if (filled.length === 0) {
    return (
      <p className="py-8 text-center text-base text-gray-400">
        저장된 슬롯이 없습니다. 상단의 <span className="font-semibold">저장</span> 버튼으로 먼저 슬롯을 만드세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-base text-gray-500">
        저장된 슬롯을 선택하면 그 슬롯에 담긴 데이터(주간·월간 포함)를 기반으로 분석합니다.
      </p>
      <ul className="space-y-1.5">
        {filled.map(({ entry, index }) => {
          const active = selectedIndex === index;
          return (
            <li key={index}>
              <button
                onClick={() => onSelect(entry, index)}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded bg-gray-100 text-sm font-semibold text-gray-500">
                  {index + 1}
                </span>
                <span className="flex-none rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                  {contentBadge(entry)}
                </span>
                <span className="min-w-0 flex-1 truncate text-base text-gray-800">{entryName(entry)}</span>
                <span className="flex-none text-sm text-gray-400">{countsText(entry)}</span>
                {active && (
                  <span className="flex-none text-sm font-bold text-blue-600">선택됨 ✓</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
