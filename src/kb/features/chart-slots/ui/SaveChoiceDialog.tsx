import { useAppStore } from '../../../shared/lib/store';
import { ModalPortal } from '../../../shared/ui/ModalPortal';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { summarizeRegions } from '../lib/name';
import type { SlotMode } from '../model/types';

export type SaveChoice = 'weekly' | 'monthly' | 'both';

interface SaveChoiceDialogProps {
  slotIndex: number;
  // 저장을 시작한 모드(현재 보고 있던 화면) — 강조 표시용.
  originMode: SlotMode;
  onChoose: (choice: SaveChoice) => void;
  onCancel: () => void;
}

function regionList(regions: string[], labels: Record<string, string>): string[] {
  if (regions.length === 0) return ['(선택 없음)'];
  return regions.map(r => labels[r] ?? r);
}

// 저장 시 현재 주간·월간 선택 상태를 보여주고, 둘 다 / 한쪽만 저장을 고르게 하는 다이얼로그.
export function SaveChoiceDialog({ slotIndex, originMode, onChoose, onCancel }: SaveChoiceDialogProps) {
  const weekly = useAppStore();
  const monthly = useMonthlyStore();

  const sides = [
    {
      mode: 'weekly' as SlotMode,
      label: '주간',
      regions: regionList(weekly.selectedRegions, weekly.regionLabels),
      count: weekly.selectedRegions.length,
      from: weekly.fromDate,
      to: weekly.toDate,
      baseDate: weekly.baseDate,
    },
    {
      mode: 'monthly' as SlotMode,
      label: '월간',
      regions: regionList(monthly.selectedRegions, monthly.regionLabels),
      count: monthly.selectedRegions.length,
      from: monthly.fromDate,
      to: monthly.toDate,
      baseDate: monthly.baseDate,
    },
  ];

  const mismatch =
    summarizeRegions(weekly.selectedRegions, weekly.regionLabels) !==
    summarizeRegions(monthly.selectedRegions, monthly.regionLabels);

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        style={{ width: 'min(96vw, 1014px)', height: 'min(82vh, 595px)' }}
        className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
        onMouseDown={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-gray-900">
          슬롯 {slotIndex + 1}에 저장
        </h3>
        <p className="mt-1 text-base text-gray-500">
          현재 주간·월간 설정입니다. 저장할 범위의 <b>저장하기</b> 버튼을 누르세요.
        </p>

        {/* 3개 메뉴 카드 — 각 카드 안에 저장하기 버튼(파랑) */}
        <div className="mt-5 grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          {sides.map(side => (
            <div
              key={side.mode}
              className={`flex flex-col rounded-lg border p-4 ${
                side.mode === originMode ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-800 px-2 py-0.5 text-sm font-semibold text-white">
                  {side.label}
                </span>
                <span className="text-sm text-gray-400">{side.count}개 지역</span>
              </div>
              <ul className="mt-2 flex-1 space-y-0.5 overflow-auto text-base font-medium text-gray-800">
                {side.regions.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-2 h-1 w-1 flex-none rounded-full bg-gray-400" />
                    <span className="min-w-0 break-words">{r}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-sm text-gray-500">
                기간 {side.from || '?'} ~ {side.to || '?'}
                {side.baseDate ? ` · 기준 ${side.baseDate}` : ''}
              </p>
              <button
                onClick={() => onChoose(side.mode)}
                className="mt-3 rounded-lg bg-blue-600 px-3 py-2.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                저장하기
              </button>
            </div>
          ))}

          {/* 모두 저장 카드 */}
          <div className="flex flex-col rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2">
              <span className="rounded bg-gray-800 px-2 py-0.5 text-sm font-semibold text-white">
                주간 · 월간
              </span>
              <span className="text-sm text-gray-400">함께</span>
            </div>
            <p className="mt-2 flex-1 text-base font-medium text-gray-800">두 화면 설정을 모두 저장</p>
            <p className="mt-1 text-sm text-gray-500">주간·월간 각 화면 상태를 한 슬롯에 함께 보관합니다.</p>
            <button
              onClick={() => onChoose('both')}
              className="mt-3 rounded-lg bg-blue-600 px-3 py-2.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              저장하기
            </button>
          </div>
        </div>

        {mismatch && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            ⚠ 주간과 월간의 선택 지역이 다릅니다. ‘주간 · 월간’ 저장 시 각 화면 상태가 그대로 저장됩니다.
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-base font-semibold text-gray-500 hover:bg-gray-100"
          >
            취소
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
