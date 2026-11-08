// C.81q 맞춤: 같은 시드 새 게임의 다른 리그를 빠른 진행으로 한 시즌 끝내고(득점자 추첨) 이력서 풀의 리그 × 포지션군 시즌 골·도움 평균,
// 리그 득점 상위 10 · 도움 상위 10 평균을 JSON 으로 낸다. 같은 시드 전부 엔진 저장본(c81m-run all) 시즌 0과 비교한다 (c81q-cmp.ts).
// 실행: npx vite-node scripts/diag/c81q-quick.ts -- <playerId,...> [cfg JSON = BALANCE.otherScorers 덮어쓰기]
import { newGame, type GameState } from '../../src/game';
import { buildResumes } from '../../src/awards';
import { BALANCE } from '../../src/config/balance';
import { finishOtherSeason } from '../../src/otherLeagues';
import { DEFAULT_LEAGUES } from '../../data/leagues';

const args = process.argv.slice(2).filter((a) => a !== '--');
const pids = (args[0] ?? 'salah').split(',');
if (args[1]) Object.assign(BALANCE.otherScorers, JSON.parse(args[1]));
const reps = Number(args[2] ?? 1);
const out: { pid: string; my: string; rs: { lg: string; group: string; goals: number; assists: number }[] }[] = [];
for (const pid of pids) for (let r = 0; r < reps; r++) {
  const g: GameState = newGame({ mode: 'real', playerId: pid, seed: `c81m-a-${pid}${r ? `-r${r}` : ''}`, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
  for (const lg of g.otherLeagues ?? []) finishOtherSeason(g.worldSeed, lg, g.npcs);
  const my = (g.league as { id: string }).id;
  out.push({ pid, my, rs: buildResumes(g).filter((x) => !x.me && x.lg !== my).map((x) => ({ lg: x.lg, group: x.group, goals: x.goals, assists: x.assists })) });
}
console.log(JSON.stringify(out));
