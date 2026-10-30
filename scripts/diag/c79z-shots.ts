// 진단 (엔진관리자22 c79z): 표준 동레이팅 표본(engine:check 경량 시드 1000~) 슛 1건씩 — 거리 구간 × 결과, 상황(1대1·헤더·전환·소유 길이·소유 안 패스 수)별 수·xG·골. 엔진 코드 불변(probe 훅).
// 실행: npx vite-node scripts/diag/c79z-shots.ts -- [경기수=300] [시작=0] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { shotExec, shotModel } from '../../src/engine/onball';
import { probe, type ShotProbe } from '../../src/engine/probe';
import { buildTeam } from '../engine/job';
import { std } from '../engine/suite';
const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 300), S0 = Number(args[1] ?? 0);
// 표준 표본과 같은 팀 구성 (suite.std + job.buildTeam: 균형 전술 + 역할 다시 채움)
const mk = (side: string, i: number) => buildTeam(std(side, i), 75, `w${1000 + i}`);
interface Rec extends ShotProbe { blockers: number; near: number; possLen: number; origin: string; sinceWin: number; passes: number; quick: boolean; held: number; exSave: number; cover: number }
const shots: Rec[] = [];
let curOwnT = new Map<number, number>();
let possPass0 = [0, 0];
let goals = 0;
probe.shot = (s, p) => {
  const a = s.agents[p.shooter]!;
  const mm = p.kind === 'foot' || p.kind === 'header' ? shotModel(s, a, p.kind === 'header') : null;
  let near = Infinity;
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) near = Math.min(near, Math.hypot(o.x - a.x, o.y - a.y));
  // 실행 쪽 기대 선방(실제 GK 위치·속도·능력, 같은 식 saveChance)·덮는 정도 — 실제 선방률과 비교(판단 대비 실현 차)
  const e = mm ? shotExec(s, a, p.kind === 'header') : null;
  shots.push(Object.assign(p, {
    exSave: e ? e.pSave : NaN, cover: e ? e.cover : NaN, held: s.t - (curOwnT.get(a.idx) ?? -9),
    blockers: mm?.blockers ?? 0, near, possLen: s.t - s.possStartT, origin: s.possOrigin, sinceWin: s.t - s.teams[a.team].wonAt,
    passes: s.teams[a.team].stats.passes - possPass0[a.team]!, quick: s.t - (curOwnT.get(a.idx) ?? -9) <= 0.6,
  }));
};
for (let i = S0; i < S0 + N; i++) {
  const m = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true });
  const s = m.state; let prevOwner = -1; let prevStart = -1;
  curOwnT = new Map();
  while (!s.done) {
    if (s.moments.pending) m.resolve('delegate'); else m.step();
    if (s.possStartT !== prevStart) { prevStart = s.possStartT; possPass0 = [s.teams[0].stats.passes, s.teams[1].stats.passes]; }
    if (s.ball.owner >= 0 && s.ball.owner !== prevOwner) curOwnT.set(s.ball.owner, s.t);
    prevOwner = s.ball.owner;
  }
  goals += s.teams[0].stats.goals + s.teams[1].stats.goals;
}
const T = N * 2;
const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
const f = (x: number, k = 3) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const S = shots.filter((x) => x.kind === 'foot' || x.kind === 'header');
const row = (name: string, B: Rec[]) => {
  const on = B.filter((x) => x.outcome === 'save' || x.outcome === 'goal');
  const g = B.filter((x) => x.outcome === 'goal').length;
  console.log(`| ${name} | ${(B.length / T).toFixed(2)} | ${f(avg(B.map((x) => x.xg ?? 0)))} | ${(100 * on.length / Math.max(1, B.length)).toFixed(1)} | ${(100 * B.filter((x) => x.outcome === 'block').length / Math.max(1, B.length)).toFixed(1)} | ${(100 * (on.length - g) / Math.max(1, on.length)).toFixed(1)} (기대 ${(100 * avg(on.map((x) => x.exSave))).toFixed(1)}) | ${(g / T).toFixed(3)} | ${f(avg(B.map((x) => x.d)), 1)} | ${f(avg(B.map((x) => x.press3)), 2)} | ${f(avg(B.map((x) => x.gkSpeed)), 2)} | ${f(avg(on.map((x) => x.cover)), 3)} |`);
};
console.log(`c79z-shots · ${N}경기 시드 ${1000 + S0}~ · 팀당 득점 ${(goals / T).toFixed(3)} · 팀당 슛 ${(S.length / T).toFixed(2)} (PK ${shots.filter((x) => x.kind === 'pk').length} · 직접 FK ${shots.filter((x) => x.kind === 'fk').length} 제외) · 덮어쓰기 ${allArgs.filter((x) => x.includes('=')).join(' ') || '없음'}`);
console.log('| 묶음 | 팀당 슛 | 평균 xG | 유효 % | 블록 % | 유효 중 선방 % (실행 기대) | 팀당 골 | 평균 거리 | 3 m 압박 | GK 속도 | 유효 슛 덮음 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
row('전체', S);
const bands: [string, number, number][] = [['<6 m', 0, 6], ['6~11 m', 6, 11], ['11~16.5 m', 11, 16.5], ['16.5~25 m', 16.5, 25], ['25 m+', 25, 999]];
for (const [n, lo, hi] of bands) row(`거리 ${n}`, S.filter((x) => x.d >= lo && x.d < hi));
row('헤더', S.filter((x) => x.kind === 'header'));
row('1대1(발·콘 0·3 m 안 0·16.5 m 안)', S.filter((x) => x.kind === 'foot' && x.blockers === 0 && x.near >= 3 && x.d <= 16.5));
row('받고 바로(0.6 s, 11 m 안)', S.filter((x) => x.quick && x.kind === 'foot' && x.d <= 11));
row('받은 뒤 1.5 s 안 (전체)', S.filter((x) => x.held <= 1.5));
row('받은 뒤 1.5 s 넘음', S.filter((x) => x.held > 1.5));
row('GK 움직임 ≥ 1 m/s', S.filter((x) => x.gkSpeed >= 1));
row('GK 움직임 < 1 m/s', S.filter((x) => x.gkSpeed < 1));
row('전환(오픈 탈취 뒤 8 s 안)', S.filter((x) => x.origin === 'open' && x.sinceWin <= 8));
row('오픈 소유 8 s 넘음', S.filter((x) => x.origin === 'open' && x.sinceWin > 8));
row('세트피스 소유', S.filter((x) => x.origin !== 'open'));
for (const [n, lo, hi] of [['소유 <6 s', 0, 6], ['소유 6~15 s', 6, 15], ['소유 15~30 s', 15, 30], ['소유 30 s+', 30, 9999]] as [string, number, number][]) row(n, S.filter((x) => x.possLen >= lo && x.possLen < hi));
for (const [n, lo, hi] of [['소유 안 패스 0~2', 0, 3], ['패스 3~5', 3, 6], ['패스 6~9', 6, 10], ['패스 10+', 10, 999]] as [string, number, number][]) row(n, S.filter((x) => x.passes >= lo && x.passes < hi));
console.log('\nxG 보정(판단 평균 → 실제 골률): ' + ([[0, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 0.3], [0.3, 0.5], [0.5, 1.01]] as [number, number][]).map(([lo, hi]) => { const B = S.filter((x) => (x.xg ?? 0) >= lo && (x.xg ?? 0) < hi); const j = avg(B.map((x) => x.xg ?? 0)); const g = B.filter((x) => x.outcome === 'goal').length / (B.length || 1); return `${lo}~${hi} n${B.length} ${f(j)}→${f(g)} ${B.length ? `${((g / j - 1) * 100).toFixed(0)}%` : '-'}`; }).join(' · '));
process.exit(0);
