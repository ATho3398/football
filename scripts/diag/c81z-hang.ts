// @ts-nocheck — 진단 (C.81z): c78s-matrix 와 같은 짝 경기(k 범위)를 메인 스레드에서 한 경기씩 돌려 걸린 시간·끝났는지(스텝 상한) 기록. 멈춘 경기 찾기.
// 실행: npx vite-node scripts/diag/c81z-hang.ts -- A B seed0 k0 k1 [경로=값 …]
import { applyOverrides, buildTeam } from '../engine/job';
import { std } from '../engine/suite';
import { createMatch } from '../../src/engine/sim';
import { tacticsOf } from '../../src/engine/tactics';
const all = process.argv.slice(2).filter((a) => a !== '--');
const [A, B, seed0s, k0s, k1s, ...rest] = all;
const overrides: Record<string, number> = {};
for (const a of rest) { const [k, v] = a.split('='); overrides[k] = Number(v); }
const seed0 = Number(seed0s), k0 = Number(k0s), k1 = Number(k1s), dirs = 2;
const aHome = (k: number) => (Math.floor(k / dirs) + (k % dirs)) % 2 === 1;
const restore = applyOverrides(overrides);
for (let k = k0; k <= k1; k++) {
  const seed = seed0 + Math.floor(k / dirs);
  const flip = k % dirs === 1;
  const Ateam = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tacticsOf(A));
  const Bteam = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tacticsOf(B));
  const [h, w] = aHome(k) ? [Ateam, Bteam] : [Bteam, Ateam];
  const ws = `w${seed}`;
  const home = buildTeam(h, w.rating, ws);
  const away = buildTeam(w, h.rating, ws);
  const sim = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const t0 = performance.now();
  let steps = 0;
  const cap = 200000;
  while (!s.done && steps < cap) { sim.step(); steps++; }
  const ms = performance.now() - t0;
  console.log(`k=${k} seed=${seed} flip=${flip} aHome=${aHome(k)} steps=${steps} t=${s.t.toFixed(1)} done=${s.done} ${ms.toFixed(0)}ms ${s.done ? '' : `★ 멈춤 restart=${JSON.stringify(s.restart)} owner=${s.ball.owner} flight=${s.ball.flight ? s.ball.flight.kind : '-'} pending=${!!s.moments?.pending}`}`);
}
restore();
