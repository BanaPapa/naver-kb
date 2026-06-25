import { API_BASE_URL } from '../../../shared/config';
import type {
  RegionNode,
  MonthlySeries,
  RegionCompareResult,
} from '../model/monthly-data.types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result: ApiResponse<T> = await response.json();
  if (!result.success) throw new Error(result.error || 'API error');
  return result.data as T;
}

export const monthlyApi = {
  async getRegionTree(): Promise<RegionNode[]> {
    return fetchJson<RegionNode[]>(`${API_BASE_URL}/monthly/regions`);
  },

  async getTimeseries(regionPaths: string[], metric: string): Promise<MonthlySeries[]> {
    const params = new URLSearchParams();
    params.set('regionPath', regionPaths.join(','));
    params.set('metric', metric);
    return fetchJson<MonthlySeries[]>(`${API_BASE_URL}/monthly/timeseries?${params}`);
  },

  async getRegionCompare(
    metric: string,
    parentPath: string,
    date?: string,
  ): Promise<RegionCompareResult> {
    const params = new URLSearchParams();
    params.set('metric', metric);
    params.set('parentPath', parentPath);
    if (date) params.set('date', date);
    return fetchJson<RegionCompareResult>(`${API_BASE_URL}/monthly/region-compare?${params}`);
  },
};
