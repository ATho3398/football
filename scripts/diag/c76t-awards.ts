// C.76t (47b) 리그 · 시즌 중 상 현실감 측정: 커리어 여러 개 × 시즌 n, 빠른 진행(추정 기록) 또는 엔진(다른 경기 엔진), 기본 6개 리그.
// 리그 올해의 선수가 리그 상위 팀 주력 · 득점왕과 대체로 맞는지, 올해의 팀 포지션 · 팀 분포, 이달의 선수 분포, 내 수상.
// 실행: npx vite-node scripts/diag/c76t-awards.ts -- [careers=4] [seasons=10] [mode=quick|engine]
import { autoMarket, newGame, playRound, startNextSeason, type GameState } from '../../src/game';
import { autoAllocate, reputationTier, topAwardCount } from '../../src/growth';
import { sortedTable } from '../../src/league';
import { awardBase, awardKo, awardLeague, buildResumes } from '../../src/awards';
import { DEFAULT_LEAGUES } from '../../data/leagues';

const args = process.argv.slice(2).filter((a) => a !== '--');
const careers = Number(args[0] ?? 4);
const seasons = Number(args[1] ?? 10);
const mode = (args[2] ?? 'quick') as 'quick' | 'engine';
const leagues = [...DEFAULT_LEAGUES];

const SETUPS: { label: string; make: (i: number) => GameState }[] = [
  { label: '레전더리 유망주 ST', make: (i) => { const s = newGame({ mode: 'prospect', position: 'ST', seed: `c76t-leg-${i}`, difficulty: 'normal', leagues } as never); s.player.potentialTier = 'legendary'; return s; } },
  { label: '살라', make: (i) => newGame({ mode: 'real', playerId: 'salah', seed: `c76t-salah-${i}`, difficulty: 'normal', leagues } as never) },
  { label: '레전더리 유망주 CB', make: (i) => { const s = newGame({ mode: 'prospect', position: 'CB', seed: `c76t-legcb-${i}`, difficulty: 'normal', leagues } as never); s.player.potentialTier = 'legendary'; return s; } },
  { label: '보통 유망주 CM', make: (i) => newGame({ mode: 'prospect', position: 'CM', seed: `c76t-cm-${i}`, difficulty: 'normal', leagues } as never) },
];

