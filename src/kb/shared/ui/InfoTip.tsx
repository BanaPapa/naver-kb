import React from 'react';

interface InfoTipProps {
  text: string;
  // 툴팁 정렬: 아이콘 기준 좌/우 (오른쪽 끝 요소는 'right'로 잘림 방지)
  align?: 'left' | 'right';
  className?: string;
}

// ⓘ 아이콘에 마우스를 올리면 설명을 보여주는 간단한 툴팁.
export const InfoTip: React.FC<InfoTipProps> = ({ text, align = 'left', className }) => (
  <span className={`group relative inline-flex align-middle ${className ?? ''}`}>
    <span className="flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-gray-300 text-[9px] font-bold text-gray-400 hover:border-gray-500 hover:text-gray-600">
      i
    </span>
    <span
      className={`pointer-events-none invisible absolute top-5 z-50 w-60 whitespace-pre-line rounded-lg border border-gray-200 bg-white p-2.5 text-left text-[11px] font-normal leading-relaxed text-gray-600 shadow-lg group-hover:visible ${
        align === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      {text}
    </span>
  </span>
);
