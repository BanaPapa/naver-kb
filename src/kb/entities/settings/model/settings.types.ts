export interface UserSettings {
  basePeriodYears: number;
  useCustomBase: boolean;
}

export interface SettingsState extends UserSettings {
  isLoading: boolean;
  error: string | null;
}

export interface SettingsActions {
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  fetchSettings: () => Promise<void>;
  resetSettings: () => void;
}