// @ts-nocheck — 진단 (C.80g): c77s 테스트 경기(시드 1000~1009)에서 소극적 백패스 센 선수 수
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster } from '../../src/roster';
for (let seed = 1000; seed < 1010; seed++) {
  const home = createTeamRoster({ id: 'h', rating: 75 }, 'c77s-h', 2018, []);
  const away = createTeamRoster({ id: 'a', rating: 75 }, 'c77s-a', 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false });
  m.runToEnd();
  console.log(seed, m.state.agents.filter((a) => (a.rt.passive ?? 0) > 0).length, m.state.agents.filter((a) => (a.rt.passiveW ?? 0) > 0).length);
}
process.exit(0);
