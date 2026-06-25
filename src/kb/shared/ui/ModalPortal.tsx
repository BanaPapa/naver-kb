import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// KB 모달을 document.body 로 렌더한다.
// 통합 셸의 헤더/사이드바 등에 backdrop-filter 가 걸려 있어 그 하위에서 position:fixed 가
// viewport 가 아닌 해당 요소 기준으로 갇힌다(모달이 엉뚱한 위치에 뜨는 원인).
// body 로 portal 하면 항상 viewport 기준으로 중앙 정렬된다.
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
