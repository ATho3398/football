// 진단: 오픈 플레이 크로스·컷백 순간 공격 팀 선수별 골까지 거리 (박스 안 여부)
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { attackDir, inOppBox } from '../../src/engine/pitch';
import { BALANCED } from '../engine/job';
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = (process.env.F ?? '4-2-3-1') as never;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const inBox: Record<string, number> = {};
const dsum: Record<string, number> = {};
let n = 0, crossX = 0;
for (let i = 0; i < Number(process.env.N ?? 30); i++) {
  const m = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let prev = s.ball.flight;
  while (!s.done) {
    const wasRestart = !!s.restart;
    m.step();
    const fl = s.ball.flight;
    if (fl && fl !== prev && !wasRestart && fl.kind === 'cross') {
      const p = s.agents[fl.passer]!;
      const dir = attackDir(p.team, s.half);
      if (fl.kind === 'cross') crossX += dir > 0 ? fl.fromX : 105 - fl.fromX;
      n++;
      for (const a of s.agents) {
        if (!a.onPitch || a.team !== p.team || a === p || a.line === 0) continue;
        const gx = dir > 0 ? 105 : 0;
        if (inOppBox(a.x, a.y, dir)) inBox[a.pos] = (inBox[a.pos] ?? 0) + 1;
        dsum[a.pos] = (dsum[a.pos] ?? 0) + Math.hypot(a.x - gx, a.y - 34);
      }
    }
    prev = fl;
  }
}
console.log('크로스·컷백', n, '평균 크로스 x', (crossX / n).toFixed(1));
for (const k of Object.keys(dsum)) console.log(k, '박스 안 비율', ((inBox[k] ?? 0) / n).toFixed(2), '평균 골 거리', (dsum[k]! / n).toFixed(1));
console.log('합', (Object.values(inBox).reduce((a, b) => a + b, 0) / n).toFixed(2));
