// 진단 (C.79x): 거리 구간별 유효 슛 선방률(발 슛·프리킥, 헤더 따로)과 슛 거리 분포 — 75:75 균형 대 균형. 경로=값 덮어쓰기
// 실행: N=600 npx vite-node scripts/diag/c79x-save.ts -- keeper.distAdj.far=0.05
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { ENGINE } from '../../src/engine/config';
import { probe } from '../../src/engine/probe';
import { BALANCED } from '../engine/job';
for (const kv of process.argv.slice(2).filter((a) => a.includes('='))) {
  const [k, v] = kv.split('=') as [string, string];
  const ks = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const p of ks.slice(0, -1)) o = o[p] as Record<string, unknown>;
  o[ks[ks.length - 1]!] = Number(v);
}
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const N = Number(process.env.N ?? 200);
const S0 = Number(process.env.START ?? 0);
const B = [0, 12, 16.5, 25, 99];
const names = ['<12', '12~16.5', '16.5~25', '25+'];
const bin = (d: number) => (d >= 25 ? 3 : d >= 16.5 ? 2 : d >= 12 ? 1 : 0);
const all = [0, 0, 0, 0], sv = [0, 0, 0, 0], gl = [0, 0, 0, 0], shots = [0, 0, 0, 0];
let hSv = 0, hGl = 0, fkSv = 0, fkGl = 0, goals = 0, nShots = 0;
const recs: { kind: string; d: number; outcome: string }[] = [];
probe.shot = (_s, p) => { recs.push(p); };
for (let i = S0; i < S0 + N; i++) {
  recs.length = 0;
  const r = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true }).runToEnd();
  for (const st of r.teamStats) { goals += st.goals; nShots += st.shots; }
  for (const p of recs) {
    if (p.kind === 'pk') continue;
    if (p.kind === 'header') { if (p.outcome === 'save') hSv++; else if (p.outcome === 'goal') hGl++; continue; }
    if (p.kind === 'fk') { if (p.outcome === 'save') fkSv++; else if (p.outcome === 'goal') fkGl++; continue; }
    const k = bin(p.d);
    shots[k]!++;
    if (p.outcome === 'save') sv[k]!++;
    else if (p.outcome === 'goal') gl[k]!++;
  }
}
void all; void B;
const T = N * 2;
const pct = (a: number, b: number) => ((100 * a) / Math.max(1, a + b)).toFixed(1);
const tot = shots.reduce((a, b) => a + b, 0);
console.log(`팀당 득점 ${(goals / T).toFixed(3)} · 슛 ${(nShots / T).toFixed(2)} · 헤더 선방 ${pct(hSv, hGl)}% (${hSv + hGl}) · 직접 FK 선방 ${pct(fkSv, fkGl)}% (${fkSv + fkGl})`);
for (let k = 0; k < 4; k++) console.log(`  ${names[k]}: 발 슛 ${(shots[k]! / T).toFixed(2)}/팀 (${((100 * shots[k]!) / tot).toFixed(1)}%) · 유효 ${sv[k]! + gl[k]!} 선방 ${pct(sv[k]!, gl[k]!)}% · 골 ${(gl[k]! / T).toFixed(3)}/팀`);
console.log(`JSON ${JSON.stringify({ N, S0, goals, nShots, shots, sv, gl, hSv, hGl, fkSv, fkGl })}`);
process.exit(0);
