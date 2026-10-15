// 결과 보고서 (E.18 0번): balance:engine 을 돌릴 때마다 docs/engine-report.md 로 저장한다.
// 직전 보고서의 수치는 파일 끝 주석(JSON)에 담아 다음 실행에서 변화를 비교한다.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { BALANCE_VERSION } from '../../src/config/balance';
import { ENGINE_VERSION } from '../../src/engine/config';
import { RESP_CAP, RESP_SHARE, respOver, rowPass, type SuiteResult } from './suite';

const DATA_RE = /<!-- report-data (.*?) -->/s;

interface Saved {
  date: string;
  values: Record<string, number>;
  history: string[];
}

function fmt(v: number, d: number): string {
  return Number.isFinite(v) ? v.toFixed(d) : '-';
}

function signed(v: number, d: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
}

/** 통과 규칙 설명 (D.12): 방향 확실(단측 95%) + 기준의 70% 이상 */
function passRule(x: SuiteResult['responses'][number]): string {
  return x.need === 0 ? '방향 확실' : `방향 확실 + ${signed(RESP_SHARE * x.need, 2)}${x.unit} 이상`;
}

export function printResult(r: SuiteResult, guard = false): void {
  let section = '';
  for (const row of r.rows) {
    if (row.section !== section) {
      section = row.section;
      console.log(`\n[${section}]`);
    }
    const ok = guard && row.guard ? row.value >= row.guard[0] && row.value <= row.guard[1] : rowPass(row);
    const range = guard && row.guard ? `가드 ${row.guard[0]}~${row.guard[1]}` : `목표 ${row.target}`;
    console.log(`  ${row.label.padEnd(26)} ${fmt(row.value, row.digits).padStart(8)}   ${range} ${ok ? '✓' : '✗'}${row.note ? `  (${row.note})` : ''}`);
  }
  if (r.responses.length) {
    console.log('\n[스탯 반응 (E.15.1, 짝지은 비교)]');
    for (const x of r.responses) {
      const ok = guard && x.guard !== undefined ? x.change >= x.guard : x.pass;
      console.log(`  ${x.target.padEnd(8)} ${x.attrs.padEnd(18)} ${x.metric.padEnd(30)} ${fmt(x.base, 2)} → ${fmt(x.mod, 2)} (${signed(x.change, 2)}${x.unit}, 단측 95% ${signed(x.bound, 2)})  ${guard && x.guard !== undefined ? `가드 ${x.guard} 이상` : `${x.criterion} → ${passRule(x)}`} ${ok ? '✓' : '✗'}${!guard && respOver(x.change, x.need) ? ` (상한 ${RESP_CAP}배 초과)` : ''}`);
    }
  }
  for (const e of r.extra) console.log(`  ${e}`);
  console.log(`\n경기 ${r.matches}개, ${r.seconds.toFixed(0)}초, 경기당 ${r.msPerMatch.toFixed(0)}ms (워커)`);
}

