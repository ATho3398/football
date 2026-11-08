// @ts-nocheck — 진단 (C.82c): 기본 역할 경기 지문 (시드 1~20 점수·이벤트 수·이동 거리 합). 두 트리에서 같은지 비교
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
const out: string[] = [];
for (let seed = 1; seed <= 20; seed++) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  out.push(`${seed}:${r.homeGoals}-${r.awayGoals}/${r.events.length}/${Math.round(r.players.reduce((a, p) => a + p.distance, 0))}`);
}
console.log(out.join(' '));
