import React, { useEffect, useRef, useState } from 'react';
import {
  CHART_TYPE_OPTIONS,
  BAR_SIZE_OPTIONS,
  BAR_OPACITY_OPTIONS,
  hasBarSeries,
  seriesChartType,
  type ChartOptions,
  type ChartType,
} from '../../shared/config';

interface ChartOptionsControlProps {
  options: ChartOptions;
  regions: string[];
  regionLabels: Record<string, string>;
  onChange: (patch: Partial<ChartOptions>) => void;
}

const selectClass =
  'rounded border border-gray-200 bg-white px-1 py-0.5 text-[10px] text-gray-600 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400';

// 그래프 제목 우측의 차트 옵션 팝오버.
//   - 전체 형태(모든 시리즈 일괄) + 지역별 개별 형태(혼합차트)
//   - 막대 시리즈가 있으면 투명도·두께 옵션 노출
export const ChartOptionsControl: React.FC<ChartOptionsControlProps> = ({
  options,
  regions,
  regionLabels,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 패널 바깥 클릭/ESC 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // 혼합 여부(지역별 형태가 갈리면 '혼합'으로 요약 표시)
  const mixed = regions.some(r => seriesChartType(options, r) !== options.type);
  const showBarOptions = hasBarSeries(options, regions);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="차트 옵션"
        className={`${selectClass} flex items-center gap-1 ${open ? 'ring-1 ring-blue-400' : ''}`}
      >
        <span>차트</span>
        <span className="text-gray-400">
          {mixed ? '혼합' : (CHART_TYPE_OPTIONS.find(o => o.value === options.type)?.label ?? '선')}
        </span>
        <span className="text-[8px] text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-gray-200 bg-white p-2.5 text-[11px] text-gray-600 shadow-lg">
          {/* 전체 형태 — 모든 시리즈를 일괄 변경(개별 override 초기화) */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-gray-700">전체 형태</span>
            <select
              value={options.type}
              onChange={e => onChange({ type: e.target.value as ChartType, seriesType: {} })}
              className={selectClass}
            >
              {CHART_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* 지역별 개별 형태(혼합차트) */}
          {regions.length > 0 && (
            <div className="mb-1 border-t border-gray-100 pt-2">
              <div className="mb-1 text-[10px] text-gray-400">지역별 형태 (혼합)</div>
              <div className="flex flex-col gap-1">
                {regions.map(region => (
                  <div key={region} className="flex items-center justify-between gap-2">
                    <span className="truncate text-gray-600">{regionLabels[region] ?? region}</span>
                    <select
                      value={seriesChartType(options, region)}
                      onChange={e =>
                        onChange({
                          seriesType: { ...options.seriesType, [region]: e.target.value as ChartType },
                        })
                      }
                      className={selectClass}
                    >
                      {CHART_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 막대 전용 옵션 — 막대 시리즈가 있을 때만 */}
          {showBarOptions && (
            <div className="mt-2 border-t border-gray-100 pt-2">
              <div className="mb-1 text-[10px] text-gray-400">막대 옵션</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">투명도</span>
                <select
                  value={options.barOpacity}
                  onChange={e => onChange({ barOpacity: Number(e.target.value) })}
                  className={selectClass}
                >
                  {BAR_OPACITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-gray-600">두께</span>
                <select
                  value={options.barSize ?? ''}
                  onChange={e =>
                    onChange({ barSize: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  className={selectClass}
                >
                  {BAR_SIZE_OPTIONS.map(o => (
                    <option key={o.label} value={o.value ?? ''}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
