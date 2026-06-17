import React, { useState, useMemo } from 'react';
import { Property, SearchMeta, TRADE_TYPE_LABELS, TRADE_TYPES, isExclusiveSpaceType } from '../types';
import {
  formatPriceByUnit, formatDirection, cleanBrokerageName, pyeongUnitPriceWon,
  exportExcel, exportJSON, buildExportBaseName, PriceUnit, AreaUnit,
} from '../services/api';

interface ResultTableProps {
  properties: Property[];
  realEstateType: string; // 검색한 상품 유형 (면적 표기 기준 판단용)
  areaUnit: AreaUnit;
  priceUnit: PriceUnit;
  meta: SearchMeta; // 내보내기 파일명(날짜·지역·면적·거래·건수) 구성용
}

type SortKey =
  | 'midName' | 'smallName' | 'tradeType' | 'complexName' | 'dongName' | 'floorInfo' | 'direction'
  | 'supplySpaceName' | 'supplySpace' | 'exclusiveSpace' | 'contractSpace' | 'dealPrice' | 'pyeongPrice';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE     = 50;
const PYEONG_TO_SQM = 3.30579;
const SQM_TO_PYEONG = 0.3025;

function fmtSqm(sqm: number): string {
  return sqm > 0 ? `${sqm}㎡` : '-';
}
function fmtPy(sqm: number): string {
  return sqm > 0 ? `${(sqm * SQM_TO_PYEONG).toFixed(2)}평` : '-';
}

interface AreaCol {
  label: string;
  sortK?: SortKey;
  render: (p: Property) => React.ReactNode;
}

// 선택 단위(평/㎡)만 표시. 두번째 면적은 오피스텔/사무실 등은 계약면적, 그 외는 공급면적.
function buildAreaCols(areaUnit: AreaUnit, useContract: boolean): AreaCol[] {
  const fmt = areaUnit === 'pyeong' ? fmtPy : fmtSqm;
  const u = areaUnit === 'pyeong' ? '평' : '㎡';
  const secondLabel = useContract ? '계약' : '공급';
  const secondValue = useContract
    ? (p: Property) => (p.contractSpace > 0 ? p.contractSpace : p.supplySpace)
    : (p: Property) => p.supplySpace;
  const secondSortK: SortKey = useContract ? 'contractSpace' : 'supplySpace';
  return [
    { label: `전용(${u})`, sortK: 'exclusiveSpace', render: (p) => fmt(p.exclusiveSpace) },
    { label: `${secondLabel}(${u})`, sortK: secondSortK, render: (p) => fmt(secondValue(p)) },
  ];
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="sort-icon">↕</span>;
  return <span className="sort-icon active">{dir === 'asc' ? '↑' : '↓'}</span>;
}

interface ThProps {
  label: string;
  sortK?: SortKey;
  curSortKey: SortKey;
  curSortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}
function Th({ label, sortK, curSortKey, curSortDir, onSort, className }: ThProps) {
  return (
    <th
      className={className}
      style={{ cursor: sortK ? 'pointer' : 'default', userSelect: 'none' }}
      onClick={sortK ? () => onSort(sortK) : undefined}
    >
      {label}
      {sortK && <SortIcon active={curSortKey === sortK} dir={curSortDir} />}
    </th>
  );
}

function priceSortValue(p: Property): number {
  if (p.tradeType === 'A1') return p.dealPrice;
  if (p.tradeType === 'B1' || p.tradeType === 'B2') return p.warrantyPrice;
  return 0;
}

function getSortValue(p: Property, key: SortKey, realEstateType: string): number | string {
  if (key === 'dealPrice') return priceSortValue(p);
  if (key === 'pyeongPrice') return pyeongUnitPriceWon(p, realEstateType);
  if (key === 'supplySpace') return p.supplySpace;
  if (key === 'exclusiveSpace') return p.exclusiveSpace;
  if (key === 'contractSpace') return p.contractSpace > 0 ? p.contractSpace : p.supplySpace;
  if (key === 'floorInfo') {
    const m = p.floorInfo.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  }
  const v = p[key as keyof Property];
  return (v as number | string) ?? '';
}

function PriceCell({
  p,
  showPriceUp,
}: {
  p: Property;
  showPriceUp: boolean;
}) {
  return (
    <>
      {showPriceUp && p.priceChangeStatus === 1  && <span className="price-up">↑</span>}
      {showPriceUp && p.priceChangeStatus === -1 && <span className="price-down">↓</span>}
    </>
  );
}

