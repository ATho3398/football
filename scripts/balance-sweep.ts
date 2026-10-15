// 상수 스윕 (E.18 0번): 공용 상수 1~3개와 후보 값 목록을 받아 모든 조합을 병렬로 돌린다.
// 실행: npm run balance:sweep -- onball.utilityScale=1.5,2.4,4 keeper.saveBase=1.3,1.38
// 조합당 표본: 동레이팅 60경기 + Δ±8 40경기 + 스탯 반응 핵심 3개(ST 슈팅, CM 패스, CB 태클) 각 40경기
// 결과 표는 docs/engine-sweep.md 에 저장한다. 고른 값은 전체 점검(balance:engine)으로 다시 확인한다.

import { writeFileSync } from 'node:fs';
import { ENGINE_VERSION } from '../src/engine/config';
import { analyze, buildSets, runSets, type SetDef } from './engine/suite';

const args = process.argv.slice(2).filter((a) => a.includes('='));
if (!args.length) {
  console.log('사용법: npm run balance:sweep -- 경로=값1,값2 [경로=값1,값2 ...]');
  process.exit(1);
}
const axes = args.map((a) => {
  const [path, vals] = a.split('=') as [string, string];
  return { path, vals: vals.split(',').map(Number) };
});
const combos: Record<string, number>[] = axes.reduce<Record<string, number>[]>(
  (acc, ax) => acc.flatMap((c) => ax.vals.map((v) => ({ ...c, [ax.path]: v }))),
  [{}],
);

// 모든 조합의 경기를 한 번에 워커 풀에 넣는다
const t0 = Date.now();
const all: SetDef[] = [];
const ranges: [number, number][] = [];
for (const c of combos) {
  const sets = buildSets('sweep', c).map((s) => ({ ...s, name: `${JSON.stringify(c)}|${s.name}` }));
  ranges.push([all.length, all.length + sets.length]);
  all.push(...sets);
}
const res = await runSets(all, `스윕 ${combos.length}조합`);
const sec = (Date.now() - t0) / 1000;

const cols: [string, string, number][] = [
  ['goals', '득점', 2], ['g8', 'Δ+8', 2], ['gm8', 'Δ−8', 2], ['poss', '점유', 1], ['passes', '패스', 0], ['passPct', '패스%', 1],
  ['shots', '슈팅', 1], ['sot', '유효', 1], ['savePct', '선방%', 1], ['live', '살아있는 분', 1], ['throwIns', '스로인', 1],
];
const respCols: [string, string][] = [['st_shoot:경기당 득점', 'ST 득점%'], ['cm_pass:패스 성공률 %', 'CM 패스%p'], ['cb_def:태클 성공률 % (이긴 태클 / (태클 + 돌파 허용))', 'CB 태클%p']];
const lines: string[] = [];
lines.push('# 상수 스윕 결과 (`npm run balance:sweep`)');
lines.push('');
lines.push(`- 실행: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC) · ENGINE_VERSION ${ENGINE_VERSION} · ${combos.length}조합 · ${sec.toFixed(0)}초`);
lines.push(`- 축: ${axes.map((a) => `\`${a.path}\` = ${a.vals.join(', ')}`).join(' / ')}`);
lines.push('- 조합당 표본: 동레이팅 60 + Δ+8 40 + 스탯 반응 3개 각 40경기 (작은 표본, 고른 값은 전체 점검으로 다시 확인)');
lines.push('');
lines.push(`| ${axes.map((a) => a.path).join(' | ')} | ${cols.map((c) => c[1]).join(' | ')} | ${respCols.map((c) => c[1]).join(' | ')} |`);
lines.push(`|${'---|'.repeat(axes.length + cols.length + respCols.length)}`);
combos.forEach((c, k) => {
  const [a, b] = ranges[k]!;
  const sub = new Map([...res.entries()].slice(a, b).map(([name, v]) => [name.split('|')[1]!, v]));
  const r = analyze('sweep', sub, sec);
  const val = (key: string, d: number) => r.rows.find((x) => x.key === key)?.value.toFixed(d) ?? '-';
  const resp = (key: string) => {
    const [rk, metric] = key.split(':') as [string, string];
    const x = r.responses.find((y) => y.key === rk && y.metric === metric);
    return x ? `${x.change >= 0 ? '+' : ''}${x.change.toFixed(1)}` : '-';
  };
  lines.push(`| ${axes.map((ax) => c[ax.path]).join(' | ')} | ${cols.map(([key, , d]) => val(key, d)).join(' | ')} | ${respCols.map(([key]) => resp(key)).join(' | ')} |`);
});
lines.push('');
writeFileSync('docs/engine-sweep.md', lines.join('\n'));
console.log(lines.join('\n'));
process.exit(0);
