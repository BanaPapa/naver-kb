// KB Land API level-2 결과를 중지역(시/군/구) 드롭다운 옵션으로 변환.
// 주간·월간 선택자가 공유한다. 가용성(데이터 존재) 판단은 호출측 콜백(isAvailable)으로 위임.
//
// 일반구가 있는 시(예: "고양시 덕양구")는 → "고양시"(시 집계, 합성) + "고양시 덕양구"(구) 로 펼친다.
// 키는 "대지역|지역명" 복합키(예: "경기도|덕양구") — 시도별 중복 구명(중구 등) 충돌 방지.
import type { RegionItem } from './kb-region-api';

export interface MidOption {
  key: string; // "대지역|지역명" 복합키 (예: "서울특별시|강남구")
  label: string; // 드롭다운 표시 (예: "강남구", "고양시 덕양구")
  basketLabel: string; // 비교함/범례 표시 (충돌 구분: "서울특별시 강남구")
  available: boolean; // 데이터에 존재하는가
}

export function buildMidOptions(
  level2: RegionItem[],
  isAvailable: (key: string) => boolean,
  sido: string,
): MidOption[] {
  const out: MidOption[] = [];
  const seenCity = new Set<string>();
  for (const item of level2) {
    const name = item.name.trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      // "고양시 덕양구" — 부모 시(고양시)는 시도가 아니므로 중복 아님. 드롭다운/비교함 모두 그대로.
      const city = parts[0]!;
      const gu = parts.slice(1).join(' ');
      if (!seenCity.has(city)) {
        seenCity.add(city);
        const cityKey = `${sido}|${city}`;
        out.push({ key: cityKey, label: city, basketLabel: city, available: isAvailable(cityKey) });
      }
      const guKey = `${sido}|${gu}`;
      out.push({ key: guKey, label: name, basketLabel: name, available: isAvailable(guKey) });
    } else {
      // 광역시 직속 구(예: "강남구") — 비교함/범례에선 시도별 동일 구명 충돌 방지로 시도 접두.
      const key = `${sido}|${name}`;
      const basketLabel = name.endsWith('구') ? `${sido} ${name}` : name;
      out.push({ key, label: name, basketLabel, available: isAvailable(key) });
    }
  }
  return out;
}
