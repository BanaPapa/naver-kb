// 진단용 — Vercel 서버리스 함수가 배포/동작하는지 확인.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({ ok: true, runtime: 'node', ts: Date.now() });
}
