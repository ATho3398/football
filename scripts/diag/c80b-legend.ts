// C.80b 레전더리 위상 가드 분해: 같은 시드 레전더리 최적 배분 커리어를 drawRho 바꿔 돈다.
// 실행: RHO=-0.17 FROM=0 N=24 npx vite-node scripts/diag/c80b-legend.ts  → JSON 줄 (i, 30세 위상, 30세까지 최대, 35세 위상)
import { BALANCE } from '../../src/config/balance';
import { runCareerJob } from '../balance/career';
const env = process.env;
(BALANCE.match as { drawRho: number }).drawRho = Number(env.RHO ?? BALANCE.match.drawRho);
if (env.ACHX) (BALANCE.reputation as { fromAchievementXp: number }).fromAchievementXp = Number(env.ACHX);
const from = Number(env.FROM ?? 0), n = Number(env.N ?? 48), tier = (env.TIER ?? 'legendary') as 'legendary';
for (let i = from; i < from + n; i++) {
  const r = runCareerJob({ kind: 'prospect', tier, i, strategy: 'best', policy: 'stay', coach: 'none', spend: false, records: false, national: false });
  const max30 = Math.max(...Object.entries(r.repByAge).filter(([a]) => Number(a) <= 30).map(([, v]) => v));
  console.log(JSON.stringify({ i, r30: r.repByAge[30] ?? 0, max30, r35: r.repByAge[35] ?? 0 }));
}
