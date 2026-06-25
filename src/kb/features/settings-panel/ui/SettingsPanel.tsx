import { type FC, useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, X } from 'lucide-react';
import { useSettingsStore } from '../../../entities/settings';
import { Button } from '../../../shared/ui';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    basePeriodYears,
    useCustomBase,
    isLoading,
    error,
    updateSettings,
    fetchSettings,
    resetSettings,
  } = useSettingsStore();

  const [localBasePeriodYears, setLocalBasePeriodYears] = useState(basePeriodYears);
  const [localUseCustomBase, setLocalUseCustomBase] = useState(useCustomBase);
  const [hasChanges, setHasChanges] = useState(false);

  // 초기 설정 로드
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen, fetchSettings]);

  // 설정 변경 감지
  useEffect(() => {
    const hasChanged = 
      localBasePeriodYears !== basePeriodYears || 
      localUseCustomBase !== useCustomBase;
    setHasChanges(hasChanged);
  }, [localBasePeriodYears, localUseCustomBase, basePeriodYears, useCustomBase]);

  // 설정 값 동기화
  useEffect(() => {
    setLocalBasePeriodYears(basePeriodYears);
    setLocalUseCustomBase(useCustomBase);
  }, [basePeriodYears, useCustomBase]);

  const handleSave = async () => {
    try {
      await updateSettings({
        basePeriodYears: localBasePeriodYears,
        useCustomBase: localUseCustomBase,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('설정 저장 실패:', error);
    }
  };

  const handleReset = () => {
    resetSettings();
    setLocalBasePeriodYears(3);
    setLocalUseCustomBase(true);
    setHasChanges(false);
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm('저장하지 않은 변경사항이 있습니다. 정말 닫으시겠습니까?');
      if (!confirmed) return;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">분석 설정</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 기준일 설정 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">기준일 설정</h3>
            
            <div className="space-y-3">
              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="baseType"
                  checked={!localUseCustomBase}
                  onChange={() => setLocalUseCustomBase(false)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">KB 원본 기준일</div>
                  <div className="text-sm text-gray-500">2022년 1월 10일 = 100 기준</div>
                </div>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="baseType"
                  checked={localUseCustomBase}
                  onChange={() => setLocalUseCustomBase(true)}
                  className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">동적 기준일</div>
                  <div className="text-sm text-gray-500">검색일 기준 N년 전 = 100</div>
                </div>
              </label>
            </div>
          </div>

          {/* 기간 설정 */}
          {localUseCustomBase && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">기준 기간</h3>
              
              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">기준 기간 (년)</span>
                  <div className="mt-1 flex items-center space-x-3">
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={localBasePeriodYears}
                      onChange={(e) => setLocalBasePeriodYears(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="w-12 text-center">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
                        {localBasePeriodYears}년
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    검색 기준일에서 {localBasePeriodYears}년 전 데이터를 100으로 설정합니다.
                  </div>
                </label>
                
                {/* 년도 선택 버튼들 */}
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 5, 7, 10].map((years) => (
                    <button
                      key={years}
                      onClick={() => setLocalBasePeriodYears(years)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        localBasePeriodYears === years
                          ? 'bg-blue-100 text-blue-700 border border-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                      }`}
                    >
                      {years}년
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 미리보기 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">설정 미리보기</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>• 기준일: {localUseCustomBase ? `동적 (${localBasePeriodYears}년 전)` : 'KB 원본 (2022.1.10)'}</div>
              <div>• 지수 계산: {localUseCustomBase ? '사용자 정의 100 기준' : 'KB 공식 100 기준'}</div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={handleReset}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>초기화</span>
          </Button>

          <div className="flex items-center space-x-3">
            <Button
              onClick={handleClose}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              취소
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={isLoading || !hasChanges}
              className="flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{isLoading ? '저장 중...' : '저장'}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};