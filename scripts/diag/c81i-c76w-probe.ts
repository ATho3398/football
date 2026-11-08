// @ts-nocheck C.81i: c76w 시드 묶음 탐색
import { ENGINE } from '../../src/engine/config';
import { focusThreat } from '../../src/engine/offball';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster } from '../../src/roster';
import { attackDir, dist, ownGoal } from '../../src/engine/pitch';
const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76w-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76w-a', 2018, []);
const input = (seed) => ({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
function one(seed, maxMan) {
  const O = ENGINE.offball; const was = O.boxManMax; O.boxManMax = maxMan;
  try {
    let n = 0, marked = 0;
    const m = createMatch(input(seed)); const s = m.state;
    while (!s.done) {
      m.step();
      if (s.tick % 5 !== 0 || s.ball.owner < 0) continue;
      const owner = s.agents[s.ball.owner]; const def = 1 - owner.team;
      const [gx, gy] = ownGoal(attackDir(def, s.half));
      if (dist(s.ball.x, s.ball.y, gx, gy) > 25) continue;
      const focus = focusThreat(s, def);
      for (const o of s.agents) {
        if (!o.onPitch || o.team !== owner.team) continue;
        if (o === owner || o === focus || o.line < 2 || o.pos === 'ST' || o.pos === 'CF') continue;
        if (Math.abs(o.x - gx) > ENGINE.pitch.boxDepth || Math.abs(o.y - gy) > ENGINE.pitch.boxWidth / 2) continue;
        n++;
        if (s.agents.some((d) => d.onPitch && d.team === def && d.line === 1 && dist(d.tx, d.ty, o.x, o.y) <= 2.5)) marked++;
      }
    }
    return [marked, n];
  } finally { O.boxManMax = was; }
}
const R = {};
for (let seed = 77; seed <= 100; seed++) R[seed] = { on: one(seed, 2), off: one(seed, 0) };
for (let s0 = 77; s0 <= 98; s0++) {
  const sum = (k) => { let m = 0, n = 0; for (const s of [s0, s0 + 1, s0 + 2]) { m += R[s][k][0]; n += R[s][k][1]; } return n ? m / n : 0; };
  const on = sum('on'), off = sum('off');
  console.log(`${s0}~${s0 + 2}: on ${on.toFixed(3)} off ${off.toFixed(3)} ${on > off + 0.05 ? '✓' : '✗'}`);
}
process.exit(0);