export function writeReport(path: string, r: SuiteResult, note: string): void {
  const prev: Saved | null = existsSync(path) ? (() => {
    const m = readFileSync(path, 'utf8').match(DATA_RE);
    try {
      return m ? (JSON.parse(m[1]!) as Saved) : null;
    } catch {
      return null;
    }
  })() : null;
  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const values: Record<string, number> = {};
  for (const row of r.rows) values[row.key] = row.value;
  for (const x of r.responses) values[`resp:${x.key}:${x.metric}`] = x.change;
  const passRows = r.rows.filter(rowPass).length;
  const passResp = r.responses.filter((x) => x.pass).length;
  const goals = r.rows.find((x) => x.key === 'goals')?.value ?? NaN;

  const L: string[] = [];
  L.push('# 엔진 통계 보고서 (`npm run balance:engine`)');
  L.push('');
  L.push('> 부록 E.18 0번. 실행할 때마다 다시 쓴다. 기획 세션은 시뮬레이션을 다시 돌리지 않고 이 파일을 읽는다. 이전 결과는 맨 아래 "이력".');
  L.push('');
  L.push(`- 실행: ${date} (UTC) · \`ENGINE_VERSION\` ${ENGINE_VERSION} · \`BALANCE_VERSION\` ${BALANCE_VERSION}`);
  L.push(`- 변경: ${note || '(기록 없음)'}`);
  L.push(`- 표본: 경기 ${r.matches}개, ${r.seconds.toFixed(0)}초, 경기당 ${r.msPerMatch.toFixed(0)}ms (워커 병렬)`);
  L.push(`- 요약: E.15 지표 ${passRows}/${r.rows.length} 목표 안 · 스탯 반응 ${passResp}/${r.responses.length} 통과`);
  L.push('');
  L.push('## E.15 통계 목표');
  let section = '';
  for (const row of r.rows) {
    if (row.section !== section) {
      section = row.section;
      L.push('');
      L.push(`### ${section}`);
      L.push('| 지표 | 목표 | 결과 | 통과 | 직전 |');
      L.push('|---|---|---|---|---|');
    }
    const p = prev?.values[row.key];
    L.push(`| ${row.label} | ${row.target} | ${fmt(row.value, row.digits)}${row.note ? ` (${row.note})` : ''} | ${rowPass(row) ? '✓' : '✗'} | ${p === undefined ? '-' : fmt(p, row.digits)} |`);
  }
  if (r.responses.length) {
    L.push('');
    L.push('## 스탯 반응 (E.15.1, 같은 시드 짝지은 비교, 양 팀 같은 슬롯 선수 1명씩 +10)');
    L.push('');
    L.push(`통과 (D.12, E.20 6번): 방향이 통계적으로 확실하고(짝지은 부트스트랩 단측 95% 한계가 기준 방향), 크기가 표 기준값의 70% 이상. 상한 (E.20 추가 확정 5번, 기록만): 크기가 기준값의 ${RESP_CAP}배 이하.`);
    L.push('');
    L.push('| 바꾼 능력치 | 대상 | 지표 | 기준 경기 | +10 경기 | 변화 | 단측 95% 한계 | 표 기준 | 통과 규칙 | 통과 | 상한 |');
    L.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const x of r.responses) {
      L.push(`| ${x.attrs} | ${x.target} | ${x.metric} | ${fmt(x.base, 2)} | ${fmt(x.mod, 2)} | ${signed(x.change, 2)}${x.unit} | ${signed(x.bound, 2)} | ${x.criterion} | ${passRule(x)} | ${x.pass ? '✓' : '✗'} | ${x.need === 0 ? '-' : respOver(x.change, x.need) ? `✗ (${signed(RESP_CAP * x.need, 2)} 초과)` : '✓'} |`);
    }
  }
  if (r.extra.length) {
    L.push('');
    L.push('## 참고');
    for (const e of r.extra) L.push(`- ${e}`);
  }
  L.push('');
  L.push('## 직전 보고서 대비 변화');
  if (prev) {
    const changes = r.rows
      .filter((row) => prev.values[row.key] !== undefined && Math.abs(row.value - prev.values[row.key]!) >= Math.max(10 ** -row.digits, Math.abs(prev.values[row.key]!) * 0.03))
      .map((row) => `${row.label} ${fmt(prev.values[row.key]!, row.digits)} → ${fmt(row.value, row.digits)}`);
    L.push(`- 직전: ${prev.date}`);
    L.push(changes.length ? `- ${changes.join(' · ')}` : '- 3% 이상 바뀐 지표 없음');
  } else L.push('- 첫 보고서');
  const history = [`${date} · ENGINE ${ENGINE_VERSION} · ${note || '-'} · 지표 ${passRows}/${r.rows.length}, 스탯 반응 ${passResp}/${r.responses.length}, 득점 ${fmt(goals, 2)}`, ...(prev?.history ?? [])];
  L.push('');
  L.push('## 이력');
  for (const h of history) L.push(`- ${h}`);
  L.push('');
  L.push(`<!-- report-data ${JSON.stringify({ date, values, history } satisfies Saved)} -->`);
  L.push('');
  writeFileSync(path, L.join('\n'));
}
