// @ts-nocheck C.82j 디버그: 공격 국면 풀백 목표 x 대 공 x
import { applyOverrides, buildTeam } from '../../engine/job';
import { createMatch } from '../../../src/engine/sim';
import { attackDir, toNorm, L } from '../../../src/engine/pitch';
import { tacticsOf } from '../../../src/engine/tactics';
const seed = 41000;
const A = { id: `va${seed}`, rating: 75, seed: `eng-a-75-${seed}`, formation: '4-4-2', tactics: tacticsOf('gegenpress') };
const B = { id: `vb${seed}`, rating: 75, seed: `eng-b-75-${seed}`, formation: '4-4-2', tactics: tacticsOf('balanced') };
const sim = createMatch({ home: buildTeam(A, 75, 'w'), away: buildTeam(B, 75, 'w'), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
const s = sim.state; let next = 0; let n = 0;
while (!s.done && n < 40) {
  sim.step();
  if (s.t < next) continue; next = s.t + 0.5;
  if (s.restart || s.ball.owner < 0) continue;
  const o = s.agents[s.ball.owner]; const team = o.team; const dir = attackDir(team, s.half);
  const [bnx, bny] = toNorm(s.ball.x, s.ball.y, dir);
  if (bnx < 0.5) continue;
  n++;
  const fbs = s.agents.filter((a) => a.onPitch && a.team === team && ['LB', 'RB', 'CB'].includes(a.pos));
  console.log(`t=${s.t.toFixed(1)} 팀${team} 공 ${(bnx * L).toFixed(0)}m y${bny.toFixed(2)} 소유 ${o.pos} | ` + fbs.map((a) => { const [ax] = toNorm(a.x, a.y, dir); const [tx] = toNorm(a.tx, a.ty, dir); return `${a.pos} 역할 ${a.role.id} sy${a.sy} x ${(ax * L).toFixed(0)} 목표 ${(tx * L).toFixed(0)} urgent ${a.urgent} run ${s.t < a.runUntil}`; }).join(' · '));
}
process.exit(0);
