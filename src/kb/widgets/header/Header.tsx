import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { SettingsPanel } from '../../features/settings-panel';

export const Header: React.FC = () => {
  const [dataPeriod, setDataPeriod] = useState<'monthly' | 'weekly'>('monthly');
  const [dataType, setDataType] = useState<'sales' | 'lease'>('sales');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <header className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-200/60 h-16 fixed top-0 left-0 right-0 z-40">
      <div className="flex justify-between items-center h-full px-4 lg:px-6">
        {/* Logo & Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">부동산 분석 플랫폼</h1>
            <div className="text-xs text-gray-500 hidden sm:block">실시간 부동산 데이터 비교 분석</div>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center space-x-3">
          {/* Data Period Toggle */}
          <div className="hidden md:flex items-center bg-gray-100/80 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => setDataPeriod('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dataPeriod === 'monthly'
                  ? 'bg-white text-gray-900 shadow-md scale-105'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              월간
            </button>
            <button
              onClick={() => setDataPeriod('weekly')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dataPeriod === 'weekly'
                  ? 'bg-white text-gray-900 shadow-md scale-105'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              주간
            </button>
          </div>
          
          {/* Data Type Toggle */}
          <div className="hidden lg:flex items-center bg-gray-100/80 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => setDataType('sales')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dataType === 'sales'
                  ? 'bg-white text-gray-900 shadow-md scale-105'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              매매지수
            </button>
            <button
              onClick={() => setDataType('lease')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                dataType === 'lease'
                  ? 'bg-white text-gray-900 shadow-md scale-105'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              전세지수
            </button>
          </div>
          
          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">설정</span>
          </button>

          {/* Export Button */}
          <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="hidden sm:inline">내보내기</span>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
      />
    </header>
  );
};