// 진단: 코너 몇 개를 추적 (박스 안 공격 선수 위치, 크로스 대상, 결과)
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
let shown = 0;
for (let i = 0; i < 3 && shown < 8; i++) {
  const m = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let watch = -1;
  while (!s.done && shown < 8) {
    const r = s.restart;
    const before = r && r.type === 'corner' && s.t >= r.at - 0.05 ? r : null;
    if (before) {
      const team = before.team;
      const gx = before.x > 50 ? 105 : 0;
      const box = s.agents.filter((a) => a.onPitch && a.team === team && Math.abs(a.x - gx) < 16.5 && Math.abs(a.y - 34) < 20.15).map((a) => `${a.pos}(${Math.abs(a.x - gx).toFixed(0)},${(a.y - 34).toFixed(0)} h${(a.attrs.heading).toFixed(0)})`);
      const def = s.agents.filter((a) => a.onPitch && a.team !== team && Math.abs(a.x - gx) < 16.5 && Math.abs(a.y - 34) < 20.15).length;
      const nev = s.events.length;
      m.step();
      const fl = s.ball.flight;
      console.log(`t${s.t.toFixed(0)} 박스 공격 ${box.join(' ')} | 수비 ${def}명 | 대상 ${fl ? s.agents[fl.receiver]?.pos : '-'} 착지 ${fl ? `${Math.abs(fl.toX - gx).toFixed(1)},${(fl.toY - 34).toFixed(1)}` : '-'}`);
      watch = s.t + 4;
      void nev;
      shown++;
      continue;
    }
    const n = s.events.length;
    m.step();
    if (s.t < watch) for (const e of s.events.slice(n)) console.log(`   ${e.type} ${e.players.map((id) => s.agents.find((a) => a.id === id)?.pos).join(',')} ${JSON.stringify(e.params ?? {})}`);
    if (watch > 0 && s.t >= watch) {
      const o = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
      console.log(`   → 4초 후 소유 ${o ? `${o.team === 0 ? 'A' : 'B'} ${o.pos}` : '없음'} 재개 ${s.restart?.type ?? '-'}`);
      watch = -1;
    }
  }
}
