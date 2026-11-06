// 진단 (C.78j): 발 슛을 GK 덮는 정도(가운데 선 cover)·GK 이상 자리(골 가운데 → 공 선 위 깊이 3 m)에서 거리별로 나눠 슛·유효·골·선방률. 엔진 코드는 바꾸지 않는다
// 실행: npx vite-node scripts/diag/c78j-cover.ts -- [경기수=40] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { shotExec } from '../../src/engine/onball';
import { probe } from '../../src/engine/probe';
import { keeperOf } from '../../src/engine/keeper';
import { oppGoal, attackDir } from '../../src/engine/pitch';
import { createTeamRoster, rosterRating } from '../../src/roster';
const args = process.argv.slice(2).filter((a) => a !== '--');
for (const a of args.filter((x) => x.includes('='))) { const [k, v] = a.split('='); const p = k!.split('.'); let o = ENGINE as any; for (const q of p.slice(0, -1)) o = o[q]; o[p.at(-1)!] = Number(v); }
const N = Number(args.find((x) => !x.includes('=')) ?? 40);
const rec: { gkLat: number; tgt: number; sp: number; shY: number; urgent: number; o: any; cover: number; pSave: number; gkOff: number; gkDepth: number; d: number; xg: number }[] = [];
probe.shot = (s, p) => {
  if (p.kind !== 'foot') return;
  const a = s.agents[p.shooter]!;
  const e = shotExec(s, a, false);
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  const [gx, gy] = oppGoal(attackDir(a.team, s.half));
  // GK 의 이상 자리(골 가운데 → 공 선 위 깊이 3 m)에서 떨어진 거리
  const ux = a.x - gx, uy = a.y - gy, L = Math.hypot(ux, uy);
  const ix = gx + (ux / L) * 3, iy = gy + (uy / L) * 3;
  const gkLat = gk ? Math.abs(gk.y - gy) : 0; const tgt = gk ? Math.hypot(gk.tx - gk.x, gk.ty - gk.y) : 0; const sp = gk ? Math.hypot(gk.vx, gk.vy) : 0; const shY = Math.abs(a.y - gy);
  rec.push({ gkLat, tgt, sp, shY, urgent: gk?.urgent ? 1 : 0, o: p, cover: e.cover, pSave: e.pSave, gkOff: gk ? Math.hypot(gk.x - ix, gk.y - iy) : 99, gkDepth: gk ? Math.abs(gk.x - gx) : 0, d: p.d, xg: p.xg ?? 0 });
};
for (let i = 0; i < N; i++) {
  const h = createTeamRoster({ id: `h${i}`, rating: 75 }, `sx-h${i}`, 2018, []); const a = createTeamRoster({ id: `a${i}`, rating: 75 }, `sx-a${i}`, 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(h, rosterRating(h), 75, `sxh${i}`), away: teamSetupFromRoster(a, rosterRating(a), 75, `sxa${i}`), mode: 'auto', difficulty: 'normal', seed: 8800 + i, bigMatch: false, neutral: true });
  while (!m.state.done) m.step();
}
const show = (lab: string, R: typeof rec) => {
  const on = R.filter((r) => r.o.outcome === 'save' || r.o.outcome === 'goal');
  const g = on.filter((r) => r.o.outcome === 'goal').length;
  const av = (f: (r: typeof rec[0]) => number, X = on) => (X.reduce((t, r) => t + f(r), 0) / Math.max(1, X.length)).toFixed(2);
  console.log(`${lab}: 슛 ${(R.length / N / 2).toFixed(2)}/팀 · 유효 ${(on.length / N / 2).toFixed(2)} · 골 ${(g / N / 2).toFixed(2)} · 선방률 ${((1 - g / Math.max(1, on.length)) * 100).toFixed(1)}% · cover ${av((r) => r.cover)} · 판단 pSave ${av((r) => r.pSave)} · GK 이상 자리에서 ${av((r) => r.gkOff)} m · xG ${av((r) => r.xg, R)} · GK 깊이 ${av((r) => r.gkDepth, R)} 옆 ${av((r) => r.gkLat, R)} 목표까지 ${av((r) => r.tgt, R)} 속도 ${av((r) => r.sp, R)} urgent ${av((r) => r.urgent, R)} · 슈터 거리 ${av((r) => r.d, R)} 옆 ${av((r) => r.shY, R)}`);
};
const far = rec.filter((r) => r.d >= 12);
show('12 m 밖 전체', far);
for (const [lo, hi] of [[0, 0.5], [0.5, 0.9], [0.9, 1.01]] as [number, number][]) show(`  cover ${lo}~${hi}`, far.filter((r) => r.cover >= lo && r.cover < hi));
for (const [lo, hi] of [[0, 1], [1, 2], [2, 4], [4, 99]] as [number, number][]) show(`  GK 이상 자리 ${lo}~${hi} m`, far.filter((r) => r.gkOff >= lo && r.gkOff < hi));
show('12 m 안', rec.filter((r) => r.d < 12));
for (const [lo, hi] of [[0, 0.5], [0.5, 0.9], [0.9, 1.01]] as [number, number][]) show(`  12 m 안 cover ${lo}~${hi}`, rec.filter((r) => r.d < 12 && r.cover >= lo && r.cover < hi));
show('발 슛 전체', rec);
for (const [lo, hi] of [[0, 0.5], [0.5, 0.9], [0.9, 1.01]] as [number, number][]) show(`  전체 cover ${lo}~${hi}`, rec.filter((r) => r.cover >= lo && r.cover < hi));
process.exit(0);
