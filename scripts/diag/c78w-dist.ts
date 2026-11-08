// 진단 (C.78w): c78r-dist 와 같은 팀, 2단 체력 끔/켬 비교. npx vite-node scripts/diag/c78w-dist.ts -- <on 0|1> <시드…>
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const args = process.argv.slice(2).filter((x) => x !== '--');
(ENGINE.physics.burst as { on: number }).on = Number(args[0]);
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
for (const a of args.slice(1)) {
  const seed = Number(a);
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const fp = r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK').sort((x, y) => y.distance - x.distance);
  console.log(`on ${args[0]} 시드 ${seed}: ` + fp.slice(0, 3).map((p) => `${p.position} ${(p.distance / 1000).toFixed(2)}`).join(' · '));
}
