import React from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useSavedStore } from '../model/saved-store';
import type { SavedAnalysis } from '../model/saved.types';
import { formatUsage } from '../lib/saved';

interface SavedAnalysisListProps {
  onBack: () => void;
  onOpen: (item: SavedAnalysis) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const SavedAnalysisList: React.FC<SavedAnalysisListProps> = ({ onBack, onOpen }) => {
  const items = useSavedStore(s => s.items);
  const remove = useSavedStore(s => s.remove);

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> 돌아가기
      </button>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
          저장된 분석이 없습니다. 분석 결과 화면에서 “결과 저장”을 눌러보세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {items.map(item => {
            const usage = formatUsage(item.usage);
            return (
              <li key={item.id} className="flex items-start gap-2 p-3">
                <button onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-medium text-gray-900">{item.name}</p>
                  <p className="truncate text-xs text-gray-500">{item.scopeLabel}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {formatDate(item.createdAt)} · {item.model}{usage ? ` · ${usage}` : ''}
                  </p>
                </button>
                <button
                  aria-label={`${item.name} 삭제`}
                  onClick={() => remove(item.id)}
                  className="flex-none rounded border border-red-200 p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
