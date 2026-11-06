// 진단 (C.81u): c81u-role-cond 성분으로 조건별 역할 − 군 평균 평점 차(전·후)를 표로, 조건을 모은 표본으로 roleCenter 를 다시 맞춘다.
// 실행: npx vite-node scripts/diag/c81u-role-fit.ts -- <성분.json ...>
//  env RJSON = ENGINE.rating 덮어쓰기(JSON), FIT=1 → 조건 평균(조건마다 같은 무게)으로 roleCenter 를 다시 맞춰 출력, OLD=1 → 새 칸 가중 0(전 식)
import { readFileSync } from 'node:fs';
import { ENGINE } from '../../src/engine/config';
import { isNoContrib, ratingFromParts, type RatingParts } from '../../src/engine/rating';

type Row = { c: string; g: string; role: string; seed: number; min: number; parts: RatingParts };
const files = process.argv.slice(2).filter((a) => a !== '--');
const rows = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as Row[])
  .map((r) => ({ ...r, c: r.c ?? 'base', p: { ...r.parts, role: r.role, ...(r.g === 'ST' && ['f442', 'f352', 'f4312'].includes(r.c) ? { mates: 2 } : {}), ...(r.g === 'ST' && r.c === 'f4231' ? { ctx: 'cam' } : {}), ...(r.g === 'CDM' && r.c === 'f352' ? { ctx: 'cb3' } : {}), ...(r.min >= 45 && isNoContrib(r.parts) ? { noContrib: 1 } : {}) } as RatingParts }));
type R_ = typeof ENGINE.rating;
let R: R_ = { ...ENGINE.rating, ...(process.env.RJSON ? JSON.parse(process.env.RJSON) : {}) };
if (process.env.OLD) R = { ...R, pressWon: 0, offsideWon: 0, lineMin: 0 };
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => { const m = avg(xs); return Math.sqrt(avg(xs.map((x) => (x - m) ** 2))); };
const conds = [...new Set(rows.map((r) => r.c))];
const groups = [...new Set(rows.map((r) => r.g))];
/** 조건·군 → 역할 차 (짝: 같은 시드 군 평균을 빼서 잡음을 줄인다) */
function diffs(Rx: R_) {
  const out = new Map<string, { d: number; se: number }>(); // `${c}|${role}`
  for (const c of conds) for (const g of groups) {
    const xs = rows.filter((r) => r.c === c && r.g === g);
    if (!xs.length) continue;
    const roles = [...new Set(xs.map((r) => r.role))];
    const bySeed = new Map<number, Map<string, number>>();
    for (const r of xs) { if (!bySeed.has(r.seed)) bySeed.set(r.seed, new Map()); bySeed.get(r.seed)!.set(r.role, ratingFromParts(r.p, Rx)); }
    const seeds = [...bySeed.values()].filter((m) => m.size === roles.length);
    for (const role of roles) {
      const ds = seeds.map((m) => m.get(role)! - avg([...m.values()]));
      out.set(`${c}|${role}`, { d: avg(ds), se: sd(ds) / Math.sqrt(ds.length) });
    }
  }
  return out;
}
const before = diffs(R);
const roleG = new Map(rows.map((r) => [r.role, r.g]));
let after = before;
if (process.env.FIT) {
  const rc: Record<string, number> = { ...R.roleCenter };
  // 문맥별 조건 묶음 (C.81u2): 군 → { 문맥 키: 조건 목록 }. 문맥 조건은 기본 값 맞춤에서 뺀다
  const CTX: Record<string, Record<string, string[]>> = process.env.PAIR ? { ST: { '2': ['f442', 'f352', 'f4312'], ...(process.env.CTX ? { cam: ['f4231'] } : {}) }, ...(process.env.CTX ? { CDM: { cb3: ['f352'] } } : {}) } : {};
  for (const [role, g] of roleG) {
    const ctxs = CTX[g] ?? {};
    const inCtx = new Set(Object.values(ctxs).flat());
    const ds = conds.filter((c) => !inCtx.has(c)).map((c) => before.get(`${c}|${role}`)).filter((x) => x).map((x) => x!.d);
    rc[role] = Math.round(((R.roleCenter[role] ?? 0) + avg(ds) / R.scale) * 100) / 100;
    for (const [k, cs] of Object.entries(ctxs)) {
      const dp = cs.filter((c) => conds.includes(c)).map((c) => before.get(`${c}|${role}`)).filter((x) => x).map((x) => x!.d);
      if (dp.length) rc[`${role}@${k}`] = Math.round(((R.roleCenter[`${role}@${k}`] ?? R.roleCenter[role] ?? 0) + avg(dp) / R.scale) * 100) / 100;
    }
  }
  R = { ...R, roleCenter: rc };
  after = diffs(R);
  console.log('roleCenter ' + JSON.stringify(rc));
}
const fmt = (x?: { d: number; se: number }) => (x ? `${x.d >= 0 ? '+' : ''}${x.d.toFixed(2)}` : '');
console.log(`| 군 | 역할 | ${conds.join(' | ')} | 조건 평균 |`);
for (const [role, g] of roleG) {
  const cs = conds.map((c) => { const b = before.get(`${c}|${role}`), a = after.get(`${c}|${role}`); return b ? (process.env.FIT ? `${fmt(b)} → ${fmt(a)}` : fmt(b)) : '—'; });
  const pa = avg(conds.map((c) => after.get(`${c}|${role}`)).filter((x) => x).map((x) => x!.d));
  console.log(`| ${g} | ${role} | ${cs.join(' | ')} | ${pa >= 0 ? '+' : ''}${pa.toFixed(2)} |`);
}
for (const [lab, m] of [['전', before], ['후', after]] as const) {
  const v = [...m.values()];
  const mx = v.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
  const z = v.filter((x) => Math.abs(x.d) > 0.15 && Math.abs(x.d) - 0.15 > 2 * x.se).length;
  console.log(`${lab}: 칸 ${v.length} 최대 |차| ${Math.abs(mx.d).toFixed(2)} (SE ${mx.se.toFixed(2)}) · 0.15 넘는 칸 ${v.filter((x) => Math.abs(x.d) > 0.15).length} · SE 2배 넘게 0.15 밖 ${z} · 평균 SE ${avg(v.map((x) => x.se)).toFixed(3)}`);
}
process.exit(0);
