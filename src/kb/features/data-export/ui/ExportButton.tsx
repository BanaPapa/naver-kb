import { useState } from 'react';
import { ExportModal } from './ExportModal';

// 메인 헤더의 데이터 내보내기 버튼. 누르면 형식·모드 선택 모달을 띄운다.
export function ExportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-base font-semibold text-gray-700 hover:bg-gray-100"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        내보내기
      </button>
      {open && <ExportModal onClose={() => setOpen(false)} />}
    </>
  );
}
