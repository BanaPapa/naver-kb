import type { UserSettings } from '../model/settings.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export class SettingsApiError extends Error {
  public status?: number;
  
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SettingsApiError';
    this.status = status;
  }
}

export const settingsApi = {
  /**
   * 사용자 설정 조회
   */
  async getSettings(): Promise<UserSettings> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new SettingsApiError(
          `설정 조회 실패: ${response.status}`,
          response.status
        );
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new SettingsApiError(result.error || '설정 조회에 실패했습니다.');
      }

      return result.data;
    } catch (error) {
      if (error instanceof SettingsApiError) {
        throw error;
      }
      throw new SettingsApiError('네트워크 오류가 발생했습니다.');
    }
  },

  /**
   * 사용자 설정 업데이트
   */
  async updateSettings(settings: UserSettings): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new SettingsApiError(
          `설정 업데이트 실패: ${response.status}`,
          response.status
        );
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new SettingsApiError(result.error || '설정 업데이트에 실패했습니다.');
      }
    } catch (error) {
      if (error instanceof SettingsApiError) {
        throw error;
      }
      throw new SettingsApiError('네트워크 오류가 발생했습니다.');
    }
  },
};