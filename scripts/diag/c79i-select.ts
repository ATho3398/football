// C.79i 감독 성향별 선수 기용 측정: (A) NPC 리그 한 시즌(엔진) 팀별 선발 안정성·피로·23세 이하 선발 (B) 성향별 내 선수(유망주·주전·벤치) 시즌 출전
// 실행: npx vite-node scripts/diag/c79i-select.ts -- [A|B] (기본 둘 다). SEEDS=4 (B 시드 수)
import { runLeagueSeasonJob } from '../engine/job';

import { managerOf } from '../../data/managers';
import { newGame, playRound, rebuildRosters, selectableRealPlayers } from '../../src/game';
import { teamById } from '../../src/league';
import { playerOvr } from '../../src/growth';
import { setEnvironmentFixed } from '../../src/weather';

const argv = process.argv.slice(2);
const part = argv.find((a) => a === 'A' || a === 'B');
const SEEDS = Number(process.env.SEEDS ?? 4);
const IDS = ['mci', 'liv', 'che', 'tot', 'ars', 'mun', 'wol', 'eve', 'lei', 'whu', 'wat', 'cry', 'new', 'bou', 'bur', 'sou', 'bha', 'car', 'ful', 'hud'];
const r1 = (v: number) => Math.round(v * 10) / 10;

if (!part || part === 'A') {
  const worldSeed = process.env.WORLD ?? 'league-0';
  const t0 = Date.now();
  const out = runLeagueSeasonJob({ kind: 'leagueSeason', worldSeed, ids: IDS, seed0: 30000 });
  const rosters = rebuildRosters(worldSeed, undefined, 0);
  const age = new Map<string, number>();
  for (const id of IDS) for (const p of rosters[id]!.players) age.set(p.id, p.age);
  const goals = out.matches.reduce((t, m) => t + m.homeGoals + m.awayGoals, 0) / out.matches.length;
  console.log(`[A] ${worldSeed} 리그 시즌 ${out.matches.length}경기 ${r1((Date.now() - t0) / 1000)}s · 경기당 골 ${goals.toFixed(2)} · 부상 ${out.fit.injuries} · 선발 아침 피로 평균 ${r1(out.fit.startFatigue / out.fit.starts)} · 50 초과 선발 ${out.fit.startsOver}`);
  console.log('팀 | 성향 | 선발 바뀐 수/경기 | 선발 쓴 선수 | 상위 11 선발 몫 | 23세 이하 선발 몫 | 선발 피로 평균 | 후반 1/3 선발 피로');
  for (const id of IDS) {
    const ms = out.matches.filter((m) => m.home === id || m.away === id);
    let prev: Set<string> | null = null;
    let changes = 0;
    const cnt = new Map<string, number>();
    let u23 = 0;
    let all = 0;
    for (const m of ms) {
      const st = new Set(Object.entries(m.apps ?? {}).filter(([pid, v]) => v[0] === 1 && m.team?.[pid] === id).map(([pid]) => pid));
      if (prev) changes += [...st].filter((x) => !prev!.has(x)).length;
      prev = st;
      for (const x of st) { cnt.set(x, (cnt.get(x) ?? 0) + 1); all++; if ((age.get(x) ?? 99) <= 23) u23++; }
    }
    const top11 = [...cnt.values()].sort((a, b) => b - a).slice(0, 11).reduce((t, v) => t + v, 0);
    const tt = out.fit.teams?.[id] ?? [0, 0, 0, 0];
    console.log(`${id} | ${managerOf(id)?.style ?? '-'} | ${(changes / Math.max(1, ms.length - 1)).toFixed(2)} | ${cnt.size} | ${(top11 / all).toFixed(3)} | ${(u23 / all).toFixed(3)} | ${r1(tt[1] / Math.max(1, tt[0]))} | ${r1(tt[3] / Math.max(1, tt[2]))}`);
  }
}

if (!part || part === 'B') {
  setEnvironmentFixed(true);
  const STYLES = ['neutral', 'star', 'competitive', 'rotation', 'strict', 'youth', 'steady'] as const;
  // 실제 선수 후보: 팀 레이팅 대비 OVR 로 주전(+2 이상)·벤치(−3 이하) 분류
  const reals = selectableRealPlayers(['pl']);
  const starters: string[] = [];
  const bench: string[] = [];
  for (const p of reals) {
    if (starters.length >= SEEDS && bench.length >= SEEDS) break;
    const g = newGame({ mode: 'real', playerId: p.id, seed: 'c79i', difficulty: 'normal' });
    const d = playerOvr(g.player) - teamById(g.league, g.player.teamId).rating;
    if (d >= 2 && starters.length < SEEDS) starters.push(p.id);
    else if (d <= -3 && d >= -9 && bench.length < SEEDS) bench.push(p.id);
  }
  const kinds: [string, (i: number) => ReturnType<typeof newGame>][] = [
    ['유망주', (i) => newGame({ mode: 'prospect', position: (['ST', 'CM', 'CB', 'LW'] as const)[i % 4]!, seed: `c79i-p${i}`, difficulty: 'normal' })],
    ['주전', (i) => newGame({ mode: 'real', playerId: starters[i % starters.length]!, seed: `c79i-s${i}`, difficulty: 'normal' })],
    ['벤치', (i) => newGame({ mode: 'real', playerId: bench[i % bench.length]!, seed: `c79i-b${i}`, difficulty: 'normal' })],
  ];
  console.log(`[B] 내 선수 한 시즌(빠른 경기) 출전 — 시드 ${SEEDS}개 평균: 선발 경기 / 출전 분 / 경기 수`);
  console.log(`성향 | ${kinds.map(([k]) => k).join(' | ')}`);
  for (const style of STYLES) {
    const cells: string[] = [];
    for (const [, make] of kinds) {
      let st = 0;
      let mn = 0;
      let gm = 0;
      for (let i = 0; i < SEEDS; i++) {
        const g = make(i);
        const tid = g.player.teamId;
        const m = managerOf(tid);
        (g.coaches ??= {})[tid] = { name: m?.name ?? 'x', nameKo: m?.nameKo ?? 'x', style: style as never, since: g.league.season };
        (g.sacked ??= []).push(`${tid}:${g.league.season}`);
        while (g.phase === 'season') playRound(g, { engine: 'quick' });
        st += g.player.season.starts;
        mn += g.player.season.minutes;
        gm += g.matchLog.length;
      }
      cells.push(`${r1(st / SEEDS)} / ${Math.round(mn / SEEDS)} / ${r1(gm / SEEDS)}`);
    }
    console.log(`${style} | ${cells.join(' | ')}`);
  }
}
