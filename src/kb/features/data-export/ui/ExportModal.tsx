import { useState } from 'react';
import { ModalPortal } from '../../../shared/ui/ModalPortal';
import { runExport, type ExportFormat, type ExportMode } from '../lib/build';

interface ExportModalProps {
  onClose: () => void;
}

const MODE_OPTIONS: { mode: ExportMode; label: string }[] = [
  { mode: 'weekly', label: '주간' },
  { mode: 'monthly', label: '월간' },
];

const FORMAT_OPTIONS: {
  format: ExportFormat;
  title: string;
  badge: string;
  desc: string;
  audience: string;
}[] = [
  {
    format: 'xlsx',
    title: 'Excel (.xlsx)',
    badge: '일반 사용자',
    desc: '지표별로 시트가 분리되어 저장됩니다. 직접 표·그래프로 분석하기에 가장 익숙한 형식입니다.',
    audience: '내가 직접 열어서 분석',
  },
  {
    format: 'json',
    title: 'JSON (.json)',
    badge: 'AI 에이전트',
    desc: '화면에 표시된 모든 시계열이 구조화된 데이터로 담깁니다. 부동산 시장이 학습된 에이전트에 그대로 전달하면 정밀 분석이 가능합니다.',
    audience: '에이전트에게 전달 — 기계가 읽기 좋은 형식',
  },
  {
    format: 'md',
    title: 'Markdown (.md)',
    badge: 'AI 에이전트',
    desc: '지표 요약표 + 원본 데이터(JSON)가 함께 담깁니다. 사람이 읽기도 좋고, 에이전트에 붙여넣어 바로 대화하며 분석시키기에 좋습니다.',
    audience: '에이전트와 대화하며 분석 — 사람도 읽기 좋은 형식',
  },
];

export function ExportModal({ onClose }: ExportModalProps) {
  const [modes, setModes] = useState<ExportMode[]>(['weekly']);
  const [format, setFormat] = useState<ExportFormat>('xlsx');

  const toggleMode = (m: ExportMode) =>
    setModes(prev => (prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]));

  const canExport = modes.length > 0;

  const handleExport = () => {
    if (!canExport) return;
    runExport(modes, format);
    onClose();
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h2 className="text-lg font-bold text-gray-900">데이터 내보내기</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {/* 모드 선택 */}
          <section>
            <p className="text-base font-semibold text-gray-700">내보낼 데이터</p>
            <div className="mt-2 flex gap-2">
              {MODE_OPTIONS.map(opt => {
                const on = modes.includes(opt.mode);
                return (
                  <button
                    key={opt.mode}
                    onClick={() => toggleMode(opt.mode)}
                    className={`flex-1 rounded-lg border px-4 py-3 text-base font-semibold transition-colors ${
                      on
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {on ? '✓ ' : ''}
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-sm text-gray-400">
              현재 화면에서 선택한 지역·기간 기준으로 내보냅니다. 주간·월간 모두 선택할 수 있습니다.
            </p>
          </section>

          {/* 형식 선택 */}
          <section className="mt-5">
            <p className="text-base font-semibold text-gray-700">파일 형식</p>
            <div className="mt-2 space-y-2">
              {FORMAT_OPTIONS.map(opt => {
                const on = format === opt.format;
                return (
                  <button
                    key={opt.format}
                    onClick={() => setFormat(opt.format)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      on ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 ${
                        on ? 'border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {on && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold text-gray-900">{opt.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-sm font-semibold ${
                            opt.badge === '일반 사용자'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-violet-100 text-violet-700'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-gray-500">{opt.desc}</span>
                      <span className="mt-1 block text-sm font-medium text-gray-400">→ {opt.audience}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 안내 */}
          <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
            <span className="font-semibold">활용 팁.</span> 직접 분석할 때는 <b>Excel</b>이 익숙합니다. 다만 부동산
            시장이 학습된 AI 에이전트에게는 <b>JSON</b>(기계가 읽기 좋음) 또는 <b>Markdown</b>(요약표+원본 동시
            포함)을 전달하면, 같은 데이터라도 훨씬 명확한 분석을 받을 수 있습니다.
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-base font-semibold text-gray-700 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className="rounded-lg bg-blue-600 px-4 py-2 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            내보내기
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