type Acc = { n: number; top4: number; champ: number; topScorer: number; top3Scorer: number; group: Record<string, number>; me: number };
const poty: Record<string, Acc> = {};
const xiGroup: Record<string, Record<string, number>> = {};
const xiTop6: Record<string, [number, number]> = {};
let pfaFwaSame = 0, pfaFwaN = 0;
const potm = { n: 0, me: 0, maxSame: 0, scorerMonths: 0 };
const myLines: string[] = [];
const t0 = Date.now();
for (let c = 0; c < careers; c++) {
  const S = SETUPS[c % SETUPS.length]!;
  const state = S.make(c);
  for (let s = 0; s < seasons && state.phase !== 'retired'; s++) {
    while (state.phase === 'season') { playRound(state, { engine: 'quick', others: mode === 'engine' ? 'engine' : 'quick' }); autoAllocate(state.player); }
    autoAllocate(state.player);
    if (state.phase !== 'offseason') break;
    const y = state.globalAwards?.years.at(-1);
    if (y?.season === state.league.season) {
      const rs = buildResumes(state);
      const lgs = [state.league, ...(state.otherLeagues ?? [])];
      for (const k of Object.keys(y.res)) {
        const lg = awardLeague(k);
        const base = awardBase(k);
        const L = lgs.find((l) => l.id === lg);
        if (!lg || !L) continue;
        const rows = y.res[k]!;
        const table = sortedTable(L).map((r) => r.teamId);
        if (base === 'toty') {
          const G = (xiGroup.toty ??= {});
          for (const r of rows) G[r.p] = (G[r.p] ?? 0) + 1;
          const T = (xiTop6.toty ??= [0, 0]);
          T[0] += rows.filter((r) => table.indexOf(r.t) < 6).length; T[1] += rows.length;
          continue;
        }
        if (!['pfa', 'fwa', 'lgPoty'].includes(base)) continue;
        const w = rows[0];
        if (!w) continue;
        const A = (poty[base] ??= { n: 0, top4: 0, champ: 0, topScorer: 0, top3Scorer: 0, group: {}, me: 0 });
        A.n++;
        if (w.me) A.me++;
        A.group[w.p] = (A.group[w.p] ?? 0) + 1;
        const pos = table.indexOf(w.t);
        if (pos < 4) A.top4++;
        if (pos === 0) A.champ++;
        const sc = rs.filter((r) => r.lg === lg).sort((a, b) => b.goals - a.goals);
        if (sc[0]?.id === w.id) A.topScorer++;
        if (sc.slice(0, 3).some((r) => r.id === w.id)) A.top3Scorer++;
      }
      if (y.res['pfa@pl']?.[0] && y.res['fwa@pl']?.[0]) { pfaFwaN++; if (y.res['pfa@pl']![0]!.id === y.res['fwa@pl']![0]!.id) pfaFwaSame++; }
      const mine = Object.keys(y.res).filter((k) => (awardBase(k) === 'toty' || awardBase(k) === 'fifpro' ? y.res[k]!.some((r) => r.me) : y.res[k]![0]?.me) && y.shown.includes(k));
      if (mine.length) myLines.push(`${S.label}#${c} ${y.season}: ${mine.map((k) => awardKo(k, y.cont)).join(' · ')}`);
    }
    const ms = (state.globalAwards?.months ?? []).filter((m) => m.s === state.league.season);
    potm.n += ms.length;
    potm.me += ms.filter((m) => m.me).length;
    for (const lg of new Set(ms.map((m) => m.lg))) {
      const xs = ms.filter((m) => m.lg === lg);
      potm.maxSame = Math.max(potm.maxSame, ...xs.map((m) => xs.filter((z) => z.id === m.id).length));
    }
    autoMarket(state, 'best');
    startNextSeason(state);
  }
  // FIFPRO (12월 발표)까지
  for (let k = 0; k < 20 && state.phase === 'season'; k++) playRound(state, { engine: 'quick', others: 'quick' });
  for (const y of state.globalAwards?.years ?? []) {
    if (!y.shown.includes('fifpro')) continue;
    const G = (xiGroup.fifpro ??= {});
    for (const r of y.res.fifpro ?? []) G[r.p] = (G[r.p] ?? 0) + 1;
  }
  console.log(`${S.label}#${c} 끝 OVR ${state.player.history.at(-1)?.ovr} · 최고 개인상 ${topAwardCount(state.player.honors)} · 이달의 선수 ${state.globalAwards?.potm ?? 0} · 위상 ${state.player.reputation} ${reputationTier(state.player.reputation, state.player.honors)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log(`\n모드 ${mode} · 리그 ${leagues.join(',')} · 커리어 ${careers} × ${seasons}시즌`);
const pct = (a: number, b: number) => `${b ? Math.round((a / b) * 100) : 0}%`;
for (const [id, A] of Object.entries(poty)) {
  console.log(`${id.padEnd(7)} ${A.n}회 · 나 ${A.me} · 상위 4팀 ${pct(A.top4, A.n)} · 우승팀 ${pct(A.champ, A.n)} · 득점왕 ${pct(A.topScorer, A.n)} · 득점 3위 안 ${pct(A.top3Scorer, A.n)} · 포지션 ${Object.entries(A.group).map(([g, n]) => `${g} ${n}`).join(' ')}`);
}
console.log(`PFA = FWA 같은 수상자 ${pfaFwaSame}/${pfaFwaN}`);
for (const [id, G] of Object.entries(xiGroup)) console.log(`${id} 포지션 ${Object.entries(G).map(([g, n]) => `${g} ${n}`).join(' ')}${xiTop6[id] ? ` · 리그 상위 6팀 선수 ${pct(xiTop6[id]![0], xiTop6[id]![1])}` : ''}`);
console.log(`이달의 선수 ${potm.n}회 · 나 ${potm.me} · 한 시즌 한 리그 같은 선수 최다 ${potm.maxSame}회`);
console.log(myLines.join('\n'));
