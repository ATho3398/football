// 진단: 시드별 팀 레이팅 (로스터 생성기 변경 전후 비교)
import { rebuildRosters } from '../../src/game';
import { teamRatings } from '../../src/roster';
for (const ws of ['league-0', 'roster', 'r2', 'fame-1']) {
  const r = teamRatings(rebuildRosters(ws, undefined, 0));
  console.log(ws, Object.entries(r).map(([k, v]) => `${k} ${v}`).join(' '));
}
for (const n of [5, 10]) {
  const r = teamRatings(rebuildRosters('league-0', undefined, n));
  console.log(`league-0 +${n}시즌`, Object.entries(r).map(([k, v]) => `${k} ${v}`).join(' '));
}
process.exit(0);
