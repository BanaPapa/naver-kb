// 메인 화면 데이터 내보내기. 현재 화면에 표시 중인 주간/월간 데이터를
// 엑셀(xlsx, 시트 분리) / JSON / Markdown 으로 직렬화한다.
import * as XLSX from 'xlsx';
import { collectTabs, ALL_TABS } from '../../analysis';
import type { AnalysisRequest, AnalysisDataset, AnalysisTab, AnalysisScope } from '../../../entities/analysis';

export type ExportMode = 'weekly' | 'monthly';
export type ExportFormat = 'xlsx' | 'json' | 'md';

// 선택한 모드들에 해당하는 탭 목록.
export function tabsForModes(modes: ExportMode[]): AnalysisTab[] {
  return ALL_TABS.filter(t => modes.includes(t.mode)).map(t => t.tab);
}

// 현재 스토어(화면) 상태로 데이터셋을 모은다.
export function buildRequest(modes: ExportMode[]): AnalysisRequest {
  return collectTabs(tabsForModes(modes));
}

function label(scope: AnalysisScope, key: string): string {
  return scope.regionLabels[key] ?? key;
}

// 데이터셋의 모든 날짜 합집합(정렬).
function unionDates(dataset: AnalysisDataset): string[] {
  const set = new Set<string>();
  for (const rs of Object.values(dataset.byRegion)) for (const p of rs.series) set.add(p.date);
  return Array.from(set).sort();
}

// 엑셀 시트명 제약(31자, 특수문자 불가) + 중복 방지.
function sheetName(used: Set<string>, raw: string): string {
  const cleaned = raw.replace(/[[\]:*?/\\]/g, ' ').slice(0, 28).trim() || 'sheet';
  let name = cleaned;
  let n = 2;
  while (used.has(name)) {
    const suffix = ` ${n}`;
    name = cleaned.slice(0, 28 - suffix.length) + suffix;
    n += 1;
  }
  used.add(name);
  return name;
}

const MODE_TAG: Record<string, string> = { weekly: '주간', monthly: '월간' };

// 엑셀 워크북: 요약 시트 1개 + 지표별 시트(날짜 행 × 지역 열).
export function toXlsxBlob(req: AnalysisRequest): Blob {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  // 요약 시트
  const summaryRows: (string | number)[][] = [
    ['항목', '값'],
    ['생성 시각', req.generatedAt],
    ['모드', req.scope.mode],
    ['기간', `${req.scope.period.from} ~ ${req.scope.period.to}`],
    ['지역', req.scope.regions.map(r => label(req.scope, r)).join(', ')],
    ['지표 수', req.datasets.length],
    [],
    ['지표', '단위', '지역 수', '시트명'],
  ];
  const sheetNames: string[] = [];
  for (const d of req.datasets) {
    const mode = d.tab.startsWith('weekly') ? 'weekly' : 'monthly';
    const name = sheetName(used, `${MODE_TAG[mode]} ${d.label}`);
    sheetNames.push(name);
    summaryRows.push([d.label, d.unit || '-', Object.keys(d.byRegion).length, name]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), '요약');

  // 지표별 시트
  req.datasets.forEach((d, i) => {
    const regions = Object.keys(d.byRegion);
    const dates = unionDates(d);
    const header = ['날짜', ...regions.map(r => label(req.scope, r))];
    const byRegionMap = regions.map(r => {
      const m = new Map<string, number | null>();
      for (const p of d.byRegion[r]!.series) m.set(p.date, p.value);
      return m;
    });
    const rows: (string | number)[][] = [header];
    for (const date of dates) {
      const row: (string | number)[] = [date];
      byRegionMap.forEach(m => {
        const v = m.get(date);
        row.push(v == null ? '' : v);
      });
      rows.push(row);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetNames[i]!);
  });

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// JSON: 화면 데이터 전체(스코프 + 데이터셋). 에이전트 핸드오프용.
export function toJson(req: AnalysisRequest): string {
  return JSON.stringify({ generatedAt: req.generatedAt, scope: req.scope, datasets: req.datasets }, null, 2);
}

function fmt(n: number | null): string {
  if (n == null) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

// Markdown: 지표별 요약표(사람용) + 원본 데이터 JSON 블록(에이전트용).
export function toMarkdown(req: AnalysisRequest): string {
  const { scope, datasets } = req;
  const lines: string[] = [
    '# KB 부동산 데이터 내보내기',
    '',
    `- 생성 시각: ${req.generatedAt}`,
    `- 모드: ${scope.mode}`,
    `- 기간: ${scope.period.from} ~ ${scope.period.to}`,
    `- 지역: ${scope.regions.map(r => label(scope, r)).join(', ')}`,
    '',
    '## 지표 요약',
    '',
  ];

  for (const d of datasets) {
    lines.push(`### ${d.label}${d.unit ? ` (${d.unit})` : ''}`, '');
    lines.push('| 지역 | 최신 | 시작 | 증감 | 증감% | 최소 | 최대 | 평균 | 추세 |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |');
    for (const [region, rs] of Object.entries(d.byRegion)) {
      const s = rs.summary;
      lines.push(
        `| ${label(scope, region)} | ${fmt(s.latest)} | ${fmt(s.start)} | ${fmt(s.changeAbs)} | ${fmt(s.changePct)} | ${fmt(s.min)} | ${fmt(s.max)} | ${fmt(s.mean)} | ${s.direction} |`,
      );
    }
    lines.push('');
  }

  lines.push(
    '## 원본 데이터(JSON)',
    '',
    '아래 블록에는 화면에 표시된 전체 시계열이 담겨 있습니다. 부동산 시장이 학습된 에이전트에 이 파일을 그대로 전달하면 정밀한 분석이 가능합니다.',
    '',
    '```json',
    JSON.stringify({ scope, datasets }, null, 2),
    '```',
    '',
  );

  return lines.join('\n');
}

// 파일명 베이스(확장자 제외).
export function exportFileName(modes: ExportMode[], format: ExportFormat): string {
  const tag = modes.length === 2 ? 'all' : modes[0] ?? 'data';
  const date = new Date().toISOString().slice(0, 10);
  const ext = format === 'xlsx' ? 'xlsx' : format === 'json' ? 'json' : 'md';
  return `kb-data-${tag}-${date}.${ext}`;
}

// Blob 다운로드(브라우저 전용).
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 형식별 직렬화 → 다운로드.
export function runExport(modes: ExportMode[], format: ExportFormat): void {
  const req = buildRequest(modes);
  const filename = exportFileName(modes, format);
  if (format === 'xlsx') {
    downloadBlob(filename, toXlsxBlob(req));
    return;
  }
  const text = format === 'json' ? toJson(req) : toMarkdown(req);
  const mime = format === 'json' ? 'application/json' : 'text/markdown';
  downloadBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}
