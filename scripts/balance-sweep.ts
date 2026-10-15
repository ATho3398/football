// 상수 스윕 (E.18 0번): 공용 상수 1~3개와 후보 값 목록을 받아 모든 조합을 병렬로 돌린다.
// 실행: npm run balance:sweep -- onball.utilityScale=1.5,2.4,4 keeper.saveBase=1.3,1.38
// 조합당 표본: 동레이팅 60경기 + Δ±8 40경기 + 스탯 반응 핵심 3개(ST 슈팅, CM 패스, CB 태클) 각 40경기
// 결과 표는 docs/engine-sweep.md 에 저장한다. 고른 값은 전체 점검(balance:engine)으로 다시 확인한다.
// npm run balance:sweep -- --tactics : 동레이팅 성향 6 × 6 매트릭스(칸마다 MATRIX 경기, 기본 100)와 능력치 × 전술 상호작용 (E.19 검증)
//   → docs/engine-tactics.md

import { writeFileSync } from 'node:fs';
import { ENGINE_VERSION } from '../src/engine/config';
import { analyze, buildSets, runSets, std, type SetDef } from './engine/suite';
import type { AttrMod, MatchJob, MatchOut } from './engine/job';
import { runJobs } from './engine/pool';
import { TENDENCIES, TENDENCY_NAMES_KO, tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';

if (process.argv.includes('--tactics')) {
  await tacticsMatrix();
  process.exit(0);
}

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

const COLS = (process.env.COLS ?? 'goals,g8,gm8,passes,passPct,longPct,shots,sot,savePct,live,throwIns,goalKicks,tackles,ints,dribbles,crosses,aerials,fouls,offsides,distCM,gSTn,gMIDn').split(',');
const NAMES: Record<string, [string, number]> = {
  goals: ['득점', 2], g8: ['Δ+8', 2], gm8: ['Δ−8', 2], poss: ['점유', 1], passes: ['패스', 0], passPct: ['패스%', 1], longPct: ['롱%', 1],
  shots: ['슈팅', 1], sot: ['유효', 1], savePct: ['선방%', 1], live: ['살아있는 분', 1], throwIns: ['스로인', 1], goalKicks: ['골킥', 1],
  tackles: ['태클', 1], ints: ['인터셉트', 1], dribbles: ['드리블', 1], crosses: ['크로스', 1], aerials: ['공중볼', 1], fouls: ['파울', 1],
  offsides: ['오프사이드', 1], distCM: ['CM km', 1], lgTopGF: ['최다득점팀', 0], lgTopGA: ['최다실점팀', 0], lgBoot: ['득점왕', 0], lgChamp: ['우승승점', 0], lgGoals: ['리그득점', 2], xpRatio: ['XP 비', 2], rMean: ['평점', 2], rSd: ['평점σ', 2], gr8: ['득점비', 2], gSTn: ['ST골%', 0], gMIDn: ['미드골%', 0], corners: ['코너', 1], counterPct: ['역습%', 0],
};
const cols: [string, string, number][] = COLS.map((k) => [k, NAMES[k]?.[0] ?? k, NAMES[k]?.[1] ?? 1]);
// RESPCOLS=키:지표앞부분,… 로 스탯 반응 열을 고른다 (SWEEP_ALLRESP=1 이면 9개 반응 모두 돌린다)
const respCols: [string, string][] = process.env.RESPCOLS
  ? process.env.RESPCOLS.split(',').map((c) => [c, c] as [string, string])
  : [['st_shoot:경기당 득점', 'ST 득점%'], ['cm_pass:패스 성공률 %', 'CM 패스%p'], ['cb_def:태클 성공률 % (이긴 태클 / (태클 + 돌파 허용))', 'CB 태클%p']];
const lines: string[] = [];
lines.push('# 상수 스윕 결과 (`npm run balance:sweep`)');
lines.push('');
lines.push(`- 실행: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC) · ENGINE_VERSION ${ENGINE_VERSION} · ${combos.length}조합 · ${sec.toFixed(0)}초`);
lines.push(`- 축: ${axes.map((a) => `\`${a.path}\` = ${a.vals.join(', ')}`).join(' / ')}`);
lines.push(`- 조합당 표본: 동레이팅 SWEEP_N(기본 60) + Δ+8 SWEEP_D(40) + 스탯 반응 각 SWEEP_RESP(40)경기 (작은 표본, 고른 값은 전체 점검으로 다시 확인). 스탯 반응 칸: 변화 (단측 95% 한계) 통과`);
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
    const x = r.responses.find((y) => y.key === rk && y.metric.startsWith(metric));
    return x ? `${x.change >= 0 ? '+' : ''}${x.change.toFixed(1)} (${x.bound >= 0 ? '+' : ''}${x.bound.toFixed(1)})${x.pass ? '✓' : '✗'}` : '-';
  };
  lines.push(`| ${axes.map((ax) => c[ax.path]).join(' | ')} | ${cols.map(([key, , d]) => val(key, d)).join(' | ')} | ${respCols.map(([key]) => resp(key)).join(' | ')} |`);
});
lines.push('');
writeFileSync('docs/engine-sweep.md', lines.join('\n'));
console.log(lines.join('\n'));
process.exit(0);

/** E.19 검증: 성향 6 × 6 (영향 상한 ±0.3골, 만능 전술 없음)과 능력치 × 전술 상호작용 3개 */
async function tacticsMatrix(): Promise<void> {
  const NM = Number(process.env.MATRIX ?? 100);
  const NI = Number(process.env.INTER ?? 100);
  const t0 = Date.now();
  const tac = (t: Tendency) => tacticsOf(t);
  const jobs: MatchJob[] = [];
  const cell = (i: number, j: number) => `${TENDENCIES[i]}|${TENDENCIES[j]}`;
  const index = new Map<string, [number, number]>();
  TENDENCIES.forEach((ti, i) => TENDENCIES.forEach((tj, j) => {
    const start = jobs.length;
    for (let k = 0; k < NM; k++) {
      const seed = 21000 + k;
      jobs.push({ kind: 'match', seed, neutral: true, home: std('a', seed, 75, '4-4-2', tac(ti)), away: std('b', seed, 75, '4-4-2', tac(tj)) });
    }
    index.set(cell(i, j), [start, jobs.length]);
  }));
  // 상호작용: 홈 팀 능력치 조건 × 홈 팀 전술, 상대는 균형
  const field = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const mods = (slots: number[], attrs: string[], delta: number): AttrMod[] => slots.map((slot) => ({ team: 0, slot, attrs, delta }));
  const PASS = ['shortPassing', 'longPassing', 'vision', 'ballControl'];
  const inter: { key: string; label: string; conds: [string, AttrMod[]][]; tactics: [string, Partial<ReturnType<typeof tac>>][]; metric: 'gd' | 'conceded' }[] = [
    { key: 'tiki', label: '① 패스군 강/약 팀의 티키타카 득실 이득', conds: [['패스군 +8', mods(field, PASS, 8)], ['패스군 −8', mods(field, PASS, -8)]], tactics: [['균형', tac('balanced')], ['티키타카', tac('tikitaka')]], metric: 'gd' },
    { key: 'counter', label: '② 공격진 속도 빠름/느림의 역습 득실 이득', conds: [['공격진 속도·가속 +10', mods([5, 8, 9, 10], ['pace', 'acceleration'], 10)], ['공격진 속도·가속 −10', mods([5, 8, 9, 10], ['pace', 'acceleration'], -10)]], tactics: [['균형', tac('balanced')], ['역습', tac('counter')]], metric: 'gd' },
    { key: 'line', label: '③ CB 속도 −10 일 때 높은 라인의 실점 증가', conds: [['CB 보통', []], ['CB 속도·가속 −10', mods([2, 3], ['pace', 'acceleration'], -10)]], tactics: [['라인 보통', tac('balanced')], ['라인 높음', { ...tac('balanced'), lineHeight: 0.65 }]], metric: 'conceded' },
  ];
  const interIdx = new Map<string, [number, number]>();
  for (const it of inter) {
    for (const [cName, cm] of it.conds) {
      for (const [tName, tt] of it.tactics) {
        const start = jobs.length;
        for (let k = 0; k < NI; k++) {
          const seed = 23000 + k;
          jobs.push({ kind: 'match', seed, neutral: true, home: std('a', seed, 75, '4-4-2', tt), away: std('b', seed, 75, '4-4-2', tac('balanced')), mods: cm });
        }
        interIdx.set(`${it.key}|${cName}|${tName}`, [start, jobs.length]);
      }
    }
  }
  const outs = await runJobs<MatchOut>(jobs, { label: `전술 매트릭스 ${jobs.length}경기` });
  const sec = (Date.now() - t0) / 1000;
  const avgOf = (r: [number, number], f: (m: MatchOut) => number) => { const xs = outs.slice(r[0], r[1]); return xs.reduce((t, m) => t + f(m), 0) / xs.length; };
  const gdH = (i: number, j: number) => avgOf(index.get(cell(i, j))!, (m) => m.homeGoals - m.awayGoals);
  // 홈/원정 자리 효과를 빼고 성향 i 가 성향 j 를 상대로 낸 득실차
  const vs = (i: number, j: number) => (gdH(i, j) - gdH(j, i)) / 2;
  const L: string[] = [];
  L.push('# 전술 매트릭스와 상호작용 (`npm run balance:sweep -- --tactics`)');
  L.push('');
  L.push(`- 실행: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC) · ENGINE_VERSION ${ENGINE_VERSION} · ${jobs.length}경기 · ${sec.toFixed(0)}초`);
  L.push(`- 동레이팅 75, 양 팀 4-4-2, 중립. 칸마다 ${NM}경기 (행 성향이 열 성향을 상대로 낸 경기당 득실차, 홈/원정 자리를 바꾼 두 칸의 평균)`);
  L.push('');
  L.push('## 성향 6 × 6 (E.15 전술 영향 상한과 상성)');
  L.push(`| 행 \\ 열 | ${TENDENCIES.map((t) => TENDENCY_NAMES_KO[t]).join(' | ')} | 최소 | 상성 있음 |`);
  L.push(`|${'---|'.repeat(TENDENCIES.length + 3)}`);
  let maxAbs = 0;
  let allCountered = true;
  TENDENCIES.forEach((ti, i) => {
    const row = TENDENCIES.map((_, j) => (i === j ? 0 : vs(i, j)));
    const others = row.filter((_, j) => j !== i);
    const min = Math.min(...others);
    const countered = min <= 0;
    allCountered &&= countered;
    maxAbs = Math.max(maxAbs, ...others.map(Math.abs));
    L.push(`| ${TENDENCY_NAMES_KO[ti]} | ${row.map((v, j) => (j === i ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}`)).join(' | ')} | ${min.toFixed(2)} | ${countered ? '✓' : '✗'} |`);
  });
  L.push('');
  L.push(`- 최대 |득실차| ${maxAbs.toFixed(2)} (목표 0.3 이내 ${maxAbs <= 0.3 ? '✓' : '✗'}) · 모든 성향에 득실차 0 이하인 상대 ${allCountered ? '있음 ✓' : '없는 성향 있음 ✗'}`);
  const balGd = gdH(0, 0);
  L.push(`- 균형 대 균형 (홈 자리) 득실차 ${balGd.toFixed(2)} (표본 잡음 기준)`);
  L.push('');
  L.push('## 능력치 × 전술 상호작용 (E.15)');
  L.push('| 항목 | 조건 | 기준 전술 | 바꾼 전술 | 이득 | 판정 |');
  L.push('|---|---|---|---|---|---|');
  for (const it of inter) {
    const gains = it.conds.map(([cName]) => {
      const f = it.metric === 'gd' ? (m: MatchOut) => m.homeGoals - m.awayGoals : (m: MatchOut) => m.awayGoals;
      const a = avgOf(interIdx.get(`${it.key}|${cName}|${it.tactics[0]![0]}`)!, f);
      const b = avgOf(interIdx.get(`${it.key}|${cName}|${it.tactics[1]![0]}`)!, f);
      return [cName, a, b, b - a] as const;
    });
    const ok = it.metric === 'gd' ? gains[0]![3] > gains[1]![3] : gains[1]![3] > gains[0]![3];
    gains.forEach(([cName, a, b, g], k) => L.push(`| ${k === 0 ? it.label : ''} | ${cName} | ${a.toFixed(2)} | ${b.toFixed(2)} | ${g >= 0 ? '+' : ''}${g.toFixed(2)} | ${k === 0 ? (ok ? '✓' : '✗') : ''} |`));
  }
  L.push('');
  L.push('이득: ①② 경기당 득실차 변화(바꾼 전술 − 균형), ③ 경기당 실점 변화(라인 높음 − 보통). 판정: ① 강 > 약 ② 빠름 > 느림 ③ CB 느림 > 보통');
  L.push('');
  writeFileSync('docs/engine-tactics.md', L.join('\n'));
  console.log(L.join('\n'));
}
