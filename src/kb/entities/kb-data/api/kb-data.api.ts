import { API_BASE_URL } from '../../../shared/config';
import type { WeeklyDataRow, CollectionStatus, ApiResponse } from '../model/kb-data.types';

export class KBDataApiError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'KBDataApiError';
    this.status = status;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) {
    throw new KBDataApiError(`HTTP ${response.status}`, response.status);
  }
  const result: ApiResponse<T> = await response.json();
  if (!result.success) {
    throw new KBDataApiError(result.error || 'API error');
  }
  return result.data as T;
}

export const kbDataApi = {
  async getRegions(): Promise<string[]> {
    return fetchJson<string[]>(`${API_BASE_URL}/regions`);
  },

  async getWeeklyData(regions: string[], from: string, to: string): Promise<WeeklyDataRow[]> {
    const params = new URLSearchParams();
    if (regions.length > 0) params.set('regions', regions.join(','));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return fetchJson<WeeklyDataRow[]>(`${API_BASE_URL}/data/weekly?${params}`);
  },

  async getCollectionStatus(): Promise<CollectionStatus> {
    return fetchJson<CollectionStatus>(`${API_BASE_URL}/collection/status`);
  },

  async triggerCollection(type: 'weekly' | 'monthly' = 'weekly'): Promise<void> {
    await fetchJson(`${API_BASE_URL}/collection/trigger`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },

  async getLatestDate(): Promise<string | null> {
    const result = await fetch(`${API_BASE_URL}/collection/latest-date`);
    const json = await result.json();
    return json.latestDate ?? null;
  },

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },
};
