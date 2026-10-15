// 진단 (C.20 4번, E.25 2번): 강팀 대 중위권 10팀 중립 40경기 득점과 득점자. 실행: npx vite-node scripts/diag/top-team.ts -- [팀=liv] [시드=league-0]
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { rebuildRosters } from '../../src/game';
import { pickLineup, teamRatings } from '../../src/roster';

const args = process.argv.slice(2).filter((a) => a !== '--');
const team = args[0] ?? 'liv';
const ws = args[1] ?? 'league-0';
const MID = ['wol', 'eve', 'lei', 'whu', 'wat', 'cry', 'new', 'bou', 'bur', 'sou'];
const rosters = rebuildRosters(ws, undefined, 0);
const ratings = teamRatings(rosters);
const ids = Object.keys(ratings);
const leagueAvg = ids.reduce((t, id) => t + ratings[id]!, 0) / ids.length;

const r = rosters[team]!;
const lu = pickLineup(r);
console.log(`${team} 레이팅 ${ratings[team]} (${ws})`);
for (const s of lu.slots) {
  const p = r.players.find((x) => x.id === s.playerId)!;
  const a = p.attributes;
  console.log(`  ${s.pos.padEnd(3)} ${p.id.padEnd(20)} OVR ${s.ovr}${a ? ` 슈팅 ${a.shooting} 속도 ${a.pace} 드리블 ${a.dribbling} 위치 ${a.offTheBall}` : ''}`);
}

let gf = 0;
let ga = 0;
const sc = new Map<string, number>();
for (let i = 0; i < 40; i++) {
  const opp = MID[i % MID.length]!;
  const home = teamSetupFromRoster(rosters[team]!, ratings[team]!, ratings[opp]!, ws, undefined, leagueAvg);
  const away = teamSetupFromRoster(rosters[opp]!, ratings[opp]!, ratings[team]!, ws, undefined, leagueAvg);
  const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: 70000 + i, bigMatch: false, neutral: true }).runToEnd();
  gf += m.homeGoals;
  ga += m.awayGoals;
  for (const p of m.players) if (p.goals && r.players.some((x) => x.id === p.id)) sc.set(p.id, (sc.get(p.id) ?? 0) + p.goals);
}
console.log(`중립 40경기: 득점 ${(gf / 40).toFixed(2)} 실점 ${(ga / 40).toFixed(2)}`);
console.log(`득점자: ${[...sc.entries()].sort((a, b) => b[1] - a[1]).map(([id, g]) => `${id} ${g}`).join(', ')}`);
process.exit(0);
