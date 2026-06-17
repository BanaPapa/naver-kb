import React from 'react';

interface ConfirmModalProps {
  message: string;       // 줄바꿈(\n)은 그대로 렌더 (CSS white-space: pre-line)
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// 진행/취소를 묻는 경고용 모달. (정보 안내용 InfoModal과 달리 두 개의 선택지를 제공)
export function ConfirmModal({
  message,
  confirmLabel = '진행',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <p className="confirm-msg">{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="confirm-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
