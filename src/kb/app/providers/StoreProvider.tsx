import React, { useEffect } from 'react';
import { useAppStore } from '../../shared/lib/store';
import { useMonthlyStore } from '../../shared/lib/monthly-store';
import { initRegionSync } from '../../features/region-sync';

interface StoreProviderProps {
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const { loadRegions, loadStatus, loadWeeklyData, loadTradeData, loadDates } = useAppStore();

  // Initialize on app start
  useEffect(() => {
    // 주간↔월간 연동 구독 설정(1회).
    initRegionSync();

    loadRegions();
    loadStatus();
    loadDates();
    loadWeeklyData();
    loadTradeData();

    // 영속화된 모드가 월간이면 월간 데이터도 즉시 로드(setMode 경유 없이 복원된 경우).
    const m = useMonthlyStore.getState();
    if (m.mode === 'monthly' && m.allDates.length === 0) {
      void m.loadDates().then(() => m.loadPriceData());
      void m.loadTradeRegions();
      void m.loadTradeData();
      void m.loadMarketData();
    } else if (m.allDates.length === 0) {
      // 연동 시 기준월·기간 변환에 필요한 월간 날짜축을 미리 확보(주간 모드여도).
      void m.loadDates();
    }
  }, []);

  return <>{children}</>;
};
