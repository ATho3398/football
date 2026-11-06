// 진단 (C.81u, 역할 평점 2): c81r-role-parts 를 조건별로 — 대형(4-4-2 · 3-5-2 · 4-2-3-1 · 4-3-1-2) · 전력(±5) · 전술(게겐 · 블록 · 직선)에서
// 같은 슬롯 역할만 바꾼 짝(홈/원정 반씩)의 추적 선수 평점 성분을 저장한다. 평점은 경기 행동에 안 쓰이므로 성분으로 가중·roleCenter 를 다시 계산한다(c81u-role-fit.ts).
// 실행: npx vite-node scripts/diag/c81u-role-cond.ts -- <역할당 경기> <출력.json> <시작 시드> <조건,...> [포지션군 ...]
// 조건: base · f442 · f352 · f4231 · f4312 · s+5 · s-5 · gegenpress · block · direct
import { writeFileSync } from 'node:fs';
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { ROLE_OPTIONS } from '../../src/engine/roles';
import type { Formation } from '../../src/formations';
import type { Tendency } from '../../src/engine/types';

type Slot = { formation: Formation; slot: number };
export const BASE: Record<string, Slot> = {
  WING: { formation: '4-3-3', slot: 8 }, ST: { formation: '4-3-3', slot: 9 }, CAM: { formation: '4-2-3-1', slot: 8 },
  CM: { formation: '4-3-3', slot: 6 }, CDM: { formation: '4-3-3', slot: 5 }, FB: { formation: '4-3-3', slot: 1 }, CB: { formation: '4-3-3', slot: 2 },
};
/** 대형별 군 슬롯 (그 대형에 군이 없으면 조건에서 빠진다) */
export const FORM: Record<string, Record<string, number>> = {
  '4-4-2': { WING: 8, CM: 6, ST: 9, FB: 1, CB: 2 },
  '3-5-2': { CB: 2, FB: 4, CM: 5, CDM: 6, ST: 9 },
  '4-2-3-1': { CDM: 5, WING: 9, ST: 10, FB: 1, CB: 2 },
  '4-3-1-2': { CAM: 8, CM: 6, CDM: 5, ST: 9 },
};
const F: Record<string, Formation> = { f442: '4-4-2', f352: '3-5-2', f4231: '4-2-3-1', f4312: '4-3-1-2' };

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 100);
const out = args[1] ?? 'c81u-role-cond.json';
const seed0 = Number(args[2] ?? 81000);
const conds = (args[3] ?? 'base').split(',');
const groups = args.slice(4).map((g) => g.toUpperCase());
const use = groups.length ? groups : Object.keys(BASE);
const jobs: MatchJob[] = [];
const meta: { c: string; g: string; role: string; k: number; home: boolean; slot: number }[] = [];
for (const c of conds) for (const g of use) {
  let G: Slot | null = BASE[g]!;
  if (F[c]) { const sl = FORM[F[c]!]![g]; G = sl === undefined ? null : { formation: F[c]!, slot: sl }; }
  if (!G) continue;
  const rating = c === 's+5' ? 80 : c === 's-5' ? 70 : 75;
  // 전술 조건은 성향만 바꾼다(job.ts 가 성향 기본값을 채운다). 상대는 균형
  const tac = c === 'gegenpress' || c === 'block' || c === 'direct' ? { tendency: c as Tendency } : 'balanced';
  for (const role of ROLE_OPTIONS[g]!) for (let k = 0; k < n; k++) {
    const seed = seed0 + k;
    const me = { ...std('a', seed, rating, G.formation, tac), roles: { [G.slot]: role } };
    const op = std('b', seed, 75, G.formation, 'balanced');
    const home = k % 2 === 0;
    jobs.push({ kind: 'match', seed, neutral: true, parts: true, home: home ? me : op, away: home ? op : me });
    meta.push({ c, g, role, k, home, slot: G.slot });
  }
}
const t0 = Date.now();
const res = await runJobs<MatchOut>(jobs, { label: `조건 역할 성분 ${jobs.length}경기` });
const rows = res.map((m, i) => {
  const { c, g, role, k, home, slot } = meta[i]!;
  const team = home ? 0 : 1;
  const p = m.players.find((x) => x.team === team && x.starter && x.slot === slot)!;
  return {
    c, g, role, seed: seed0 + k, home,
    fp: `${m.homeGoals}-${m.awayGoals}@${m.goals.map((x) => x.t.toFixed(1)).join(',')}`,
    rating: p.rating, min: p.minutes, parts: p.parts!,
  };
});
writeFileSync(out, JSON.stringify(rows));
console.log(`${jobs.length}경기 → ${out} (${((Date.now() - t0) / 60000).toFixed(1)}분)`);
process.exit(0);