export function ResultTable({ properties, realEstateType, areaUnit, priceUnit, meta }: ResultTableProps) {
  const useContract = isExclusiveSpaceType(realEstateType);
  const [sortKey, setSortKey]               = useState<SortKey>('dealPrice');
  const [sortDir, setSortDir]               = useState<SortDir>('asc');
  const [filterText, setFilterText]         = useState('');
  const [complexFilter, setComplexFilter]   = useState('');
  const [tradeTypeFilter, setTradeTypeFilter] = useState('');
  const [spaceMin, setSpaceMin]             = useState(0);
  const [spaceMax, setSpaceMax]             = useState(0);
  const [page, setPage]                     = useState(0);

  const priceUnitLabel = priceUnit === 'thousand' ? '천원' : '만원';

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  // 수집된 전체 데이터 기준: 거래유형 / 오피스텔 여부
  const dataInfo = useMemo(() => ({
    hasA1: properties.some((p) => p.tradeType === 'A1'),
    hasB:  properties.some((p) => p.tradeType === 'B1' || p.tradeType === 'B2'),
    hasB2: properties.some((p) => p.tradeType === 'B2'),
  }), [properties]);

  const complexNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of properties) {
      if (p.complexName) set.add(p.complexName);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
  }, [properties]);

  const { filtered, paginated, totalPages, safePage } = useMemo(() => {
    let fil = [...properties];

    if (complexFilter)   fil = fil.filter((p) => p.complexName === complexFilter);
    if (tradeTypeFilter) fil = fil.filter((p) => p.tradeType   === tradeTypeFilter);

    if (spaceMin > 0 || spaceMax > 0) {
      const toSqm = (v: number) => areaUnit === 'pyeong' ? v * PYEONG_TO_SQM : v;
      const lo = spaceMin > 0 ? toSqm(spaceMin) : 0;
      const hi = spaceMax > 0 ? toSqm(spaceMax) : Number.POSITIVE_INFINITY;
      fil = fil.filter((p) => {
        if (p.supplySpace <= 0 && p.exclusiveSpace <= 0) return true;
        return (
          (p.supplySpace    > 0 && p.supplySpace    >= lo && p.supplySpace    <= hi) ||
          (p.exclusiveSpace > 0 && p.exclusiveSpace >= lo && p.exclusiveSpace <= hi)
        );
      });
    }

    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      fil = fil.filter(
        (p) =>
          p.complexName.toLowerCase().includes(q) ||
          p.dongName.toLowerCase().includes(q)    ||
          p.articleFeature.toLowerCase().includes(q),
      );
    }

    const sorted = [...fil].sort((a, b) => {
      const av = getSortValue(a, sortKey, realEstateType);
      const bv = getSortValue(b, sortKey, realEstateType);
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), 'ko');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const total = Math.ceil(sorted.length / PAGE_SIZE);
    const safe  = Math.min(page, Math.max(0, total - 1));
    const pag   = sorted.slice(safe * PAGE_SIZE, (safe + 1) * PAGE_SIZE);

    return { filtered: sorted, paginated: pag, totalPages: total, safePage: safe };
  }, [properties, complexFilter, tradeTypeFilter, spaceMin, spaceMax, areaUnit, filterText, sortKey, sortDir, page, realEstateType]);

  const hasActiveFilter = !!(complexFilter || tradeTypeFilter || filterText || spaceMin > 0 || spaceMax > 0);

  const areaCols = useMemo(
    () => buildAreaCols(areaUnit, useContract),
    [areaUnit, useContract],
  );

  // 매매가가 있으면 평당가 열 1개 추가
  const pyeongCol = dataInfo.hasA1 ? 1 : 0;
  const priceCols = (dataInfo.hasA1 ? 1 : 0) + pyeongCol + (dataInfo.hasB ? 1 : 0) + (dataInfo.hasB2 ? 1 : 0);
  // 고정 8열(중지역,소지역,거래,단지명,동,층,방향,타입) + 면적열 + 가격열 + 특징/중개업소 2열
  const totalCols = 8 + areaCols.length + priceCols + 2;

  return (
    <div className="result-table-container">
      <div className="result-toolbar">
        <div className="result-info">
          <span className="result-count">
            총 <strong>{properties.length.toLocaleString()}</strong>건
            {' · '}<strong>{complexNames.length.toLocaleString()}</strong>개 단지
            {hasActiveFilter && ` → 필터: ${filtered.length.toLocaleString()}건`}
          </span>
        </div>

        <div className="result-actions">
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '140px' }}
            value={complexFilter}
            onChange={(e) => { setComplexFilter(e.target.value); setPage(0); }}
          >
            <option value="">전체 단지</option>
            {complexNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: '100px' }}
            value={tradeTypeFilter}
            onChange={(e) => { setTradeTypeFilter(e.target.value); setPage(0); }}
          >
            <option value="">전체 거래</option>
            {TRADE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="result-space-filter">
            <input
              type="number"
              className="search-input"
              style={{ width: '70px' }}
              placeholder="최소"
              min={0}
              value={spaceMin || ''}
              onChange={(e) => { setSpaceMin(Number(e.target.value) || 0); setPage(0); }}
            />
            <span className="space-tilde">~</span>
            <input
              type="number"
              className="search-input"
              style={{ width: '70px' }}
              placeholder="최대"
              min={0}
              value={spaceMax || ''}
              onChange={(e) => { setSpaceMax(Number(e.target.value) || 0); setPage(0); }}
            />
            <span className="space-unit-hint" title="면적 표시 단위는 검색 조건에서 변경">
              {areaUnit === 'pyeong' ? '평' : '㎡'}
            </span>
          </div>

          <input
            className="search-input"
            type="text"
            placeholder="단지명/특징 검색..."
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(0); }}
          />

          <button
            className="btn-outline btn-sm"
            onClick={() => void exportExcel(filtered, priceUnit, areaUnit, realEstateType, buildExportBaseName(meta, filtered.length))}
            disabled={filtered.length === 0}
          >
            Excel 내보내기
          </button>
          <button
            className="btn-outline btn-sm"
            onClick={() => exportJSON(filtered, buildExportBaseName(meta, filtered.length))}
            disabled={filtered.length === 0}
          >
            JSON 내보내기
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="result-table">
          <thead>
            <tr>
              <Th label="중지역"     sortK="midName"         curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} className="th-region" />
              <Th label="소지역"     sortK="smallName"       curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} className="th-region" />
              <Th label="거래"       sortK="tradeType"       curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              <Th label="단지명"     sortK="complexName"     curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              <Th label="동"         sortK="dongName"        curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              <Th label="층"         sortK="floorInfo"       curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              <Th label="방향"       sortK="direction"       curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              <Th label="타입"       sortK="supplySpaceName" curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              {areaCols.map((col) =>
                col.sortK ? (
                  <Th
                    key={col.label}
                    label={col.label}
                    sortK={col.sortK}
                    curSortKey={sortKey}
                    curSortDir={sortDir}
                    onSort={handleSort}
                  />
                ) : (
                  <th key={col.label} style={{ userSelect: 'none' }}>{col.label}</th>
                ),
              )}
              {dataInfo.hasA1 && (
                <Th label={`매매가(${priceUnitLabel})`} sortK="dealPrice" curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              )}
              {dataInfo.hasA1 && (
                <Th label={`평당가(${priceUnitLabel})`} sortK="pyeongPrice" curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              )}
              {dataInfo.hasB && (
                <Th label={`보증금(${priceUnitLabel})`} sortK="dealPrice" curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              )}
              {dataInfo.hasB2 && (
                <Th label={`월세(${priceUnitLabel})`} curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              )}
              <Th label="특징"     curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
              <Th label="중개업소" curSortKey={sortKey} curSortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="table-empty">
                  {properties.length === 0 ? '수집된 매물이 없습니다' : '검색 결과가 없습니다'}
                </td>
              </tr>
            ) : (
              paginated.map((p, idx) => {
                return (
                  <tr key={`${idx}-${p.articleNumber}`}>
                    <td className="td-region">{p.midName || '-'}</td>
                    <td className="td-region">{p.smallName || '-'}</td>
                    <td>
                      <span className={`trade-badge trade-${p.tradeType}`}>
                        {TRADE_TYPE_LABELS[p.tradeType] ?? p.tradeType}
                      </span>
                    </td>
                    <td className="td-complex">
                      <span className="complex-name">{p.complexName}</span>
                      {p.realtorCount > 1 && (
                        <span className="realtor-badge">+{p.realtorCount - 1}</span>
                      )}
                    </td>
                    <td>{p.dongName || '-'}</td>
                    <td>{p.floorInfo || '-'}</td>
                    <td>{formatDirection(p.direction) || '-'}</td>
                    <td>{p.supplySpaceName || '-'}</td>
                    {areaCols.map((col) => (
                      <td key={col.label} className="td-space">{col.render(p)}</td>
                    ))}

                    {dataInfo.hasA1 && (
                      <td className="td-price">
                        <div className="td-price-inner">
                          {p.tradeType === 'A1' ? (
                            <>
                              <span className="price-value">{formatPriceByUnit(p.dealPrice, priceUnit)}</span>
                              <PriceCell p={p} showPriceUp={true} />
                            </>
                          ) : (
                            <span className="td-empty">-</span>
                          )}
                        </div>
                      </td>
                    )}

                    {dataInfo.hasA1 && (
                      <td className="td-pyeong">
                        {p.tradeType === 'A1'
                          ? formatPriceByUnit(pyeongUnitPriceWon(p, realEstateType), priceUnit)
                          : '-'}
                      </td>
                    )}

                    {dataInfo.hasB && (
                      <td className="td-price">
                        <div className="td-price-inner">
                          {(p.tradeType === 'B1' || p.tradeType === 'B2') ? (
                            <>
                              <span className="price-value">{formatPriceByUnit(p.warrantyPrice, priceUnit)}</span>
                              <PriceCell p={p} showPriceUp={p.tradeType === 'B1'} />
                            </>
                          ) : (
                            <span className="td-empty">-</span>
                          )}
                        </div>
                      </td>
                    )}

                    {dataInfo.hasB2 && (
                      <td className="td-price">
                        <div className="td-price-inner">
                          {p.tradeType === 'B2' ? (
                            <span className="price-value">
                              {formatPriceByUnit(p.rentPrice, priceUnit)}
                            </span>
                          ) : (
                            <span className="td-empty">-</span>
                          )}
                        </div>
                      </td>
                    )}

                    <td className="td-feature">{p.articleFeature || '-'}</td>
                    <td>{cleanBrokerageName(p.brokerageName) || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn-ghost btn-sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            ← 이전
          </button>
          <span className="page-info">{safePage + 1} / {totalPages}</span>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  );
}
