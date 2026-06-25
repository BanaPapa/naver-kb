// 차트 축·툴팁·드롭다운 공용 숫자 포맷. 천단위 구분기호(,)를 모든 그래프에 동일 적용한다.
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
