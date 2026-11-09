// @ts-nocheck C.82k: tests/polish.test.ts 세리머니 테스트 시드 탐색 (어느 시드 경기에 골이 있나)
import { teamSetupFromRoster } from '../../../src/engine/setup';
import { createState, step } from '../../../src/engine/sim';
import { createTeamRoster } from '../../../src/roster';
const home = createTeamRoster({ id: 'h', rating: 76 }, 'pol-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'pol-a', 2018, []);
for (let seed = 21; seed <= 30; seed++) {
  const s = createState({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false });
  let goals = 0, had = false;
  while (!s.done) { step(s); const g = !!s.restart?.goal; if (g && !had) goals++; had = g; }
  console.log(`시드 ${seed}: 골 ${goals} (${JSON.stringify(s.score ?? null)})`);
}
