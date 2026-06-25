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
      <button onClick={() => setOpen(true)} className="eos-btn-ghost">
        저장
      </button>
      {open && <SlotModal mode={mode} onClose={() => setOpen(false)} />}
    </>
  );
}
