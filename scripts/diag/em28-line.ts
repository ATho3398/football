// @ts-nocheck — 진단 (엔진관리자28): 우리 소유·공이 상대 진영일 때 수비 줄(line 1) 평균·가장 깊은 자리·오프사이드 라인(우리 골 거리 m)을 성향별로. 읽기만.
// 실행: npx vite-node scripts/diag/em28-line.ts -- [경기수=20] [tac=gegenpress] [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { createMatch } from '../../src/engine/sim';
import { attackDir, toNorm, L } from '../../src/engine/pitch';
import { offsideLine } from '../../src/engine/offball';
import { tacticsOf } from '../../src/engine/tactics';
const args = process.argv.slice(2).filter((a) => a !== '--');
const ov = {}; let n = 20, tac = 'gegenpress';
for (const a of args) { if (a.startsWith('tac=')) tac = a.slice(4); else if (a.includes('=')) { const [k, v] = a.split('='); ov[k] = Number(v); } else n = Number(a); }
const restore = applyOverrides(ov);
const R = { smp: 0, mean: 0, deep: 0, off: 0, bx: 0, hist: [0, 0, 0, 0, 0, 0] };
for (let k = 0; k < n; k++) {
  const seed = 41000 + k; const meHome = k % 2 === 1;
  const A = { id: `va${seed}`, rating: 75, seed: `eng-a-75-${seed}`, formation: '4-4-2', tactics: tacticsOf(tac) };
  const B = { id: `vb${seed}`, rating: 75, seed: `eng-b-75-${seed}`, formation: '4-4-2', tactics: tacticsOf('balanced') };
  const ws = `w${seed}`;
  const sim = createMatch({ home: buildTeam(meHome ? A : B, 75, ws), away: buildTeam(meHome ? B : A, 75, ws), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state; const me = meHome ? 0 : 1;
  while (!s.done) {
    sim.step();
    if (s.restart || s.possTeam !== me || s.tick % 5) continue;
    const dir = attackDir(me, s.half);
    const bx = toNorm(s.ball.x, s.ball.y, dir)[0];
    if (bx < 0.6) continue;
    const xs = s.agents.filter((a) => a.onPitch && a.team === me && a.line === 1).map((a) => toNorm(a.x, a.y, dir)[0] * L);
    if (!xs.length) continue;
    R.smp++; R.mean += xs.reduce((p, q) => p + q, 0) / xs.length; R.deep += Math.min(...xs); R.bx += bx * L;
    const off = (1 - offsideLine(s, 1 - me)) * L; R.off += off; R.hist[Math.min(5, Math.floor(off / 10))]++;
  }
}
restore();
console.log(`${tac} ${JSON.stringify(ov)} 표본 ${R.smp} · 공 ${(R.bx / R.smp).toFixed(1)} m · 수비 줄 평균 ${(R.mean / R.smp).toFixed(1)} · 가장 깊은 ${(R.deep / R.smp).toFixed(1)} · 오프사이드 라인 ${(R.off / R.smp).toFixed(1)} m · 분포(10 m) ${R.hist.map((v) => (100 * v / R.smp).toFixed(0)).join('/')}`);
process.exit(0);
