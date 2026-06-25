import type { FC } from 'react';
import { useKbUpdateStore } from '../../../shared/lib/kb-source/progress-store';
import { DATASET_LABEL, type KbDatasetKey } from '../../../shared/lib/kb-source/config';
import { ModalPortal } from '../../../shared/ui/ModalPortal';

// KB 데이터 업데이트 모달.
// Supabase 데이터 소스에서 버전이 바뀐 번들을 새로 받을 때만 표시된다.
// (정적 소스이거나 캐시가 최신이면 다운로드가 없어 모달은 뜨지 않는다.)

function fmtMB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

const DataUpdateModal: FC = () => {
  const { active, datasets } = useKbUpdateStore();
  const items = Object.values(datasets);

  if (!active && items.length === 0) return null;
  // 다운로드가 모두 끝나면(active=false) 모달을 닫는다.
  if (!active) return null;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--raise)] p-6 shadow-xl border border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--fg)]">최신 데이터로 업데이트 중</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          새 KB 시계열 데이터를 받고 있습니다. 잠시만 기다려 주세요.
        </p>

        <div className="mt-5 space-y-4">
          {items.map((d) => {
            const pct = d.total > 0 ? Math.min(100, Math.round((d.received / d.total) * 100)) : null;
            return (
              <div key={d.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--fg-2)]">{DATASET_LABEL[d.key as KbDatasetKey] ?? d.key}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {d.done ? '완료' : pct !== null ? `${pct}%` : fmtMB(d.received)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--teal)] transition-all duration-200"
                    style={{ width: d.done ? '100%' : pct !== null ? `${pct}%` : '40%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default DataUpdateModal;
