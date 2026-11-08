// 진단 (C.82c, em27 처방 ⑩): ST 슈팅·결정력·침착성 +10 반응을 시드 묶음별로 다시 잰다.
// engine:check 의 resp:st_shoot 와 같은 짝(4-4-2 대 4-4-2, 양 팀 슬롯 9 만 +10) 이지만 시드 시작값을 바꿀 수 있다.
// 실행: SEED=20000 npx vite-node scripts/diag/c82c-st-resp.ts -- [쌍=800] [경로=값 ...]
import type { MatchJob, MatchOut, AttrMod } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';

const args = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 800;
for (const a of args) { if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); } else n = Number(a); }
const S = Number(process.env.SEED ?? 1000);
const SLOT = 9;
const mods: AttrMod[] = [0, 1].map((team) => ({ team: team as 0 | 1, slot: SLOT, attrs: ['shooting', 'bigMatch', 'composure'], delta: 10 }));
const job = (i: number, m?: AttrMod[]): MatchJob => ({ kind: 'match', seed: S + i, home: std('a', S + i, 75, '4-4-2'), away: std('b', S + i, 75, '4-4-2'), neutral: true, overrides, ...(m ? { mods: m } : {}) });
const jobs: MatchJob[] = [];
for (let i = 0; i < n; i++) jobs.push(job(i));
for (let i = 0; i < n; i++) jobs.push(job(i, mods));
const outs = await runJobs<MatchOut>(jobs, { label: `ST 반응 ${jobs.length}경기` });
const per = (ms: MatchOut[]) => ms.map((m) => m.players.filter((p) => p.starter && p.slot === SLOT).reduce((a: number[], p) => [a[0]! + p.goals, a[1]! + p.shots, a[2]! + p.shotsOnTarget, a[3]! + 1], [0, 0, 0, 0]));
const B = per(outs.slice(0, n)), X = per(outs.slice(n));
const tot = (r: number[][], k: number) => r.reduce((a, v) => a + v[k]!, 0);
const g = (r: number[][]) => tot(r, 0) / tot(r, 3);
const ch = (b: number[][], x: number[][]) => (g(x) / g(b) - 1) * 100;
// 짝 부트스트랩 (경기 단위)
let rng = 12345; const rnd = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
const bs: number[] = [];
for (let k = 0; k < 400; k++) { const bb: number[][] = [], xx: number[][] = []; for (let i = 0; i < n; i++) { const j = Math.floor(rnd() * n); bb.push(B[j]!); xx.push(X[j]!); } bs.push(ch(bb, xx)); }
bs.sort((a, b) => a - b);
const goalsPer = (ms: MatchOut[]) => ms.reduce((a, m) => a + m.homeGoals + m.awayGoals, 0) / ms.length / 2;
console.log(`\nST 반응 시드 ${S} 쌍 ${n} 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log(`ST 경기당 득점 ${g(B).toFixed(3)} → ${g(X).toFixed(3)} : ${ch(B, X) >= 0 ? '+' : ''}${ch(B, X).toFixed(1)}% (부트 5~95% ${bs[20]!.toFixed(1)} ~ ${bs[380]!.toFixed(1)})`);
console.log(`ST 유효율 ${(100 * tot(B, 2) / tot(B, 1)).toFixed(2)}% → ${(100 * tot(X, 2) / tot(X, 1)).toFixed(2)}% · 슈팅/경기 ${(tot(B, 1) / tot(B, 3)).toFixed(2)} → ${(tot(X, 1) / tot(X, 3)).toFixed(2)}`);
console.log(`팀 득점 ${goalsPer(outs.slice(0, n)).toFixed(3)} → ${goalsPer(outs.slice(n)).toFixed(3)}`);
process.exit(0);
