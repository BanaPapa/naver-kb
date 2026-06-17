import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LogPanel({ logs, onClear, collapsed, onToggleCollapse }: LogPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current && !collapsed) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, collapsed]);

  const levelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'log-info';
      case 'warn': return 'log-warn';
      case 'error': return 'log-error';
      case 'success': return 'log-success';
    }
  };

  const levelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return '●';
      case 'warn': return '▲';
      case 'error': return '✕';
      case 'success': return '✓';
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('ko-KR', { hour12: false });
    } catch {
      return '';
    }
  };

  return (
    <div className={`eos-card log-panel${collapsed ? ' collapsed' : ''}`}>
      <div className="log-head">
        <button className="lh-title" onClick={onToggleCollapse}>
          <svg className="caret" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6" />
          </svg>
          로그
        </button>
        <span className="lh-count">{logs.length > 0 ? `${logs.length}건` : ''}</span>
        <div className="lh-r">
          <button className="btn-ghost btn-sm" onClick={onClear} disabled={logs.length === 0}>
            지우기
          </button>
        </div>
      </div>

      <div className="log-body" ref={bodyRef}>
        {logs.length === 0 ? (
          <div className="log-empty">로그가 없습니다</div>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className={`log-entry ${levelClass(entry.level)}`}>
              <span className="log-time">{formatTime(entry.time)}</span>
              <span className="log-icon">{levelIcon(entry.level)}</span>
              <span className="log-msg">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
