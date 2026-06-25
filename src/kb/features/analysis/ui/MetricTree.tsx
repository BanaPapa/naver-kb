import { useState } from 'react';
import type { AnalysisTab } from '../../../entities/analysis';

interface TreeGroup {
  mode: 'weekly' | 'monthly';
  label: string;
  children: { tab: AnalysisTab; label: string }[];
}

// 트리 구조 정의 — 주간(시세·거래) / 월간(시세·거래·시장).
const GROUPS: TreeGroup[] = [
  {
    mode: 'weekly',
    label: '주간',
    children: [
      { tab: 'weekly-price', label: '시세지표' },
      { tab: 'weekly-trade', label: '거래지표' },
    ],
  },
  {
    mode: 'monthly',
    label: '월간',
    children: [
      { tab: 'monthly-price', label: '시세지표' },
      { tab: 'monthly-trade', label: '거래지표' },
      { tab: 'monthly-market', label: '시장지표' },
    ],
  },
];

export const ALL_TREE_TABS: AnalysisTab[] = GROUPS.flatMap(g => g.children.map(c => c.tab));

interface MetricTreeProps {
  selected: Set<AnalysisTab>;
  onChange: (next: Set<AnalysisTab>) => void;
}

export function MetricTree({ selected, onChange }: MetricTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = (mode: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return next;
    });

  const toggleTab = (tab: AnalysisTab) => {
    const next = new Set(selected);
    if (next.has(tab)) next.delete(tab);
    else next.add(tab);
    onChange(next);
  };

  const toggleGroup = (group: TreeGroup, allOn: boolean) => {
    const next = new Set(selected);
    for (const c of group.children) {
      if (allOn) next.delete(c.tab);
      else next.add(c.tab);
    }
    onChange(next);
  };

  const selectAll = () => onChange(new Set(ALL_TREE_TABS));
  const clearAll = () => onChange(new Set());

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-base font-semibold text-gray-700">분석할 지표</p>
        <div className="flex items-center gap-1">
          <button
            onClick={selectAll}
            className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            전체 선택
          </button>
          <button
            onClick={clearAll}
            className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            전체 해제
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
        {GROUPS.map(group => {
          const checkedCount = group.children.filter(c => selected.has(c.tab)).length;
          const allOn = checkedCount === group.children.length;
          const someOn = checkedCount > 0 && !allOn;
          const isCollapsed = collapsed.has(group.mode);
          return (
            <div key={group.mode}>
              {/* 그룹 행 */}
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => toggleCollapse(group.mode)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={isCollapsed ? '펼치기' : '접기'}
                >
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <input
                  type="checkbox"
                  checked={allOn}
                  ref={el => {
                    if (el) el.indeterminate = someOn;
                  }}
                  onChange={() => toggleGroup(group, allOn)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-base font-semibold text-gray-800">{group.label}</span>
                <span className="ml-1 text-sm text-gray-400">
                  ({checkedCount}/{group.children.length})
                </span>
              </div>

              {/* 자식 행 */}
              {!isCollapsed && (
                <div className="pb-1.5">
                  {group.children.map(child => (
                    <label
                      key={child.tab}
                      className="flex cursor-pointer items-center gap-2 py-2 pl-10 pr-3 text-base hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(child.tab)}
                        onChange={() => toggleTab(child.tab)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-gray-700">{child.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
