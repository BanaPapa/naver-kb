import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getProvider } from '../src/kb/entities/provider/model/registry';
import { readOne } from './credentials-store';
import { getAdapter, effectiveDef } from './adapters';

interface AnalysisRequestLike {
  id?: string;
  kind?: string;
  scope: unknown;
  datasets: unknown;
  resultMarkdown?: string;
  history?: { role: string; text: string }[];
  question?: string;
  provider?: string;
  model?: string | null;
}

export async function buildMessages(root: string, req: AnalysisRequestLike): Promise<{ system: string; user: string }> {
  const system = await fs.readFile(path.join(root, 'docs/analysis-prompt.md'), 'utf8').catch(() => '당신은 부동산 데이터 분석가입니다. 한국어 마크다운으로 답하세요.');
  const user = JSON.stringify({ scope: req.scope, datasets: req.datasets }, null, 2);
  return { system, user };
}

export async function buildAskMessages(root: string, req: AnalysisRequestLike): Promise<{ system: string; user: string }> {
  const system = await fs
    .readFile(path.join(root, 'docs/analysis-qa-prompt.md'), 'utf8')
    .catch(() => '당신은 부동산 데이터 분석가입니다. 제공된 분석 결과와 데이터에만 근거해 한국어로 답하세요.');
  const history = (req.history ?? [])
    .map(t => `${t.role === 'user' ? '질문' : '답변'}: ${t.text}`)
    .join('\n\n');
  const user = [
    '## 직전 분석 결과',
    req.resultMarkdown ?? '(없음)',
    '',
    '## 원본 데이터(JSON)',
    JSON.stringify({ scope: req.scope, datasets: req.datasets }, null, 2),
    '',
    '## 이전 대화',
    history || '(없음)',
    '',
    '## 새 질문',
    req.question ?? '',
  ].join('\n');
  return { system, user };
}

export async function runProviderAnalysis(root: string, id: string, req: AnalysisRequestLike): Promise<void> {
  const responses = path.join(root, '.analysis', 'responses');
  try {
    await fs.mkdir(responses, { recursive: true });
    const def = getProvider(req.provider ?? '');
    if (!def || def.apiShape === 'claude-bridge') throw new Error(`프록시 대상이 아닌 프로바이더: ${req.provider}`);
    const cred = await readOne(root, def.id);
    if (!cred) throw new Error(`연결되지 않은 프로바이더: ${def.id}`);
    const { system, user } =
      req.kind === 'ask' ? await buildAskMessages(root, req) : await buildMessages(root, req);
    const eff = effectiveDef(def, cred);
    const { text, usage } = await getAdapter(eff.apiShape).chat(eff, cred, { system, user, model: req.model ?? '' });
    await fs.writeFile(path.join(responses, `${id}.md`), text || '_빈 응답_', 'utf8');
    if (usage) await fs.writeFile(path.join(responses, `${id}.usage.json`), JSON.stringify(usage), 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '분석 실행 실패';
    await fs.mkdir(responses, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(responses, `${id}.error.txt`), msg, 'utf8');
  }
}
