// C.81m 분석: c81m-run.ts 시즌 끝 저장본으로 '전부 엔진' 대 '내 리그만 엔진' 이력서(시상 후보 풀) 평점·골·도움을 리그·포지션군별로,
// 포지션군별 상위 20명 평점, 발롱도르 기자단 종합 점수(노이즈 없음) 상위 10·30 리그 비율을 비교한다.
// 실행: npx vite-node scripts/diag/c81m-analyze.ts -- <snapDir> [maxSeason=99] [cfg JSON: {"shift":{...},"spread":1}]
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes, eligible } from '../../src/awards';
import { BALANCE } from '../../src/config/balance';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const maxS = Number(args[1] ?? 99);
const cfg = args[2] ? JSON.parse(args[2]) as { shift?: Record<string, number>; spread?: Record<string, number>; jitter?: Record<string, number>; def?: number } : null;
const E = BALANCE.awards.estimate as { mixedShift: Record<string, number>; mixedSpread: Record<string, number>; mixedJitter: Record<string, number>; mixedDef: number };
if (cfg?.shift) Object.assign(E.mixedShift, cfg.shift);
if (cfg?.spread) Object.assign(E.mixedSpread, cfg.spread);
if (cfg?.jitter) Object.assign(E.mixedJitter, cfg.jitter);
if (cfg?.def !== undefined) E.mixedDef = cfg.def;
const GROUPS = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const MAJOR = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const lgCat = (lg: string) => (MAJOR.includes(lg) ? lg : 'rest');
const KEYS = ['out', 'rat', 'def', 'tro', 'nat', 'clu', 'sto', 'fam', 'tal'] as const;
const def = BALANCE.awards.defs.ballonDor!;
const jw = (def as { wj?: Record<string, Record<string, number>> }).wj?.journalist ?? def.w ?? BALANCE.awards.juries.journalist.w;

