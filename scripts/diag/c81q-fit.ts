// C.81q 맞춤: 같은 시드 새 게임 다른 리그 빠른 진행 한 시즌의 리그 묶음 × 포지션군 골·도움 평균 · 리그 상위 10 을 엔진(c81q-engine.ts JSON)에 맞춘다.
// 포지션 가중은 곱셈 고정점 반복, ovrK · ovrKAssist · assistChance 는 상위 10 · 총 도움으로. 실행: npx vite-node scripts/diag/c81q-fit.ts -- <engine.json> [reps=2] [iters=6]
import { readFileSync } from 'node:fs';
import { newGame, playRound, startNextSeason, type GameState } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { buildResumes } from '../../src/awards';
import { BALANCE } from '../../src/config/balance';
import { finishOtherSeason, resetScorerPool, type OtherLeague } from '../../src/otherLeagues';
import { DEFAULT_LEAGUES } from '../../data/leagues';

const args = process.argv.slice(2).filter((a) => a !== '--');
const eng = JSON.parse(readFileSync(args[0]!, 'utf8')) as { pid: string; s: number; my: string; rs: { lg: string; group: string; goals: number; assists: number }[] }[];
const reps = Number(args[1] ?? 2);
const iters = Number(args[2] ?? 6);
/** seasons > 0: 새 게임 하네스 대신 전부 빠른 진행으로 실제 시즌을 seasons 개 치른 이력서 (시즌 중 이적·로스터 변화 포함) */
const seasons = Number(args[3] ?? 0);
const MAJOR = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const cat = (lg: string) => (MAJOR.includes(lg) ? lg : 'rest');
const G = ['CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const mean = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : NaN);
type Row = { lg: string; group: string; goals: number; assists: number };
function agg(runs: { rs: Row[] }[]) {
  const cell: Record<string, { g: number[]; a: number[] }> = {};
  const grp: Record<string, { g: number[]; a: number[] }> = {};
  const top: Record<string, { g: number[]; a: number[] }> = {};
  let tg = 0; let ta = 0;
  for (const r of runs) {
    const byLg: Record<string, Row[]> = {};
    for (const x of r.rs) {
      const k = `${cat(x.lg)}:${x.group}`;
      (cell[k] ??= { g: [], a: [] }).g.push(x.goals); cell[k]!.a.push(x.assists);
      (grp[x.group] ??= { g: [], a: [] }).g.push(x.goals); grp[x.group]!.a.push(x.assists);
      (byLg[x.lg] ??= []).push(x); tg += x.goals; ta += x.assists;
    }
    for (const [lg, xs] of Object.entries(byLg)) {
      const T = (top[cat(lg)] ??= { g: [], a: [] });
      T.g.push(mean(xs.map((x) => x.goals).sort((a, b) => b - a).slice(0, 10)));
      T.a.push(mean(xs.map((x) => x.assists).sort((a, b) => b - a).slice(0, 10)));
    }
  }
  return { cell, grp, top, ar: ta / tg };
}
const E = agg(eng);
const pids = [...new Set(eng.map((e) => e.pid))];
const games: { g: GameState; my: string; init: string }[] = [];
for (const pid of pids) for (let r = 0; r < reps; r++) {
  const g: GameState = newGame({ mode: 'real', playerId: pid, seed: `c81m-a-${pid}${r ? `-r${r}` : ''}`, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
  games.push({ g, my: (g.league as { id: string }).id, init: JSON.stringify(g.otherLeagues) });
}
const C = BALANCE.otherScorers as unknown as { scorerWeight: Record<string, number>; assistWeight: Record<string, number>; assistChance: number; share: number[]; ovrK: number; ovrKAssist: number };
function run() {
  resetScorerPool();
  if (seasons > 0) {
    const out: { rs: Row[] }[] = [];
    for (const pid of pids) for (let r = 0; r < reps; r++) {
      const g: GameState = newGame({ mode: 'real', playerId: pid, seed: `c81m-a-${pid}${r ? `-r${r}` : ''}`, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
      g.options = { ...(g.options ?? {}), others: 'quick' } as never;
      for (let s = 0; s < seasons && g.phase !== 'retired'; s++) {
        while (g.phase === 'season') { playRound(g, { engine: 'quick', others: 'quick' } as never); autoAllocate(g.player); }
        if (g.phase !== 'offseason') break;
        const my = (g.league as { id: string }).id;
        out.push({ rs: buildResumes(g).filter((x) => !x.me && x.lg !== my) as Row[] });
        if (s + 1 < seasons) startNextSeason(g);
      }
    }
    return agg(out);
  }
  return agg(games.map(({ g, my, init }) => {
    g.otherLeagues = JSON.parse(init) as OtherLeague[];
    for (const lg of g.otherLeagues) finishOtherSeason(g.worldSeed, lg, g.npcs);
    return { rs: buildResumes(g).filter((x) => !x.me && x.lg !== my) as Row[] };
  }));
}
function score(Q: ReturnType<typeof agg>) {
  let bad = 0; let n = 0; let sq = 0;
  const chk = (q: number, e: number) => { if (!(e > 0.5)) return; n++; const d = q / e - 1; sq += d * d; if (Math.abs(d) > 0.1) bad++; };
  for (const k of Object.keys(E.cell)) { if (!G.includes(k.split(':')[1]!)) continue; chk(mean(Q.cell[k]?.g ?? []), mean(E.cell[k]!.g)); chk(mean(Q.cell[k]?.a ?? []), mean(E.cell[k]!.a)); }
  for (const k of Object.keys(E.top)) { chk(mean(Q.top[k]?.g ?? []), mean(E.top[k]!.g)); chk(mean(Q.top[k]?.a ?? []), mean(E.top[k]!.a)); }
  return { bad, n, rms: Math.sqrt(sq / n) };
}
const topRatio = (Q: ReturnType<typeof agg>, w: 'g' | 'a') => mean(Object.keys(E.top).map((k) => mean(Q.top[k]![w]) / mean(E.top[k]![w])));
let Q = run();
console.error('start', JSON.stringify(score(Q)), JSON.stringify(C));
for (let it = 0; it < iters; it++) {
  // 포지션군 가중: 전체 포지션군 평균 비
  for (const g of G) {
    const rg = mean(E.grp[g]!.g) / mean(Q.grp[g]!.g); const ra = mean(E.grp[g]!.a) / mean(Q.grp[g]!.a);
    if (Number.isFinite(rg) && rg > 0) C.scorerWeight[g] = +(C.scorerWeight[g]! * rg ** 0.9).toFixed(3);
    if (Number.isFinite(ra) && ra > 0) C.assistWeight[g] = +(C.assistWeight[g]! * ra ** 0.9).toFixed(3);
  }
  C.assistChance = +Math.min(0.95, C.assistChance * (E.ar / Q.ar)).toFixed(3);
  Q = run();
  // 상위 10: ovrK 로 (쏠림)
  const tg = topRatio(Q, 'g'); const ta = topRatio(Q, 'a');
  C.ovrK = +(C.ovrK + Math.log(1 / tg) * 0.12).toFixed(4);
  C.ovrKAssist = +(C.ovrKAssist + Math.log(1 / ta) * 0.12).toFixed(4);
  Q = run();
  console.error(`it ${it}`, JSON.stringify(score(Q)), 'top', topRatio(Q, 'g').toFixed(3), topRatio(Q, 'a').toFixed(3), JSON.stringify(C));
}
console.log(JSON.stringify(C));
