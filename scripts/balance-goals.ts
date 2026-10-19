// 시즌 목표 달성률·카드 선택권 속도 (부록 C.65): 가상 유망주·실제 선수 커리어를 빠른 경기로 돌려 요약 몇 줄만 찍는다.
// npm run balance:goals -- [커리어 수=16] [시즌=4]
import { autoMarket, newGame, playRound, selectableRealPlayers, startNextSeason, type GameState } from '../src/game';
import { autoAllocate } from '../src/growth';
import { cardById } from '../src/config/cards';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { setEnvironmentFixed } from '../src/weather';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);

const careers = Math.min(40, Number(process.argv[2] ?? 16));
const seasons = Math.min(8, Number(process.argv[3] ?? 4));
const met: Record<string, [number, number]> = {};
const kinds: Record<string, [number, number]> = {};
const picks: Record<string, number> = {};
let total = 0;
const bump = (o: Record<string, [number, number]>, k: string, ok: boolean) => { const v = (o[k] ??= [0, 0]); v[0] += ok ? 1 : 0; v[1]++; };
const reals = selectableRealPlayers();
for (let i = 0; i < careers; i++) {
  const g: GameState = i % 2
    ? newGame({ mode: 'real', playerId: reals[(i * 7) % reals.length]!.id, seed: `goals-r-${i}`, difficulty: 'normal' })
    : newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `goals-p-${i}`, difficulty: 'normal' });
  for (let s = 0; s < seasons; s++) {
    const before = g.cards.picks.length;
    while (g.phase === 'season') { playRound(g, { engine: 'quick' }); autoAllocate(g.player); }
    for (const r of g.lastSeasonSummary?.goals?.results ?? []) { bump(met, r.tier, r.met); bump(kinds, r.kind, r.met); }
    for (const p of g.cards.picks.slice(before)) for (const id of p.options.slice(0, 1)) { const k = `${p.source}:${cardById(id)!.rarity}`; picks[k] = (picks[k] ?? 0) + 1; }
    g.cards.picks = [];
    total++;
    if (g.phase !== 'offseason') break;
    autoMarket(g, 'stay');
    startNextSeason(g);
  }
}
const pct = ([a, b]: [number, number]) => `${Math.round((a / Math.max(1, b)) * 100)}% (${a}/${b})`;
console.log(`시즌 목표 · ${careers}커리어 × ${seasons}시즌 = ${total}시즌`);
console.log(`난이도별 달성: ${Object.entries(met).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}`);
console.log(`종류별 달성: ${Object.entries(kinds).map(([k, v]) => `${k} ${pct(v)}`).join(' · ')}`);
console.log(`시즌당 선택권(첫 후보 희귀도): ${Object.entries(picks).sort().map(([k, v]) => `${k} ${(v / total).toFixed(2)}`).join(' · ')}`);