type Snap = { mode: string; pid: string; s: number; my: string; rs: ReturnType<typeof buildResumes> };
const snaps: Snap[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const m = /^(all|mine)-(\w+?)-(\w+)-s(\d+)\.json$/.exec(f.replace(/-van-/, '-van_'));
  if (!m) continue;
  const s = Number(m[4]);
  if (s > maxS) continue;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  snaps.push({ mode: m[1]!, pid: m[2]!, s, my: (g.league as { id: string }).id, rs: buildResumes(g) });
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : NaN);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
// 1. 리그 묶음 × 포지션군: 평균 평점 · 시즌 골 · 도움 (전부 엔진 = all 저장본 전 리그 / 내 리그만 = mine 저장본에서 내 리그가 아닌 리그(추정))
const cell = (mode: string, pred: (lg: string, r: Snap['rs'][number], sn: Snap) => boolean) => {
  const xs = snaps.filter((sn) => sn.mode === mode).flatMap((sn) => sn.rs.filter((r) => !r.me && pred(r.lg, r, sn)));
  return xs;
};
const out: Record<string, unknown> = { cfg, n: { all: snaps.filter((s) => s.mode === 'all').length, mine: snaps.filter((s) => s.mode === 'mine').length } };
const rows: string[] = [];
for (const cat of [...MAJOR, 'rest']) {
  for (const gp of [...GROUPS, '전체']) {
    const a = cell('all', (lg, r) => lgCat(lg) === cat && (gp === '전체' || r.group === gp));
    const b = cell('mine', (lg, r, sn) => lg !== sn.my && lgCat(lg) === cat && (gp === '전체' || r.group === gp));
    rows.push(`| ${cat} | ${gp} | ${a.length} / ${b.length} | ${f2(mean(a.map((r) => r.avg)))} | ${f2(mean(b.map((r) => r.avg)))} | ${f2(mean(b.map((r) => r.avg)) - mean(a.map((r) => r.avg)))} | ${f2(mean(a.map((r) => r.goals)))} / ${f2(mean(b.map((r) => r.goals)))} | ${f2(mean(a.map((r) => r.assists)))} / ${f2(mean(b.map((r) => r.assists)))} |`);
  }
}
console.log('| 리그 | 군 | 인원 엔진/추정 | 평점 엔진 | 평점 추정 | 차 | 골 엔진/추정 | 도움 엔진/추정 |\n|---|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
// 2. 포지션군 전체(추정 리그) 평균 · 상위 20명 평균: mine 저장본마다 내 리그 뺀 풀, all 은 같은 리그 묶음(내 리그 X 뺀 것)으로 맞춤
const top = (xs: number[], n: number) => mean([...xs].sort((a, b) => b - a).slice(0, n));
const g2: string[] = [];
const gsum: Record<string, { dm: number; dt: number; am: number; at: number; em: number; et: number }> = {};
for (const gp of [...GROUPS, '전체']) {
  const dm: number[] = []; const dt: number[] = []; const em: number[] = []; const et: number[] = []; const am: number[] = []; const at: number[] = [];
  for (const sn of snaps.filter((x) => x.mode === 'mine')) {
    const est = sn.rs.filter((r) => !r.me && r.lg !== sn.my && (gp === '전체' || r.group === gp)).map((r) => r.avg);
    // 같은 리그 묶음의 엔진 값: all 저장본 (같은 시즌 번호가 있으면 그것, 없으면 모든 all 저장본 평균)
    const alls = snaps.filter((x) => x.mode === 'all' && x.s === sn.s);
    const pool = (alls.length ? alls : snaps.filter((x) => x.mode === 'all'));
    const engM = mean(pool.map((x) => mean(x.rs.filter((r) => !r.me && r.lg !== sn.my && (gp === '전체' || r.group === gp)).map((r) => r.avg))));
    const engT = mean(pool.map((x) => top(x.rs.filter((r) => !r.me && r.lg !== sn.my && (gp === '전체' || r.group === gp)).map((r) => r.avg), 20)));
    em.push(mean(est)); et.push(top(est, 20)); am.push(engM); at.push(engT);
    dm.push(mean(est) - engM); dt.push(top(est, 20) - engT);
  }
  gsum[gp] = { dm: mean(dm), dt: mean(dt), am: mean(am), at: mean(at), em: mean(em), et: mean(et) } as never;
  g2.push(`| ${gp} | ${f2(mean(am))} | ${f2(mean(em))} | ${f2(mean(dm))} | ${f2(mean(at))} | ${f2(mean(et))} | ${f2(mean(dt))} |`);
}
console.log('\n| 군 | 평균 엔진 | 평균 추정 | 차 | 상위20 엔진 | 상위20 추정 | 차 |\n|---|---|---|---|---|---|---|');
console.log(g2.join('\n'));
out.gsum = gsum;
// 2b. 포지션군별 평점 ~ OVR 회귀 (엔진 = all 저장본 모든 리그, 추정 = mine 저장본 다른 리그): 기울기 · 잔차 표준편차 · 평균 (ovr = tal − (21 − 나이) × talentAge)
const ovrOf = (r: Snap['rs'][number]) => (r.age === null ? r.tal : r.tal - (21 - r.age) * BALANCE.awards.resume.talentAge);
const reg = (xs: [number, number][]) => {
  const mx = mean(xs.map((p) => p[0])); const my = mean(xs.map((p) => p[1]));
  const b = xs.reduce((t, p) => t + (p[0] - mx) * (p[1] - my), 0) / xs.reduce((t, p) => t + (p[0] - mx) ** 2, 0);
  const r = Math.sqrt(mean(xs.map((p) => (p[1] - my - b * (p[0] - mx)) ** 2)));
  return { b, r, mx, my };
};
const regs: Record<string, unknown> = {};
const g3: string[] = [];
for (const gp of GROUPS) {
  const e = reg(snaps.filter((x) => x.mode === 'all').flatMap((x) => x.rs.filter((r) => !r.me && r.group === gp).map((r) => [ovrOf(r), r.avg] as [number, number])));
  const y = reg(snaps.filter((x) => x.mode === 'mine').flatMap((x) => x.rs.filter((r) => !r.me && r.lg !== x.my && r.group === gp).map((r) => [ovrOf(r), r.avg] as [number, number])));
  regs[gp] = { e, y };
  g3.push(`| ${gp} | ${e.b.toFixed(3)} / ${y.b.toFixed(3)} | ${f2(e.r)} / ${f2(y.r)} | ${f2(e.mx)} / ${f2(y.mx)} | ${f2(e.my)} / ${f2(y.my)} |`);
}
console.log('\n| 군 | 기울기 엔진/추정 | 잔차 sd 엔진/추정 | OVR 평균 엔진/추정 | 평점 평균 엔진/추정 |\n|---|---|---|---|---|');
console.log(g3.join('\n'));
out.regs = regs;
// 3. 발롱도르 후보 (기자단 종합 점수, 노이즈 없음) 상위 10·30 리그 비율
const ballon = (sn: Snap) => {
  const pool = sn.rs.filter((r) => eligible(def, r));
  const st = Object.fromEntries(KEYS.map((k) => {
    const xs = pool.map((r) => r[k]); const m = mean(xs);
    return [k, [m, Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1]];
  })) as Record<string, number[]>;
  return pool.map((r) => ({ r, x: KEYS.reduce((t, k) => t + (jw[k] ?? 0) * (r[k] - st[k]![0]!) / st[k]![1]!, 0) })).sort((a, b) => b.x - a.x);
};
const share: Record<string, { t10: Record<string, number>; t30: Record<string, number>; n: number }> = {};
for (const sn of snaps) {
  const top = ballon(sn).slice(0, 30);
  for (const key of sn.mode === 'all' ? ['all', `all:${sn.my}`] : [`mine:${sn.my}`]) {
    const S = (share[key] ??= { t10: {}, t30: {}, n: 0 });
    S.n++;
    top.forEach(({ r }, k) => { const c = lgCat(r.lg); S.t30[c] = (S.t30[c] ?? 0) + 1; if (k < 10) S.t10[c] = (S.t10[c] ?? 0) + 1; });
  }
}
console.log('\n| 발롱도르 후보 | 시즌 | ' + [...MAJOR, 'rest'].map((c) => `${c} 10/30`).join(' | ') + ' |\n|---|---|' + [...MAJOR, 'rest'].map(() => '---').join('|') + '|');
for (const [k, S] of Object.entries(share).sort()) console.log(`| ${k} | ${S.n} | ` + [...MAJOR, 'rest'].map((c) => `${f2((S.t10[c] ?? 0) / S.n)} / ${f2((S.t30[c] ?? 0) / S.n)}`).join(' | ') + ' |');
out.share = share;
console.log('\nJSON ' + JSON.stringify(out));
// 4. 리그마다 이름값(fam) 상위 30명의 이력서 항목 평균: 내 리그 / 다른 리그 × 모드 (쏠림 원인 — 우승 tro · 챔스 ucl · 실점 def · 기록 out · 평점 rat)
const famAcc: Record<string, Record<string, number[]>> = {};
for (const sn of snaps) {
  const pool = sn.rs.filter((r) => eligible(def, r) && !r.me);
  const byLg: Record<string, typeof pool> = {};
  for (const r of pool) (byLg[r.lg] ??= []).push(r);
  for (const r of Object.values(byLg).flatMap((rs) => [...rs].sort((a, b) => b.fam - a.fam).slice(0, 30))) {
    const A = (famAcc[`${sn.mode}:${r.lg === sn.my ? '내 리그' : '다른 리그'}`] ??= {});
    for (const x of ['share', 'tro', 'ucl', 'def', 'out', 'rat', 'goals', 'avg'] as const) (A[x] ??= []).push(r[x]);
  }
}
console.log('\n| 이름값 상위 30 | 인원 | 출전 비중 | 우승 tro | 챔스 ucl | 실점 def | 기록 out | 평점 rat | 골 | 평점 |\n|---|---|---|---|---|---|---|---|---|---|');
for (const [k, A] of Object.entries(famAcc).sort()) console.log(`| ${k} | ${A.share!.length} | ` + ['share', 'tro', 'ucl', 'def', 'out', 'rat', 'goals', 'avg'].map((x) => f2(mean(A[x]!))).join(' | ') + ' |');
