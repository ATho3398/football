// 포지션 적성 측정 (부록 C.37, pending 31·36): 시작 후보 4자리 분포, 적성별 숙련도 100 도달 경기 수, 포변 조언 발생률.
// 실행: npm run balance:aptitude -- [후보 시드 수] [커리어 수]

import { aptGroupOf, rollProspect } from '../src/aptitude';
import { APT_GROUPS, type AptGroup } from '../src/config/aptitude';
import { BALANCE } from '../src/config/balance';
import { autoAllocate } from '../src/growth';
import { emptySeasonStats, newGame, playRound, selectableRealPlayers, startNextSeason, type GameState } from '../src/game';
import { gainProficiency, initialProficiency, requestPositionChange } from '../src/proficiency';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import type { FieldPosition, PlayablePosition } from '../src/positions';
import type { PlayerState } from '../src/types';

const argv = (globalThis as { process?: { argv: string[] } }).process?.argv ?? [];
const args = argv.slice(2).filter((a) => a !== '--');
const SEEDS = Number(args[0] ?? 4000);
const CAREERS = Number(args[1] ?? 120);
const A = BALANCE.aptitude;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);

// ── 1. 시작 후보 4자리 ──
{
  let hidden = 0;
  let hiddenTop3 = 0;
  let wildHidden = 0;
  let topMatched = 0;
  let wildWarm = 0;
  const rankOvr = [[], [], [], []] as number[][];
  const groupCount: Record<string, number> = {};
  const wildGroup: Record<string, number> = {};
  for (let i = 0; i < SEEDS; i++) {
    const r = rollProspect(`apt-cand-${i}`);
    const c = r.candidates;
    c.forEach((x, k) => rankOvr[k]!.push(x.ovr));
    for (const x of c) groupCount[x.group] = (groupCount[x.group] ?? 0) + 1;
    wildGroup[c[3]!.group] = (wildGroup[c[3]!.group] ?? 0) + 1;
    if (r.talent.groups.includes(c[0]!.group)) topMatched++;
    if (r.aptitude.mult[c[3]!.group] >= A.hintHigh) wildWarm++;
    if (!r.aptitude.hidden) continue;
    hidden++;
    if (c.slice(0, 3).some((x) => x.group === r.aptitude.hidden)) hiddenTop3++;
    if (c[3]!.group === r.aptitude.hidden) wildHidden++;
  }
  const outTop3 = hidden - hiddenTop3;
  console.log(`[시작 후보] 유망주 ${SEEDS}명`);
  console.log(`  숨은 재능 있음 ${pct(hidden / SEEDS)} (목표 ${pct(A.hiddenChance)}) · 그중 상위 3 안 ${pct(hiddenTop3 / Math.max(1, hidden))}`);
  console.log(`  와일드카드 = 숨은 재능: 전체 ${pct(wildHidden / SEEDS)} (기대 ${pct((outTop3 / SEEDS) * A.candidates.wildHidden)}), 숨은 재능이 상위 3 밖일 때 ${pct(wildHidden / Math.max(1, outTop3))} (목표 ${pct(A.candidates.wildHidden)})`);
  console.log(`  와일드카드 코치 평이 따뜻한 말투 ${pct(wildWarm / SEEDS)} (숨은 재능 와일드카드 ${pct(wildHidden / SEEDS)} + 맞는 군 배수 ≥ ${A.hintHigh})`);
  console.log(`  후보 1위가 재능 타입이 맞는 군 ${pct(topMatched / SEEDS)}`);
  console.log(`  후보 순위별 평균 OVR: ${rankOvr.map((xs, k) => `${k < 3 ? k + 1 + '위' : '와일드'} ${avg(xs).toFixed(1)}`).join(' · ')}`);
  console.log(`  후보 포지션군 빈도(4자리 합): ${APT_GROUPS.map((g) => `${g} ${pct((groupCount[g] ?? 0) / SEEDS)}`).join(' · ')}`);
  console.log(`  와일드카드 포지션군: ${APT_GROUPS.map((g) => `${g} ${pct((wildGroup[g] ?? 0) / SEEDS)}`).join(' · ')}`);
}

