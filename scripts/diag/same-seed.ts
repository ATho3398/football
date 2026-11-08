// 같은 시드 엔진 결과 비교용 지문 (C.30): 이벤트 로그·팀 기록·선수 기록(기존 필드만)·평점을 해시해 출력한다.
// 다른 커밋의 작업 트리에서 같은 명령을 돌려 지문이 같으면 엔진 결과가 같다.
// 실행: npx vite-node scripts/diag/same-seed.ts -- [경기 수(기본 30)]
// NORATING=1 이면 평점(rating)을 빼고 비교한다 (C.77s: 평점 규칙만 바꾼 패치가 엔진 행동은 그대로인지 확인)
import { createHash } from 'node:crypto';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 30);
/** C.30 에서 더한 집계 필드는 빼고 비교한다 (옛 커밋에는 없다) */
const NEW = new Set(['bigChances', 'throughPasses', 'throughCompleted', 'clearances', 'dangerClearances', 'blocks', 'saves', ...(process.env.NORATING ? ['rating'] : [])]);
const all = createHash('sha256');
for (let i = 0; i < N; i++) {
  const hr = 64 + (i * 7) % 24;
  const ar = 64 + (i * 11) % 24;
  const home = createTeamRoster({ id: `h${i}`, rating: hr }, `same-h${i}`, 2018, []);
  const away = createTeamRoster({ id: `a${i}`, rating: ar }, `same-a${i}`, 2018, []);
  const r = createMatch({
    home: teamSetupFromRoster(home, hr, ar), away: teamSetupFromRoster(away, ar, hr), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false,
  }).runToEnd();
  const players = r.players.map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !NEW.has(k))));
  const h = createHash('sha256').update(JSON.stringify([r.homeGoals, r.awayGoals, r.events, r.teamStats, players, r.duration])).digest('hex').slice(0, 12);
  all.update(h);
  if (i < 3) console.log(`경기 ${i}: ${r.homeGoals}-${r.awayGoals} ${h}`);
}
console.log(`${N}경기 지문 ${all.digest('hex').slice(0, 16)}`);
