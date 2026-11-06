// 진단 (C.81r, 역할별 평점 쏠림): c81i-role-rating 과 같은 표본(같은 슬롯에서 역할만 바꾼 짝, 75 대 75 균형, 홈/원정 반씩)에서
// 추적 선수의 평점 성분(RatingParts)과 평점 밖 수비 기록(블록·걷어내기·돌파 허용 등)을 JSON 으로 저장한다.
// 평점은 경기 행동에 쓰이지 않으므로(경기 끝 computeRatings, 결정 순간 표시만) 한 번 돌린 성분으로 가중을 바꿔 다시 계산한다(c81r-role-fit.ts).
// 실행: npx vite-node scripts/diag/c81r-role-parts.ts -- <역할당 경기수> <출력.json> [시작 시드=47000] [포지션군 ...]
import { writeFileSync } from 'node:fs';
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { ROLE_OPTIONS } from '../../src/engine/roles';
import type { Formation } from '../../src/formations';

export const GROUPS: Record<string, { formation: Formation; slot: number }> = {
  WING: { formation: '4-3-3', slot: 8 },
  ST: { formation: '4-3-3', slot: 9 },
  CAM: { formation: '4-2-3-1', slot: 8 },
  CM: { formation: '4-3-3', slot: 6 },
  CDM: { formation: '4-3-3', slot: 5 },
  FB: { formation: '4-3-3', slot: 1 },
  CB: { formation: '4-3-3', slot: 2 },
};

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 270);
const out = args[1] ?? 'c81r-role-parts.json';
const seed0 = Number(args[2] ?? 47000);
const groups = args.slice(3).map((g) => g.toUpperCase());
const use = groups.length ? groups : Object.keys(GROUPS);
const jobs: MatchJob[] = [];
const meta: { g: string; role: string; k: number; home: boolean }[] = [];
for (const g of use) for (const role of ROLE_OPTIONS[g]!) {
  const G = GROUPS[g]!;
  for (let k = 0; k < n; k++) {
    const seed = seed0 + k;
    const me = { ...std('a', seed, 75, G.formation, 'balanced'), roles: { [G.slot]: role } };
    const op = std('b', seed, 75, G.formation, 'balanced');
    const home = k % 2 === 0;
    jobs.push({ kind: 'match', seed, neutral: true, parts: true, home: home ? me : op, away: home ? op : me });
    meta.push({ g, role, k, home });
  }
}
const t0 = Date.now();
const res = await runJobs<MatchOut>(jobs, { label: `역할 성분 ${jobs.length}경기` });
const rows = res.map((m, i) => {
  const { g, role, k, home } = meta[i]!;
  const team = home ? 0 : 1;
  const p = m.players.find((x) => x.team === team && x.starter && x.slot === GROUPS[g]!.slot)!;
  return {
    g, role, seed: seed0 + k, home,
    gf: home ? m.homeGoals : m.awayGoals, ga: home ? m.awayGoals : m.homeGoals,
    // 지문: 경기 결과·골 시각 (평점만 바꾸는 패치에서 같아야 한다)
    fp: `${m.homeGoals}-${m.awayGoals}@${m.goals.map((x) => x.t.toFixed(1)).join(',')}`,
    rating: p.rating, min: p.minutes, pos: p.position, dist: p.distance,
    ex: { blocks: p.blocks, clear: p.clearances, dClear: p.dangerClearances, tackleTry: p.tackles, dribPast: p.dribbledPast, dribFaced: p.dribblesFaced, aerialDuels: p.aerialDuels, received: p.received, passTry: p.passes, bigChances: p.bigChances, throughOk: p.throughCompleted, crossOk: p.crossesCompleted },
    parts: p.parts!,
  };
});
writeFileSync(out, JSON.stringify(rows));
console.log(`${jobs.length}경기 → ${out} (${((Date.now() - t0) / 60000).toFixed(1)}분)`);
process.exit(0);
