import React, { useEffect, useRef, useState } from 'react';
import type { InquiryMessage } from '../../services/inquiriesRepo';

interface InquiryModalProps {
  thread: InquiryMessage[];
  prefillContext?: Record<string, unknown> | null;
  onSend: (body: string, context?: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

const MAX_LEN = 2000;

export function InquiryModal({ thread, prefillContext, onSend, onClose }: InquiryModalProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [thread]);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSend(body, prefillContext ?? undefined);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card inquiry-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cm-close" onClick={onClose} title="닫기">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <h3 className="iq-title">관리자에게 문의</h3>

        <div className="iq-thread" ref={bodyRef}>
          {thread.length === 0 ? (
            <div className="iq-empty">아직 주고받은 메시지가 없습니다. 문의 내용을 입력해 주세요.</div>
          ) : (
            thread.map((m) => (
              <div key={m.id} className={`iq-msg ${m.senderRole}`}>
                <div className="iq-bubble">{m.body}</div>
                <div className="iq-meta">
                  {m.senderRole === 'admin' ? '관리자' : '나'} · {new Date(m.createdAt).toLocaleString('ko-KR', { hour12: false })}
                </div>
              </div>
            ))
          )}
        </div>

        {prefillContext && (
          <div className="iq-context">첨부된 오류 정보가 함께 전송됩니다.</div>
        )}
        {error && <div className="auth-msg err">{error}</div>}

        <div className="iq-input">
          <textarea
            value={draft}
            maxLength={MAX_LEN}
            placeholder="문의 내용을 입력하세요…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(); }}
          />
          <button className="eos-run-btn iq-send" disabled={sending || !draft.trim()} onClick={submit}>
            {sending ? '전송 중…' : '보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
