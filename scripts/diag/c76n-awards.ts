// C.76n 개인 시상 현실감 측정: 커리어 여러 개 × 시즌 n, 빠른 진행(추정 기록) 또는 엔진(다른 경기 엔진).
// 실행: npx vite-node scripts/diag/c76n-awards.ts -- [careers=6] [seasons=10] [mode=quick|engine] [leagues=pl|default]
import { autoMarket, newGame, playRound, startNextSeason, type GameState } from '../../src/game';
import { autoAllocate, reputationTier, topAwardCount } from '../../src/growth';
import { sortedTable } from '../../src/league';
import { awardKo, awardTeam, myAwardRank } from '../../src/awards';
import { DEFAULT_LEAGUES } from '../../data/leagues';
import { BALANCE } from '../../src/config/balance';

const args = process.argv.slice(2).filter((a) => a !== '--');
const careers = Number(args[0] ?? 6);
const seasons = Number(args[1] ?? 10);
const mode = (args[2] ?? 'quick') as 'quick' | 'engine';
const leagues = args[3] === 'default' ? [...DEFAULT_LEAGUES] : ['pl'];
const policy = (args[4] ?? 'best') as 'stay' | 'best';
const only = args[5] ? Number(args[5]) : null;
const offset = Number(args[6] ?? 0);

const SETUPS: { label: string; make: (i: number) => GameState }[] = [
  { label: '레전더리 유망주 ST', make: (i) => { const s = newGame({ mode: 'prospect', position: 'ST', seed: `c76n-leg-${i}`, difficulty: 'normal', leagues } as never); s.player.potentialTier = 'legendary'; return s; } },
  { label: '레전더리 유망주 CM', make: (i) => { const s = newGame({ mode: 'prospect', position: 'CM', seed: `c76n-legcm-${i}`, difficulty: 'normal', leagues } as never); s.player.potentialTier = 'legendary'; return s; } },
  { label: '살라', make: (i) => newGame({ mode: 'real', playerId: 'salah', seed: `c76n-salah-${i}`, difficulty: 'normal', leagues } as never) },
  { label: '보통 유망주 CB', make: (i) => newGame({ mode: 'prospect', position: 'CB', seed: `c76n-cb-${i}`, difficulty: 'normal', leagues } as never) },
];

const wins: Record<string, { group: Record<string, number>; top4: number; trophyless: number; repeat3: number; total: number; me: number; teams: Record<string, number> }> = {};
let bdBestSame = 0, bdBestN = 0, bdN = 0, bdNoTrophy = 0;
const myBd: string[] = [];
const t0 = Date.now();
for (let c = offset; c < offset + careers; c++) {
  const S = SETUPS[only ?? c % SETUPS.length]!;
  const state = S.make(c);
  const lastWin: Record<string, string[]> = {};
  for (let s = 0; s < seasons && state.phase !== 'retired'; s++) {
    while (state.phase === 'season') { playRound(state, { engine: 'quick', others: mode === 'engine' ? 'engine' : 'quick' }); autoAllocate(state.player); }
    autoAllocate(state.player);
    if (state.phase !== 'offseason') break;
    // 발롱도르 1위 팀이 이번 시즌 트로피(리그 · 국내 컵 · 챔스 우승)가 없었나
    const y = state.globalAwards?.years.at(-1);
    const w = y?.season === state.league.season ? y.res.ballonDor?.[0] : undefined;
    if (w) {
      bdN++;
      const lgs = [state.league, ...(state.otherLeagues ?? [])];
      const champ = lgs.some((l) => sortedTable(l)[0]?.teamId === w.t);
      const cup = state.cups?.fa?.winner === w.t || state.cups?.ucl?.winner === w.t;
      if (!champ && !cup) bdNoTrophy++;
    }
    autoMarket(state, policy);
    startNextSeason(state);
  }
  // 남은 시즌 발표까지 진행 (마지막 시즌의 10~12월 발표)
  for (let k = 0; k < 20 && state.phase === 'season'; k++) playRound(state, { engine: 'quick', others: 'quick' });
  for (const y of state.globalAwards?.years ?? []) {
    for (const id of Object.keys(y.res)) {
      if (!y.shown.includes(id)) continue;
      const w = y.res[id]![0];
      if (!w) continue;
      const W = (wins[id] ??= { group: {}, top4: 0, trophyless: 0, repeat3: 0, total: 0, me: 0, teams: {} });
      W.total++;
      if (w.me) W.me++;
      const g = w.p;
      W.group[g] = (W.group[g] ?? 0) + 1;
      W.teams[awardTeam(state, w.t)] = (W.teams[awardTeam(state, w.t)] ?? 0) + 1;
      const arr = (lastWin[id] ??= []);
      arr.push(w.id);
      if (arr.length >= 3 && arr.slice(-3).every((x) => x === w.id)) W.repeat3++;
    }
    if (y.shown.includes('ballonDor') && y.shown.includes('theBest')) { bdBestN++; if (y.res.ballonDor![0]?.id === y.res.theBest![0]?.id) bdBestSame++; }
    const r = myAwardRank(y.res.ballonDor);
    if (y.shown.includes('ballonDor')) myBd.push(`${S.label}#${c} ${y.season}: ${r ? `${r}위` : '-'} (1위 ${y.res.ballonDor![0]?.me ? '나' : y.res.ballonDor![0]?.n} ${awardTeam(state, y.res.ballonDor![0]!.t)} ${y.res.ballonDor![0]?.v}점)`);
  }
  console.log(`${S.label}#${c} 끝 OVR ${state.player.history.at(-1)?.ovr} 발롱도르 ${state.player.honors.ballonDor}회 · 최고 개인상 ${topAwardCount(state.player.honors)} · 위상 ${state.player.reputation} ${reputationTier(state.player.reputation, state.player.honors)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
console.log(`\n모드 ${mode} · 리그 ${leagues.join(',')} · 커리어 ${careers} × ${seasons}시즌`);
for (const [id, W] of Object.entries(wins)) {
  const teams = Object.entries(W.teams).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => `${t} ${n}`).join(' · ');
  console.log(`${awardKo(id).padEnd(10)} ${W.total}회 · 나 ${W.me} · 포지션 ${Object.entries(W.group).map(([g, n]) => `${g} ${n}`).join(' ')} · 3연속 ${W.repeat3} · 팀 ${teams}`);
}
console.log(`발롱도르 = 더 베스트 일치 ${bdBestSame}/${bdBestN} · 트로피 없는 발롱도르 ${bdNoTrophy}/${bdN}`);
console.log(myBd.join('\n'));
void BALANCE;
