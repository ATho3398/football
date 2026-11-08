// GitHub Actions 단계 요약 (C.78l): 가드마다 이름·값·기준·통과 표를 $GITHUB_STEP_SUMMARY 에 쓴다 (실패를 맨 위에).
// 로그 꼬리(빌드 목록)에 실패 줄이 묻히고 전체 로그 내려받기가 막혀서, 실행 요약 화면에서 바로 보이게 한다. 로컬(변수 없음)은 아무것도 안 함

import { appendFileSync } from 'node:fs';

export interface GuardRow { name: string; value: number | string; min?: number | string; max?: number | string; ok: boolean; note?: string }

const cell = (x: unknown) => String(x ?? '').replace(/\|/g, '\\|');

export function writeStepSummary(rows: GuardRow[], title = 'balance:check 회귀 가드', extra = ''): void {
  const file = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const failed = rows.filter((r) => !r.ok);
  const line = (r: GuardRow) => `| ${r.ok ? '✅' : '❌'} | ${cell(r.name)} | ${cell(r.value)} | ${cell(r.min === undefined && r.max === undefined ? '' : `${r.min ?? ''} ~ ${r.max ?? ''}`)} | ${cell(r.note)} |`;
  const head = '| 통과 | 가드 | 값 | 기준 | 비고 |\n|---|---|---|---|---|';
  const out = [
    `## ${failed.length ? '❌' : '✅'} ${title}: ${rows.length - failed.length}/${rows.length} 통과`,
    '',
    ...(failed.length ? ['### 실패', '', head, ...failed.map(line), ''] : []),
    '### 전체', '', head, ...rows.map(line), '',
    extra,
    '',
  ].join('\n');
  appendFileSync(file, out);
}
