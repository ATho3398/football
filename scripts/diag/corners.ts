// 진단: 코너 직후 15초 슈팅·골 (포지션별)
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';
const N = Number(process.env.N ?? 60);
const agg: Record<string, [number, number, number]> = {};
let corners = 0, cornerGoals = 0, aerialContest = 0;
for (let i = 0; i < N; i++) {
  const mk = (side: string) => {
    const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
    r.formation = '4-2-3-1';
    const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
    s.tactics = { ...s.tactics, ...BALANCED };
    return s;
  };
  const m = createMatch({ home: mk('a'), away: mk('b'), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true });
  const res = m.runToEnd();
  const pos = new Map(res.players.map((p) => [p.id, p.position]));
  let lastCorner = -100, ct = 0;
  for (const e of res.events) {
    if (e.type === 'corner') { lastCorner = e.t; ct = e.team; corners++; }
    if ((e.type === 'shot' || e.type === 'goal') && e.team === ct && e.t - lastCorner < 15) {
      const p = pos.get(e.players[0]!) ?? '?';
      agg[p] ??= [0, 0, 0];
      if (e.type === 'shot') { agg[p][0]++; if (e.params?.onTarget) agg[p][1]++; }
      else { agg[p][2]++; cornerGoals++; }
    }
  }
}
console.log('corners', corners, 'goals', cornerGoals, 'per goal', (corners / cornerGoals).toFixed(1));
console.log(Object.entries(agg).map(([k, v]) => `${k}: 슈팅 ${v[0]} 유효 ${v[1]} 골 ${v[2]}`).join('\n'));
