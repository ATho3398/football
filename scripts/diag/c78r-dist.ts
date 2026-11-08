// 진단 (C.78r): engine.test 이동 거리 테스트와 같은 팀으로 시드별 필드 선수 최다 이동 거리 (85분 이상)
// npx vite-node scripts/diag/c78r-dist.ts -- <시드…>
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  const seed = Number(a);
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const fp = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK').sort((x, y) => y.distance - x.distance);
  console.log(`시드 ${seed}: ` + fp.slice(0, 3).map((p) => `${p.position} ${(p.distance / 1000).toFixed(2)}`).join(' · '));
}