// ── 2. 숙련도 100 도달 경기 수 (주 포지션 변경 후 새 포지션으로 90분 출전) ──
{
  const flat = Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, 60])) as FieldAttributes;
  const games = (from: FieldPosition, to: PlayablePosition, mult: number, boost: boolean): number => {
    const mults = Object.fromEntries(APT_GROUPS.map((g) => [g, 1])) as Record<AptGroup, number>;
    mults[aptGroupOf(to)!] = mult;
    const p = {
      name: 't', position: from, age: 20, teamId: 'x', attributes: flat, potentialTier: 'normal', xp: 0, totalXp: 0, level: 0, unspentPoints: 0,
      fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], slumpStreak: 0,
      season: emptySeasonStats(), history: [], suspended: 0, proficiency: initialProficiency(from), badges: [], formerPositions: [],
      honors: { ballonDor: 0, trebles: 0, worldCups: 0 }, body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, tags: [], aptitude: { talent: 'speed', mult: mults, hidden: null }, advice: null, adviceLog: [],
      aptBoost: boost ? { group: aptGroupOf(to)!, games: A.advice.boostGames } : null,
    } as PlayerState;
    requestPositionChange(p, to, true);
    let n = 0;
    while (p.proficiency[to] < 100 && n < 500) {
      gainProficiency(p, 90, to);
      n++;
    }
    return n;
  };
  console.log(`\n[숙련도 100 도달 경기 수] 주 포지션 변경 후 새 포지션 90분 출전, 0 시작·적응기 ${BALANCE.proficiency.adaptGames}경기 ×${BALANCE.proficiency.adaptMult}·이후 +${BALANCE.proficiency.gain} (적성 배수별, "+보너스" = 조언 뒤 4라운드 안 포변 ${A.advice.boostGames}경기 ×${A.advice.boostMult})`);
  // C.39: 주 포지션 외 0에서 시작 (거리 무관), 적응기 20경기 ×0.3 → 거리는 OVR 페널티에만 쓴다
  const cases: [FieldPosition, PlayablePosition, string][] = [['CM', 'CAM', '거리 1 (0→)'], ['ST', 'CB', '거리 5 (0→)']];
  const ms = [0.7, 0.85, 1.0, 1.2, 1.35, 1.5, 1.6];
  console.log(`  ${'전환'.padEnd(18)}${ms.map((m) => `×${m}`.padStart(7)).join('')}   ×1.5+보너스 ×0.7+보너스`);
  for (const [f, t, label] of cases) {
    console.log(`  ${`${f}→${t} ${label}`.padEnd(18)}${ms.map((m) => String(games(f, t, m, false)).padStart(7)).join('')}   ${String(games(f, t, 1.5, true)).padStart(9)} ${String(games(f, t, 0.7, true)).padStart(9)}`);
  }
}

// ── 3. 포변 조언 발생률 (빠른 경기 커리어, 17세 → 36세) ──
function career(state: GameState): { advice: number[]; seasons: number; ratings: number[] } {
  const ages: number[] = [];
  const ratings: number[] = [];
  let seasons = 0;
  while (state.player.age < 36) {
    while (state.phase === 'season') {
      playRound(state, { engine: 'quick' });
      autoAllocate(state.player);
    }
    autoAllocate(state.player);
    seasons++;
    const h = state.player.history.at(-1)!;
    if (h.apps) ratings.push(h.ratingSum / h.apps);
    if (state.lastSeasonSummary?.advice) ages.push(h.age);
    if (state.phase !== 'offseason') break;
    startNextSeason(state);
  }
  return { advice: ages, seasons, ratings };
}

function report(label: string, runs: ReturnType<typeof career>[]): void {
  const total = runs.reduce((t, r) => t + r.advice.length, 0);
  const seasons = runs.reduce((t, r) => t + r.seasons, 0);
  const dist = [0, 1, 2, 3].map((k) => runs.filter((r) => (k < 3 ? r.advice.length === k : r.advice.length >= 3)).length / runs.length);
  const low = runs.flatMap((r) => r.ratings).filter((x) => x <= A.advice.ratingMax).length / Math.max(1, runs.flatMap((r) => r.ratings).length);
  const ages = runs.flatMap((r) => r.advice);
  console.log(`  ${label}: ${runs.length}명 · 커리어당 ${(total / runs.length).toFixed(2)}회 · 시즌당 ${pct(total / seasons)} · 0/1/2/3+회 ${dist.map(pct).join(' / ')} · 시즌 평점 ≤ ${A.advice.ratingMax} 비율 ${pct(low)}${ages.length ? ` · 조언 나이 평균 ${avg(ages).toFixed(1)}` : ''}`);
}

console.log(`\n[포변 조언] 빠른 경기 커리어 17→36세, 최적 배분, 포변 안 함 (조언 조건: ${A.advice.seasons}시즌 연속 평균 ≤ ${A.advice.ratingMax}, 선발 ${A.advice.minStarts}경기+, 적성 더 높은 군)`);
for (const policy of ['top', 'wild'] as const) {
  const runs = [];
  for (let i = 0; i < CAREERS; i++) {
    const seed = `apt-career-${i}`;
    const r = rollProspect(seed);
    const pick = policy === 'top' ? r.candidates[0]! : r.candidates[3]!;
    runs.push(career(newGame({ mode: 'prospect', position: pick.pos, seed, difficulty: 'normal', rolled: true })));
  }
  report(policy === 'top' ? '가상 유망주 · 후보 1위로 시작' : '가상 유망주 · 와일드카드로 시작', runs);
}
{
  const runs = [];
  const reals = selectableRealPlayers().filter((p) => BALANCE.newGame.startYear - p.birthYear <= 30);
  for (const p of reals) runs.push(career(newGame({ mode: 'real', playerId: p.id, seed: `apt-real-${p.id}`, difficulty: 'normal' })));
  report(`실제 선수 (30세 이하 ${reals.length}명, 36세까지)`, runs);
}

