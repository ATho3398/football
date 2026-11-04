// C.81d 다른 경기 계산 3단계가 시상에 주는 영향: 시즌 끝 발롱도르 기자단 종합 점수(노이즈 없음, powerRanking 과 같은 식) 상위 30·10 의 리그 분포,
// 리그별 득점왕 골 · 이력서 평균(평점 rat · 기록 out) · 추정 기록 비율. 내 리그(PL) 엔진 기록 + 다른 리그 추정 기록이 한쪽으로 쏠리는지 본다.
// 실행: npx vite-node scripts/diag/c81d-awards.ts -- [mode=mine|all|quick] [careers=2] [seasons=1] [seedTag=a]
import { newGame, playRound, type GameState } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { buildResumes, eligible } from '../../src/awards';
import { BALANCE } from '../../src/config/balance';
import { DEFAULT_LEAGUES } from '../../data/leagues';

const args = process.argv.slice(2).filter((a) => a !== '--');
const mode = (args[0] ?? 'mine') as 'mine' | 'all' | 'quick';
const careers = Number(args[1] ?? 2);
const seasons = Number(args[2] ?? 1);
const tag = args[3] ?? 'a';
const how = mode === 'all' ? 'engine' : mode;
const KEYS = ['out', 'rat', 'def', 'tro', 'nat', 'clu', 'sto', 'fam', 'tal'] as const;
const def = BALANCE.awards.defs.ballonDor!;
const jw = (def as { wj?: Record<string, Record<string, number>> }).wj?.journalist ?? def.w ?? BALANCE.awards.juries.journalist.w;
const top30: Record<string, number> = {};
const top10: Record<string, number> = {};
const top1: Record<string, number> = {};
const lgAgg: Record<string, { n: number; rat: number; out: number; est: number; boot: number; seasons: number; avg: number }> = {};
const t0 = Date.now();
for (let c = 0; c < careers; c++) {
  const g: GameState = newGame({ mode: 'real', playerId: 'salah', seed: `c81d-aw-${tag}-${c}`, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
  g.options = { others: mode };
  for (let s = 0; s < seasons && g.phase !== 'retired'; s++) {
    while (g.phase === 'season') { playRound(g, { engine: 'quick', others: how }); autoAllocate(g.player); }
    if (g.phase !== 'offseason') break;
    const pool = buildResumes(g).filter((r) => eligible(def, r));
    const stat = (k: (typeof KEYS)[number]) => {
      const xs = pool.map((r) => r[k]);
      const m = xs.reduce((t, x) => t + x, 0) / xs.length;
      return [m, Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / xs.length) || 1] as const;
    };
    const st = Object.fromEntries(KEYS.map((k) => [k, stat(k)]));
    const score = (r: (typeof pool)[number]) => KEYS.reduce((t, k) => t + (jw[k] ?? 0) * (r[k] - st[k]![0]) / st[k]![1], 0);
    const sorted = pool.map((r) => ({ r, x: score(r) })).sort((a, b) => b.x - a.x);
    sorted.slice(0, 30).forEach(({ r }, k) => {
      top30[r.lg] = (top30[r.lg] ?? 0) + 1;
      if (k < 10) top10[r.lg] = (top10[r.lg] ?? 0) + 1;
      if (k === 0) top1[r.lg] = (top1[r.lg] ?? 0) + 1;
    });
    const byLg = new Map<string, typeof pool>();
    for (const r of pool) byLg.set(r.lg, [...(byLg.get(r.lg) ?? []), r]);
    for (const [lg, rs] of byLg) {
      const A = (lgAgg[lg] ??= { n: 0, rat: 0, out: 0, est: 0, boot: 0, seasons: 0, avg: 0 });
      A.n += rs.length; A.seasons++;
      for (const r of rs) { A.rat += r.rat; A.out += r.out; A.est += r.est ? 1 : 0; A.avg += r.avg; }
      A.boot += Math.max(...rs.map((r) => r.goals));
    }
    console.error(`career ${c} season ${s} done ${((Date.now() - t0) / 1000).toFixed(0)}s top3 ${sorted.slice(0, 3).map(({ r }) => `${r.name}(${r.lg})`).join(' ')}`);
    // 다음 시즌 (seasons > 1)
    if (s + 1 < seasons) {
      const { startNextSeason } = await import('../../src/game');
      startNextSeason(g);
    }
  }
}
const lgs = Object.keys(lgAgg).sort();
console.log(JSON.stringify({
  mode, careers, seasons, tag, sec: Math.round((Date.now() - t0) / 1000), top30, top10, top1,
  lg: Object.fromEntries(lgs.map((lg) => { const A = lgAgg[lg]!; return [lg, { cand: +(A.n / A.seasons).toFixed(0), rat: +(A.rat / A.n).toFixed(2), out: +(A.out / A.n).toFixed(2), avg: +(A.avg / A.n).toFixed(2), est: +(A.est / A.n).toFixed(2), boot: +(A.boot / A.seasons).toFixed(1) }]; })),
}));
