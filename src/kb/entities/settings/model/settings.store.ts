import { create } from 'zustand';
import type { SettingsState, SettingsActions, UserSettings } from './settings.types';
import { settingsApi } from '../api/settings.api';

interface SettingsStore extends SettingsState, SettingsActions {}

const defaultSettings: UserSettings = {
  basePeriodYears: 3,
  useCustomBase: true,
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  // State
  ...defaultSettings,
  isLoading: false,
  error: null,

  // Actions
  updateSettings: async (newSettings: Partial<UserSettings>) => {
    try {
      set({ isLoading: true, error: null });
      
      const currentSettings = {
        basePeriodYears: get().basePeriodYears,
        useCustomBase: get().useCustomBase,
      };
      
      const updatedSettings = { ...currentSettings, ...newSettings };
      
      await settingsApi.updateSettings(updatedSettings);
      
      set({ 
        ...updatedSettings,
        isLoading: false 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '설정 업데이트에 실패했습니다.';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
      throw error;
    }
  },

  fetchSettings: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const settings = await settingsApi.getSettings();
      
      set({ 
        ...settings,
        isLoading: false 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '설정을 불러오는데 실패했습니다.';
      set({ 
        isLoading: false, 
        error: errorMessage 
      });
    }
  },

  resetSettings: () => {
    set({ 
      ...defaultSettings,
      isLoading: false,
      error: null 
    });
  },
}));