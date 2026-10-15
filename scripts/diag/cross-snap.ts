// 진단: 오픈 플레이 크로스 순간 공격 선수 위치·목표 (골에서 거리)
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { attackDir, inOppBox } from '../../src/engine/pitch';
import { BALANCED } from '../engine/job';
import { finalThirdJob, updateOffball } from '../../src/engine/offball';
import { ballNorm } from '../../src/engine/formation';
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
let shown = 0;
const m = createMatch({ home: mk('a', 0), away: mk('b', 0), mode: 'auto', difficulty: 'normal', seed: 1000, bigMatch: false, neutral: true });
const s = m.state;
let prev = s.ball.flight;
const hist: string[] = [];
while (!s.done && shown < 8) {
  const wasRestart = !!s.restart;
  m.step();
  const rw = s.agents.find((a) => a.team === 1 && a.pos === 'RW')!;
  const own = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  hist.push(`t${s.t.toFixed(1)} 소유 ${own ? own.team + own.pos : '-'} 공 ${(105 - s.ball.x).toFixed(0)},${(s.ball.y - 34).toFixed(0)} RW ${(105 - rw.x).toFixed(0)},${(rw.y - 34).toFixed(0)} 목표 ${(105 - rw.tx).toFixed(0)},${(rw.ty - 34).toFixed(0)} next ${rw.nextOffball.toFixed(1)}`);
  if (hist.length > 40) hist.shift();
  const fl = s.ball.flight;
  if (fl && fl !== prev && !wasRestart && fl.kind === 'cross') {
    const p = s.agents[fl.passer]!;
    const dir = attackDir(p.team, s.half);
    const gx = dir > 0 ? 105 : 0;
    const f = (x: number, y: number) => `${Math.abs(x - gx).toFixed(0)},${(y - 34).toFixed(0)}`;
    if (shown === 0) console.log(hist.join('\n'));
    console.log(`크로스 ${p.pos} @${f(p.x, p.y)} 공 보유 ${(s.t - s.possSince).toFixed(1)}초`);
    console.log('   bnorm', ballNorm(s, p.team).map((v) => v.toFixed(2)).join(','), 'owner', s.ball.owner, 'poss', s.possTeam);
    for (const a of s.agents) if (a.onPitch && a.team === p.team && a !== p && a.line >= 2) {
      const before = f(a.tx, a.ty);
      updateOffball(s, a);
      console.log(`   ${a.pos} ${f(a.x, a.y)} → ${before} / 재계산 ${f(a.tx, a.ty)} job ${finalThirdJob(s, a, p)} ${inOppBox(a.x, a.y, dir) ? '박스' : ''} run ${(s.t < a.runUntil) ? 'Y' : ''}`);
    }
    shown++;
  }
  prev = fl;
}
