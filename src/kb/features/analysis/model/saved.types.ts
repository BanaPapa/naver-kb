import type { TokenUsage } from '../../../entities/analysis';
import type { CollectForParams } from '../lib/collect';

// 저장된 분석 결과 1건. 결과 마크다운과 어떤 조건/모델로 돌렸는지 메타를 함께 보관한다.
export interface SavedAnalysis {
  id: string;
  name: string;          // 사용자가 바꿀 수 있는 표시 이름(기본: 지표·지역·날짜)
  createdAt: number;
  scopeLabel: string;    // 모드·지표·지역·기간 요약 텍스트
  provider: string;      // 프로바이더 id
  model: string;         // 응답 모델 라벨
  usage?: TokenUsage;    // 토큰 사용량(있을 때)
  markdown: string;      // 분석 결과 본문
  collect?: CollectForParams; // 재오픈 시 데이터 재수집용(tabs/regions/기간/기준일). 구버전엔 없음.
}
