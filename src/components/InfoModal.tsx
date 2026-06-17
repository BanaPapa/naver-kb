import React from 'react';

interface InfoModalProps {
  message: string;
  onClose: () => void;
}

export function InfoModal({ message, onClose }: InfoModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="info-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <p className="info-msg">{message}</p>
        <button className="eos-run-btn info-btn" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
