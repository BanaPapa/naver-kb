import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../../shared/lib/store';
import { useMonthlyStore } from '../../../shared/lib/monthly-store';
import { CHART_COLORS } from '../../../shared/config';
import { AGGREGATE_REGIONS } from '../../../shared/config/kb-aggregates';
import { getRegions, peekRegions, prefetchRegions, type RegionItem } from '../../../shared/lib/kb-region-api';
import { buildMidOptions, type MidOption } from '../../../shared/lib/kb-mid-options';
import { monthlyLocal, type MonthlyRegionLookup } from '../../../entities/monthly-data';

export interface PickedRegion {
  key: string;
  label: string;
}

export const MAX_ANALYSIS_REGIONS = 5; // 분석 대상 지역 상한. 그래프 비교(5)와 동일.

interface AnalysisRegionPickerProps {
  value: PickedRegion[];
  onChange: (next: PickedRegion[]) => void;
}

// 모달 안 지역 선택 — 사이드바와 동일한 대지역→중지역 캐스케이드.
// 가용성은 주간(시세·거래) + 월간(시세·거래) 데이터 소스의 합집합으로 판정한다.
export function AnalysisRegionPicker({ value, onChange }: AnalysisRegionPickerProps) {
  const allRegions = useAppStore(s => s.allRegions);
  const allTradeRegions = useAppStore(s => s.allTradeRegions);
  const monthlyTradeRegions = useMonthlyStore(s => s.allTradeRegions);

  const [lookup, setLookup] = useState<MonthlyRegionLookup | null>(null);
  useEffect(() => {
    let active = true;
    monthlyLocal.getRegionLookup().then(l => active && setLookup(l)).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // 가용성: 어떤 데이터 소스에든 존재하면 추가 가능(빈 데이터셋은 수집 단계에서 제거됨).
  const weeklySet = useMemo(() => new Set([...allRegions, ...allTradeRegions]), [allRegions, allTradeRegions]);
  const monthlyTradeSet = useMemo(() => new Set(monthlyTradeRegions), [monthlyTradeRegions]);
  const isAvail = useMemo(
    () => (key: string) =>
      weeklySet.has(key) || monthlyTradeSet.has(key) || (!!lookup && lookup.resolve(key) !== undefined),
    [weeklySet, monthlyTradeSet, lookup],
  );

  // 대지역(시도) 목록
  const [sidoList, setSidoList] = useState<RegionItem[]>([]);
  const [largeValue, setLargeValue] = useState('');
  const [midOptions, setMidOptions] = useState<MidOption[]>([]);
  const [midKey, setMidKey] = useState('');
  const [loadingMid, setLoadingMid] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = peekRegions(1);
    if (cached) {
      setSidoList(cached);
      for (const s of cached) prefetchRegions(2, s.code);
      return;
    }
    getRegions(1)
      .then(list => {
        if (!active) return;
        setSidoList(list);
        for (const s of list) prefetchRegions(2, s.code);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const selectedSido = useMemo(() => {
    if (!largeValue.startsWith('sido:')) return null;
    const code = largeValue.slice(5);
    return sidoList.find(s => s.code === code) ?? null;
  }, [largeValue, sidoList]);

  const selectedAggregate = useMemo(() => {
    if (!largeValue.startsWith('agg:')) return null;
    const key = largeValue.slice(4);
    return AGGREGATE_REGIONS.find(a => a.weeklyKey === key) ?? null;
  }, [largeValue]);

  useEffect(() => {
    setMidKey('');
    setMidOptions([]);
    if (!selectedSido) return;
    const cached = peekRegions(2, selectedSido.code);
    if (cached) {
      setMidOptions(buildMidOptions(cached, isAvail, selectedSido.name));
      return;
    }
    setLoadingMid(true);
    let active = true;
    getRegions(2, selectedSido.code)
      .then(list => {
        if (active) setMidOptions(buildMidOptions(list, isAvail, selectedSido.name));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingMid(false);
      });
    return () => {
      active = false;
    };
  }, [selectedSido, isAvail]);

  const target = useMemo<{ key: string; display: string; available: boolean } | null>(() => {
    if (selectedAggregate) {
      return { key: selectedAggregate.weeklyKey, display: selectedAggregate.label, available: isAvail(selectedAggregate.weeklyKey) };
    }
    if (selectedSido) {
      if (midKey) {
        const opt = midOptions.find(m => m.key === midKey);
        if (opt) return { key: opt.key, display: opt.basketLabel, available: opt.available };
      }
      return { key: selectedSido.name, display: selectedSido.name, available: isAvail(selectedSido.name) };
    }
    return null;
  }, [selectedAggregate, selectedSido, midKey, midOptions, isAvail]);

  const alreadyAdded = !!target && value.some(v => v.key === target.key);
  const isFull = value.length >= MAX_ANALYSIS_REGIONS;
  const canAdd = !!target && target.available && !alreadyAdded && !isFull;

  const handleAdd = () => {
    if (!target || !canAdd) return;
    onChange([...value, { key: target.key, label: target.display }]);
  };

  const remove = (key: string) => onChange(value.filter(v => v.key !== key));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-base font-semibold text-gray-700">포함할 지역 ({value.length}/{MAX_ANALYSIS_REGIONS})</p>
        {value.length > 0 && (
          <button onClick={() => onChange([])} className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-500 hover:bg-gray-50">
            전체 해제
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={largeValue}
          onChange={e => setLargeValue(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-200 px-2.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">대지역 (시/도 · 집계)</option>
          <optgroup label="집계 지역">
            {AGGREGATE_REGIONS.map(a => (
              <option key={a.weeklyKey} value={`agg:${a.weeklyKey}`} disabled={!isAvail(a.weeklyKey)}>
                {a.label}
                {isAvail(a.weeklyKey) ? '' : ' (데이터 없음)'}
              </option>
            ))}
          </optgroup>
          <optgroup label="시 / 도">
            {sidoList.map(s => (
              <option key={s.code} value={`sido:${s.code}`}>{s.name}</option>
            ))}
          </optgroup>
        </select>

        <select
          value={midKey}
          disabled={!selectedSido || loadingMid}
          onChange={e => setMidKey(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-200 px-2.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-300"
        >
          <option value="">
            {!selectedSido
              ? selectedAggregate
                ? '집계 지역은 중지역 없음'
                : '중지역 (시/군/구)'
              : loadingMid
              ? '불러오는 중...'
              : `${selectedSido.name} 전체 또는 시/군/구`}
          </option>
          {midOptions.map(m => (
            <option key={m.key} value={m.key} disabled={!m.available}>
              {m.label}
              {m.available ? '' : ' (데이터 없음)'}
            </option>
          ))}
        </select>

        <button
          onClick={handleAdd}
          disabled={!canAdd}
          title={isFull ? `최대 ${MAX_ANALYSIS_REGIONS}개` : alreadyAdded ? '이미 추가됨' : undefined}
          className="flex-none rounded-md bg-blue-600 px-4 py-2.5 text-base font-semibold text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400"
        >
          추가
        </button>
      </div>

      {value.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">분석에 포함할 지역을 추가하세요.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v, idx) => (
            <span
              key={v.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-sm text-blue-700"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
              {v.label}
              <button onClick={() => remove(v.key)} className="text-blue-400 hover:text-red-500" aria-label={`${v.label} 제거`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
