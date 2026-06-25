import { useState } from 'react';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { SlotModal } from './SlotModal';
import type { SlotMode } from '../model/types';

// 슬롯 버튼 하나 — 누르면 화면 가운데 모달이 열리고, 저장/불러오기를 모두 거기서 처리한다.
export function SlotControls() {
  const mode = useMonthlyStore(s => s.mode) as SlotMode;
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-base font-semibold text-gray-700 hover:bg-gray-100"
      >
        저장
      </button>
      {open && <SlotModal mode={mode} onClose={() => setOpen(false)} />}
    </>
  );
}
