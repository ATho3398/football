// @ts-nocheck — 진단 스크립트 (C.78y, 되돌린 상수 counterRunAll 을 런타임에 넣음)
// 진단 (C.78y): engine.test 이동 거리 팀(76:74) 경기별 최다 평균. npx vite-node scripts/diag/c78y-dist.ts -- <failLossModel> <counterRunAll> <시드 시작> <시드 끝> [screenReact]
import { ENGINE } from '../../src/engine/config';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
const args = process.argv.slice(2).filter((x) => x !== '--').map(Number);
(ENGINE.prob as { failLossModel: number }).failLossModel = args[0]!;
(ENGINE.decide.bias as { counterRunAll: number }).counterRunAll = args[1]!;
if (args[5] !== undefined) (ENGINE.prob as { failLossMaxX: number }).failLossMaxX = args[5]!;
if (args[4] !== undefined) (ENGINE.keeper as { screenReact: number }).screenReact = args[4]!;
const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
let sum = 0, n = 0, six = 0;
for (let seed = args[2]!; seed <= args[3]!; seed++) {
  const r = createMatch({ home: teamSetupFromRoster(home, 76, 74), away: teamSetupFromRoster(away, 74, 76), mode: 'auto', difficulty: 'normal', seed, bigMatch: false }).runToEnd();
  const top = Math.max(...r.players.filter((p) => p.minutes >= 85 && p.position !== 'GK').map((p) => p.distance));
  sum += top; n++; if (seed <= 16) six += top;
}
console.log(`failLossModel ${args[0]} counterRunAll ${args[1]}: 시드 ${args[2]}~${args[3]} 최다 평균 ${(sum / n / 1000).toFixed(2)} km · 11~16 평균 ${(six / 6 / 1000).toFixed(2)}`);
process.exit(0);
