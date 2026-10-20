// 진단 (C.75f, E-3): 공격 포지션(ST·WING·CAM) 45분 이상 경기 중 무기여(골·도움·키패스·유효슈팅·드리블 성공 모두 0) 비율과 그 경기 평균 평점
// 실행: npx vite-node scripts/diag/no-contrib.ts -- [worldSeed=nc-0] [경기 수=60]
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { posGroup, teamRatings } from '../../src/roster';
import { rebuildRosters } from '../../src/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const WORLD = args[0] ?? 'nc-0';
const N = Number(args[1] ?? 60);
const rosters = rebuildRosters(WORLD, undefined, 0);
const ratings = teamRatings(rosters);
const ids = Object.keys(ratings);
const leagueAvg = ids.reduce((t, id) => t + ratings[id]!, 0) / ids.length;
const acc: Record<string, { n: number; nc: number; r: number; rNc: number }> = {};
let seed = 700000;
for (let k = 0; k < N; k++) {
  const h = ids[k % ids.length]!;
  const a = ids[(k * 7 + 3) % ids.length]!;
  if (h === a) continue;
  const home = teamSetupFromRoster(rosters[h]!, ratings[h]!, ratings[a]!, WORLD, undefined, leagueAvg);
  const away = teamSetupFromRoster(rosters[a]!, ratings[a]!, ratings[h]!, WORLD, undefined, leagueAvg);
  const r = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: seed++, bigMatch: false }).runToEnd();
  for (const p of r.players) {
    if (p.minutes < 45) continue;
    const g = posGroup(p.position as never) as string;
    const x = (acc[g] ??= { n: 0, nc: 0, r: 0, rNc: 0 });
    x.n++; x.r += p.rating;
    if (p.goals + p.assists + p.keyPasses + p.shotsOnTarget + p.dribblesWon === 0) { x.nc++; x.rNc += p.rating; }
  }
}
console.log(`### 무기여 경기 (${WORLD}, ${N}경기, 45분 이상)\n포지션군 | 경기 | 무기여 % | 평균 평점 | 무기여 경기 평점`);
for (const g of ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB']) {
  const x = acc[g];
  if (x) console.log(`${g} | ${x.n} | ${(100 * x.nc / x.n).toFixed(0)}% | ${(x.r / x.n).toFixed(2)} | ${x.nc ? (x.rNc / x.nc).toFixed(2) : '-'}`);
}
process.exit(0);
