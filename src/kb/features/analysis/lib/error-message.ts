// 프로바이더/브리지 raw 오류 문자열을 사용자 친화적 한글 메시지로 변환.
// 분석·Q&A 공통. raw JSON 노출을 막고 흔한 케이스(429 등)를 안내한다.

export function friendlyError(raw: string | undefined): string {
  const text = raw ?? '';

  if (/429|rate.?limit|rate-limited|too many requests/i.test(text)) {
    return '무료 모델 사용량이 잠시 초과됐어요 (429). 잠시 후 다시 시도하거나 다른 모델을 선택하세요. 본인 API 키를 등록하면 개인 한도로 안정화됩니다.';
  }
  if (/\b401\b|\b403\b|unauthor|invalid api key|연결되지 않은|자격증명/i.test(text)) {
    return '프로바이더 인증에 실패했어요. 모델·프로바이더 연결(API 키)을 확인해주세요.';
  }
  if (/타임아웃|timeout|지연되고/i.test(text)) {
    return '응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.';
  }
  if (/\b5\d\d\b|server error|bad gateway|unavailable/i.test(text)) {
    return '프로바이더 서버에 일시적 문제가 있어요. 잠시 후 다시 시도해주세요.';
  }

  // 그 외: 중첩 JSON의 message만 추출 시도, 실패하면 앞부분만 노출.
  const m = text.match(/"message"\s*:\s*"([^"]+)"/);
  if (m) return `요청에 실패했어요: ${m[1]}`;
  const trimmed = text.trim();
  if (!trimmed) return '요청에 실패했어요. 잠시 후 다시 시도해주세요.';
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}
