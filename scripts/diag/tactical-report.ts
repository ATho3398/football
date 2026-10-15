// 진단 (21.5.2, 부록 C.22): 실제 시즌 1개(380경기)의 팀별 경기 통계를 모아 전술 리포트 판정 빈도를 잰다. 엔진은 그대로 쓴다.
// 실행: npx vite-node scripts/diag/tactical-report.ts -- [월드 시드=league-0] [나눔 k/n=0/1] [저장 경로]
import { writeFileSync } from 'node:fs';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { rebuildRosters } from '../../src/game';
import { teamRatings } from '../../src/roster';
import { reportInput, type ReportInput } from '../../src/tacticalReport';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ws = args[0] ?? 'league-0';
const [k, n] = (args[1] ?? '0/1').split('/').map(Number) as [number, number];
const out = args[2];
const rosters = rebuildRosters(ws, undefined, 0);
const ratings = teamRatings(rosters);
const ids = Object.keys(ratings);
const leagueAvg = ids.reduce((t, id) => t + ratings[id]!, 0) / ids.length;

const rows: ReportInput[] = [];
let seed = 30000;
let i = 0;
for (const h of ids) for (const a of ids) {
  if (h === a) continue;
  const s = seed++;
  if (i++ % n !== k) continue;
  const home = teamSetupFromRoster(rosters[h]!, ratings[h]!, ratings[a]!, ws, undefined, leagueAvg);
  const away = teamSetupFromRoster(rosters[a]!, ratings[a]!, ratings[h]!, ws, undefined, leagueAvg);
  const r = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: s, bigMatch: false }).runToEnd();
  rows.push(reportInput(r.teamStats, 0, home.tactics.tendency), reportInput(r.teamStats, 1, away.tactics.tendency));
}
if (out) writeFileSync(out, JSON.stringify(rows));
console.log(`${rows.length / 2}경기`);
process.exit(0);
