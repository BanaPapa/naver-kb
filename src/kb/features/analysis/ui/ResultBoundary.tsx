import React from 'react';

interface ResultBoundaryProps {
  children: React.ReactNode;
}

interface ResultBoundaryState {
  error: Error | null;
}

// 분석 결과 렌더 중 오류가 나도 앱 전체가 하얀 화면이 되지 않도록 격리한다.
export class ResultBoundary extends React.Component<ResultBoundaryProps, ResultBoundaryState> {
  state: ResultBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ResultBoundaryState {
    return { error };
  }

  componentDidUpdate(prev: ResultBoundaryProps) {
    // 새 결과(children 변경)가 들어오면 오류 상태를 초기화해 재시도 가능하게.
    if (prev.children !== this.props.children && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">결과를 표시하는 중 오류가 발생했습니다.</p>
          <p className="mt-1 break-all text-xs text-red-500">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
