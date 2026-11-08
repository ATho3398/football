// C.81q 확인: c81m-run 시즌 끝 저장본으로 발롱도르 후보(기자단 종합 점수, 노이즈 없음) 상위 10·30 · 골든부츠(골 × bootCoef) 1위·상위 10 의
// 내 리그 인원 (시즌당), 리그별 분포. 모드(all = 전부 엔진 / mine = 내 리그만 엔진)별.
// 실행: npx vite-node scripts/diag/c81q-awards.ts -- <snapDir> [maxSeason=99]
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes, eligible } from '../../src/awards';
import { BALANCE } from '../../src/config/balance';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const maxS = Number(args[1] ?? 99);
const KEYS = ['out', 'rat', 'def', 'tro', 'nat', 'clu', 'sto', 'fam', 'tal'] as const;
const def = BALANCE.awards.defs.ballonDor!;
const boot = BALANCE.awards.defs.goldenBoot!;
const jw = (def as { wj?: Record<string, Record<string, number>> }).wj?.journalist ?? def.w ?? BALANCE.awards.juries.journalist.w;
const MAJOR = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const cat = (lg: string) => (MAJOR.includes(lg) ? lg : 'rest');
const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : NaN);
type Acc = { n: number; b10: number[]; b30: number[]; g1: number[]; g10: number[]; lgB10: Record<string, number>; lgG1: Record<string, number>; tro: number[]; troO: number[] };
const acc: Record<string, Acc> = {};
for (const f of readdirSync(dir).filter((f) => /^(all|mine)-.*-s\d+\.json$/.test(f)).sort()) {
  const m = /^(all|mine)-(\w+?)-(\w+)-s(\d+)\.json$/.exec(f)!;
  if (Number(m[4]) > maxS) continue;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  const rs = buildResumes(g).filter((r) => !r.me);
  const pool = rs.filter((r) => eligible(def, r));
  const st = Object.fromEntries(KEYS.map((k) => { const xs = pool.map((r) => r[k]); const mu = mean(xs); return [k, [mu, Math.sqrt(mean(xs.map((x) => (x - mu) ** 2))) || 1]]; })) as Record<string, number[]>;
  const bal = pool.map((r) => ({ r, x: KEYS.reduce((t, k) => t + (jw[k] ?? 0) * (r[k] - st[k]![0]!) / st[k]![1]!, 0) })).sort((a, b) => b.x - a.x).map((x) => x.r);
  const bp = rs.filter((r) => eligible(boot, r) && r.goals > 0).map((r) => ({ r, p: r.goals * BALANCE.awards.bootCoef[r.lg]! })).sort((a, b) => b.p - a.p).map((x) => x.r);
  for (const key of [m[1]!, `${m[1]}:${my}`]) {
    const A = (acc[key] ??= { n: 0, b10: [], b30: [], g1: [], g10: [], lgB10: {}, lgG1: {}, tro: [], troO: [] });
    A.n++;
    A.b10.push(bal.slice(0, 10).filter((r) => r.lg === my).length);
    A.b30.push(bal.slice(0, 30).filter((r) => r.lg === my).length);
    A.g1.push(bp[0]?.lg === my ? 1 : 0);
    A.g10.push(bp.slice(0, 10).filter((r) => r.lg === my).length);
    for (const r of bal.slice(0, 10)) A.lgB10[r.lg === my ? '내 리그' : cat(r.lg)] = (A.lgB10[r.lg === my ? '내 리그' : cat(r.lg)] ?? 0) + 1;
    if (bp[0]) A.lgG1[bp[0].lg === my ? '내 리그' : cat(bp[0].lg)] = (A.lgG1[bp[0].lg === my ? '내 리그' : cat(bp[0].lg)] ?? 0) + 1;
    // 이름값 상위 30 우승 점수: 내 리그 / 다른 리그 평균
    const byLg: Record<string, typeof pool> = {};
    for (const r of pool) (byLg[r.lg] ??= []).push(r);
    for (const [lg, xs] of Object.entries(byLg)) for (const r of [...xs].sort((a, b) => b.fam - a.fam).slice(0, 30)) (lg === my ? A.tro : A.troO).push(r.tro);
  }
}
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
console.log('| 모드 | 시즌 | 발롱 상위10 내 리그 | 상위30 내 리그 | 골든부츠 1위 내 리그 비율 | 부츠 상위10 내 리그 | 이름값30 우승 점수 내/다른 | 발롱 상위10 리그 분포(시즌당) | 골든부츠 1위 리그 |\n|---|---|---|---|---|---|---|---|---|');
for (const [k, A] of Object.entries(acc).sort()) {
  const dist = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${f2(n / A.n)}`).join(' · ');
  console.log(`| ${k} | ${A.n} | ${f2(mean(A.b10))} | ${f2(mean(A.b30))} | ${f2(mean(A.g1))} | ${f2(mean(A.g10))} | ${f2(mean(A.tro))} / ${f2(mean(A.troO))} | ${dist(A.lgB10)} | ${dist(A.lgG1)} |`);
}
