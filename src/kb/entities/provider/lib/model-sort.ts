import type { ModelInfo } from '../model/provider.types';

// OpenRouter 홈페이지의 '인기순/성능순'은 공개 API에 데이터가 없어 복제 불가.
// 대신 /models 응답이 주는 필드로 만들 수 있는 정렬만 제공한다.
export type ModelSort = 'free' | 'newest' | 'price' | 'context';

export const MODEL_SORTS: { value: ModelSort; label: string }[] = [
  { value: 'free', label: '무료 우선' },
  { value: 'newest', label: '최신순' },
  { value: 'price', label: '가격순(저렴순)' },
  { value: 'context', label: '컨텍스트 길이순' },
];

export const DEFAULT_MODEL_SORT: ModelSort = 'free';

function byName(a: ModelInfo, b: ModelInfo): number {
  return (a.label ?? a.id).localeCompare(b.label ?? b.id);
}

// 값이 없는 모델은 항상 뒤로 보내기 위한 보조값.
const LAST_NUM = Number.POSITIVE_INFINITY;

/** 원본을 변형하지 않고 정렬된 새 배열을 반환한다. */
export function sortModels(models: readonly ModelInfo[], sort: ModelSort): ModelInfo[] {
  const arr = [...models];
  switch (sort) {
    case 'free':
      return arr.sort((a, b) => Number(b.isFree ?? false) - Number(a.isFree ?? false) || byName(a, b));
    case 'newest':
      return arr.sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || byName(a, b));
    case 'price':
      return arr.sort((a, b) => (a.promptPrice ?? LAST_NUM) - (b.promptPrice ?? LAST_NUM) || byName(a, b));
    case 'context':
      return arr.sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0) || byName(a, b));
    default:
      return arr;
  }
}

/** 입력 토큰 단가(USD/token)를 백만 토큰당 가격 문자열로. */
export function priceTag(m: ModelInfo): string {
  if (m.isFree) return '무료';
  if (m.promptPrice == null) return '';
  const perMillion = m.promptPrice * 1_000_000;
  return `$${perMillion.toFixed(2)}/1M`;
}

/** 셀렉트 옵션에 표시할 라벨: 친근한 이름 + 가격/무료 태그. */
export function modelOptionLabel(m: ModelInfo): string {
  const name = m.label ?? m.id;
  const tag = priceTag(m);
  return tag ? `${name} · ${tag}` : name;
}
