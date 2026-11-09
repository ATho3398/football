// C.82i: 대형별 최전방 인원(frontCount) 확인
import { frontCount } from '../../../src/engine/onball';
import { createMatch } from '../../../src/engine/sim';
import { teamSetupFromRoster } from '../../../src/engine/setup';
import { createTeamRoster } from '../../../src/roster';
import { FORMATIONS } from '../../../src/formations';
const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82i-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82i-a', 2018, []);
for (const f of FORMATIONS) {
  const h = teamSetupFromRoster(home, 75, 75); const w = teamSetupFromRoster(away, 75, 75);
  h.formation = f; w.formation = '4-4-2';
  const sim = createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false, neutral: true });
  console.log(f, frontCount(sim.state, 0), frontCount(sim.state, 1));
}
process.exit(0);
