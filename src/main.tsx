import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// KB 시계열 분석 모듈 스타일: 호스트 셸 CSS 뒤에 로드.
// kb-shell.css는 .kb-scope 로 한정되어 naver 화면에 영향 없음.
import './kb/kb-shell.css';
import './kb/kb-tailwind.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
