import React, { useState } from 'react';
import { SavedSlot, REAL_ESTATE_TYPES, TRADE_TYPE_LABELS } from '../types';
import { exportSlotsExcel, PriceUnit, AreaUnit } from '../services/api';
import { MAX_SLOTS, SlotArray } from '../hooks/useSlots';

interface SlotModalProps {
  slots: SlotArray;
  priceUnit: PriceUnit;
  areaUnit: AreaUnit;
  canSave: boolean; // 현재 화면에 저장/덮어쓸 결과가 있는지
  onSaveAt: (index: number) => void;
  onLoad: (slot: SavedSlot) => void;
  onReSearch: (slot: SavedSlot) => void;
  onDelete: (index: number) => void;
  onClose: () => void;
}

const PAGE_SIZE = 10;

function productLabel(code: string): string {
  return REAL_ESTATE_TYPES.find((t) => t.value === code)?.label ?? code;
}

function regionText(slot: SavedSlot): string {
  const { largeName, midName, smallName } = slot.meta;
  return [largeName, midName, smallName].filter(Boolean).join(' › ') || '-';
}

function complexCount(slot: SavedSlot): number {
  const set = new Set<string>();
  for (const p of slot.properties) {
    if (p.complexName) set.add(p.complexName);
  }
  return set.size;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SlotModal({
  slots, priceUnit, areaUnit, canSave, onSaveAt, onLoad, onReSearch, onDelete, onClose,
}: SlotModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const occupied = slots.filter((s): s is SavedSlot => s !== null);
  const totalPages = Math.max(1, Math.ceil(MAX_SLOTS / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const startIdx = safePage * PAGE_SIZE;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = occupied.length > 0 && selected.size === occupied.length;
  const selectAll = () => setSelected(new Set(occupied.map((s) => s.id)));
  const clearAll = () => setSelected(new Set());

  const selectedSlots = occupied.filter((s) => selected.has(s.id));
  const selectedCount = selectedSlots.reduce((sum, s) => sum + s.count, 0);

  const handleExport = () => {
    if (selectedSlots.length === 0) return;
    void exportSlotsExcel(selectedSlots, priceUnit, areaUnit);
  };

  // 닫기는 X 버튼으로만 (오버레이 클릭 무시)
  return (
    <div className="modal-overlay">
      <div className="modal-card slot-modal">
        <button className="cm-close" onClick={onClose} title="닫기">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div className="slot-head">
          <h2 className="slot-title">저장 슬롯</h2>
          <span className="slot-frac">{occupied.length} / {MAX_SLOTS}</span>
        </div>

        <div className="slot-toolbar">
          <button
            className="btn-outline btn-sm"
            onClick={allSelected ? clearAll : selectAll}
            disabled={occupied.length === 0}
          >
            {allSelected ? '전체 해제' : '전체 선택'}
          </button>
          <span className="slot-sel-info">
            {selected.size > 0 ? `${selected.size}개 선택 · ${selectedCount.toLocaleString()}건` : '선택 없음'}
          </span>
          <button
            className="btn-primary btn-sm slot-export-btn"
            onClick={handleExport}
            disabled={selected.size === 0}
          >
            선택 Excel 내보내기
          </button>
        </div>

        <div className="slot-list">
          {Array.from({ length: PAGE_SIZE }, (_, k) => {
            const index = startIdx + k;
            if (index >= MAX_SLOTS) return null;
            const slot = slots[index];
            const num = index + 1;

            if (!slot) {
              return (
                <div key={index} className="slot-row empty">
                  <span className="slot-num">{num}</span>
                  <div className="slot-info">
                    <span className="slot-empty-label">(빈 슬롯)</span>
                  </div>
                  <button
                    className="btn-outline btn-sm slot-act"
                    onClick={() => onSaveAt(index)}
                    disabled={!canSave}
                    title={canSave ? '현재 결과를 이 슬롯에 저장' : '저장할 결과가 없습니다'}
                  >
                    현재 저장
                  </button>
                </div>
              );
            }

            const on = selected.has(slot.id);
            return (
              <div key={index} className={`slot-row${on ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  className="slot-check"
                  checked={on}
                  onChange={() => toggle(slot.id)}
                />
                <span className="slot-num">{num}</span>
                <div className="slot-info" onClick={() => toggle(slot.id)}>
                  <span className="slot-region">{regionText(slot)}</span>
                  <span className="slot-tag">{productLabel(slot.meta.realEstateType)}</span>
                  <span className="slot-tag">{TRADE_TYPE_LABELS[slot.meta.tradeType] ?? slot.meta.tradeType}</span>
                  <span className="slot-tag">{slot.meta.areaLabel || '전체'}</span>
                  <span className="slot-date">{formatDate(slot.createdAt)}</span>
                </div>
                <div className="slot-count">
                  <b>{slot.count.toLocaleString()}</b><span>건</span>
                  <span className="slot-count-cx">{complexCount(slot).toLocaleString()}단지</span>
                </div>
                <div className="slot-actions">
                  <button className="btn-primary btn-sm slot-act" onClick={() => onLoad(slot)}>불러오기</button>
                  <button className="btn-outline btn-sm slot-act" onClick={() => onReSearch(slot)}>재검색</button>
                  <button
                    className="btn-outline btn-sm slot-act"
                    onClick={() => onSaveAt(index)}
                    disabled={!canSave}
                    title={canSave ? '현재 결과로 덮어쓰기' : '저장할 결과가 없습니다'}
                  >
                    덮어쓰기
                  </button>
                  <button className="slot-del" title="삭제" onClick={() => onDelete(index)}>
                    <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="pagination slot-pagination">
            <button
              className="btn-ghost btn-sm"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
            >
              ← 이전
            </button>
            <span className="page-info">{safePage + 1} / {totalPages}</span>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
            >
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
