import { RegionItem } from '../types';

const KB_BASE = 'https://api.kbland.kr/land-price/price/areaName';

interface KBRawItem {
  대지역명: string;
  중지역명?: string;
  소지역명?: string;
  법정동코드: string;
}

export async function getRegions(step: 1 | 2 | 3, parentCode?: string): Promise<RegionItem[]> {
  const params = new URLSearchParams();
  if (step > 1 && parentCode) {
    params.set('법정동코드', parentCode);
  }

  const url = step > 1 ? `${KB_BASE}?${params.toString()}` : KB_BASE;

  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mobile' },
  });

  if (!resp.ok) {
    throw new Error(`KB Land API 오류: ${resp.status}`);
  }

  const json = await resp.json();
  const items: KBRawItem[] = json?.dataBody?.data ?? [];

  const seen = new Set<string>();
  const result: RegionItem[] = [];

  for (const item of items) {
    if (step === 1) {
      const name = item.대지역명.trim();
      const code = item.법정동코드.substring(0, 2);
      if (!seen.has(code)) {
        seen.add(code);
        result.push({ code, name, level: 1 });
      }
    } else if (step === 2) {
      const name = (item.중지역명 || '').trim();
      const code = item.법정동코드.substring(0, 5);
      if (!seen.has(code)) {
        seen.add(code);
        result.push({ code, name, level: 2 });
      }
    } else if (step === 3) {
      const name = (item.소지역명 || '').trim();
      const code = item.법정동코드;
      if (!seen.has(code)) {
        seen.add(code);
        result.push({ code, name, level: 3 });
      }
    }
  }

  return result;
}
