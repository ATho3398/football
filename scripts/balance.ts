// 밸런스 점검 (B.10): 잠재력 티어별 가상 유망주를 시드 고정으로 17~33세까지 자동 시뮬
// 실행: npm run balance
// 기대 범위(참고): 일반 → 30세 OVR 65~72, 레전더리 → 85 이상
// 포인트 배분은 두 가지로 본다: 최적(포지션 OVR 효율 순 자동 배분) / 무작위(25개 능력치 중 아무 데나)
// 가상 유망주는 모두 약팀(레이팅 순위 8~20위)에 배정되므로 평균이 곧 약팀 배정 평균이다 (부록 D.0)
// 추가 점검 (부록 D.0): 위상 티어 분포(성장 해금), 30세 이후 OVR 추이(고령 XP 감쇠), 포지션별 30→36세 변화(노련함)
// 부상 점검 (부록 D.5): 주전(시즌 선발 30경기 이상 출전 가능 수준)의 시즌당 부상 횟수 목표 약 0.4~0.8회

import { FIELD_ATTRIBUTES } from '../src/attributes';
import {
  autoAllocate, playerOvr, raiseAttribute, raiseBlock, reputationTier, TIERS_ASC, TIER_NAMES_KO,
} from '../src/growth';
import { newGame, playRound, startNextSeason, type GameState } from '../src/game';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { createRng } from '../src/rng';
import type { InjuryGrade, Tier } from '../src/types';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS_PER_TIER = Number(env.SEEDS ?? 24);
const END_AGE = 37;
type Strategy = 'best' | 'random';

function spend(state: GameState, strategy: Strategy, rng: () => number): void {
  if (strategy === 'best') {
    autoAllocate(state.player);
    return;
  }
  for (let k = 0; k < 300 && state.player.unspentPoints > 0; k++) {
    const a = FIELD_ATTRIBUTES[Math.floor(rng() * FIELD_ATTRIBUTES.length)]!;
    if (!raiseBlock(state.player, a)) raiseAttribute(state.player, a);
  }
}

function simulateCareer(tier: Tier, i: number, strategy: Strategy) {
  const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
  const state = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
  state.player.potentialTier = tier;
  const rng = createRng(i);
  const ovrByAge: Record<number, number> = { [state.player.age]: playerOvr(state.player) };
  const repByAge: Record<number, number> = { [state.player.age]: state.player.reputation };
  let starts = 0;
  let seasons = 0;
  const injuries: { grade: InjuryGrade; weeks: number; permanent: number; age: number }[] = [];
  const seasonLog: { age: number; apps: number; starts: number; minutes: number; injuries: number; injuredWeeks: number }[] = [];
  while (state.player.age < END_AGE) {
    while (state.phase === 'season') {
      const report = playRound(state);
      const inj = report.injury;
      if (inj) {
        const permanent = Object.values(inj.permanent).reduce((t, d) => t + (d ?? 0), 0);
        injuries.push({ grade: inj.grade, weeks: inj.weeksTotal, permanent, age: state.player.age });
      }
      spend(state, strategy, rng);
    }
    spend(state, strategy, rng);
    const rec = state.player.history.at(-1)!;
    seasonLog.push({
      age: rec.age, apps: rec.apps, starts: rec.starts, minutes: rec.minutes, injuries: rec.injuries, injuredWeeks: rec.injuredWeeks,
    });
    starts += rec.starts;
    seasons++;
    ovrByAge[state.player.age] = playerOvr(state.player);
    repByAge[state.player.age] = state.player.reputation;
    if (state.phase !== 'offseason') break;
    startNextSeason(state);
  }
  return { position, ovrByAge, repByAge, starts: starts / seasons, injuries, seasonLog };
}

type Run = ReturnType<typeof simulateCareer>;
const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const allRuns: Record<Strategy, Run[]> = { best: [], random: [] };

const ages = Array.from({ length: END_AGE - 17 + 1 }, (_, i) => 17 + i);
for (const strategy of ['best', 'random'] as Strategy[]) {
  console.log(`\n[${strategy === 'best' ? '최적 배분' : '무작위 배분'}] 티어별 평균 OVR (시드 ${SEEDS_PER_TIER}개, 포지션 순환, 난이도 보통)`);
  console.log(['티어'.padEnd(6), ...ages.map((a) => String(a).padStart(4)), '  선발/시즌', ' 30세 범위'].join(''));
  for (const tier of TIERS_ASC) {
    const runs = Array.from({ length: SEEDS_PER_TIER }, (_, i) => simulateCareer(tier, i, strategy));
    allRuns[strategy].push(...runs);
    const avgAt = (age: number) => runs.reduce((t, r) => t + (r.ovrByAge[age] ?? 0), 0) / runs.length;
    const at30 = runs.map((r) => r.ovrByAge[30] ?? 0);
    const starts = runs.reduce((t, r) => t + r.starts, 0) / runs.length;
    console.log(
      [
        TIER_NAMES_KO[tier].padEnd(6),
        ...ages.map((a) => avgAt(a).toFixed(0).padStart(4)),
        starts.toFixed(1).padStart(10),
        `   ${Math.min(...at30)}~${Math.max(...at30)}`,
      ].join(''),
    );
  }
}

// ── 부록 D.0 점검 ──
for (const strategy of ['best', 'random'] as Strategy[]) {
  const runs = allRuns[strategy];
  console.log(`\n[${strategy === 'best' ? '최적 배분' : '무작위 배분'}] 위상 티어 분포 (비용 구간 해금, 전 티어 합산)`);
  for (const age of [21, 25, 30, 35]) {
    const counts = Object.fromEntries(TIERS_ASC.map((t) => [t, 0])) as Record<Tier, number>;
    for (const r of runs) if (r.repByAge[age] !== undefined) counts[reputationTier(r.repByAge[age]!)]++;
    const repAvg = avg(runs.map((r) => r.repByAge[age] ?? 0));
    console.log(`  ${age}세 위상 평균 ${repAvg.toFixed(0).padStart(4)} · ${TIERS_ASC.map((t) => `${TIER_NAMES_KO[t]} ${counts[t]}`).join(' / ')}`);
  }
  console.log('  포지션별 평균 OVR 30세 → 33세 → 36세 (변화)');
  const byPos = new Map<string, Run[]>();
  for (const r of runs) byPos.set(r.position, [...(byPos.get(r.position) ?? []), r]);
  const rows = [...byPos.entries()].map(([pos, rs]) => {
    const at = (age: number) => avg(rs.map((r) => r.ovrByAge[age] ?? 0));
    return { pos, a30: at(30), a33: at(33), a36: at(36) };
  });
  rows.sort((x, y) => (y.a36 - y.a30) - (x.a36 - x.a30));
  for (const r of rows) {
    const d = r.a36 - r.a30;
    console.log(`    ${r.pos.padEnd(4)} ${r.a30.toFixed(1)} → ${r.a33.toFixed(1)} → ${r.a36.toFixed(1)}  (${d >= 0 ? '+' : ''}${d.toFixed(1)})`);
  }
}

// ── 부상 점검 (부록 D.2, D.5) ──
{
  const runs = allRuns.best;
  const seasonsAll = runs.flatMap((r) => r.seasonLog);
  const injuriesAll = runs.flatMap((r) => r.injuries);
  console.log(`\n[부상] 최적 배분 커리어 ${runs.length}개, ${seasonsAll.length}시즌, 부상 ${injuriesAll.length}건`);
  const line = (label: string, ss: typeof seasonsAll) => {
    if (!ss.length) return;
    const inj = avg(ss.map((x) => x.injuries));
    const weeks = avg(ss.map((x) => x.injuredWeeks));
    const apps = avg(ss.map((x) => x.apps));
    console.log(`  ${label.padEnd(18)} ${String(ss.length).padStart(4)}시즌 · 출전 ${apps.toFixed(1).padStart(4)} · 부상 ${inj.toFixed(2)}회/시즌 · 부상 결장 ${weeks.toFixed(1)}주/시즌`);
  };
  line('전체', seasonsAll);
  line('주전 (선발 30+)', seasonsAll.filter((x) => x.starts >= 30));
  line('로테이션 (선발 10~29)', seasonsAll.filter((x) => x.starts >= 10 && x.starts < 30));
  line('주전 29세 이하', seasonsAll.filter((x) => x.starts >= 30 && x.age < 30));
  line('주전 30세 이상', seasonsAll.filter((x) => x.starts >= 30 && x.age >= 30));
  // 선발 30+ 시즌만 고르면 오래 다친 시즌이 빠져 낮게 나온다. 출전 시간당 부상률을 38경기 풀타임으로 환산해 본다
  const per38 = (ss: typeof seasonsAll) =>
    (ss.reduce((t, x) => t + x.injuries, 0) / ss.reduce((t, x) => t + x.minutes, 0)) * 90 * 38;
  const target = per38(seasonsAll);
  console.log(`  38경기 풀타임 환산: 전체 ${target.toFixed(2)}회 · 29세 이하 ${per38(seasonsAll.filter((x) => x.age < 30)).toFixed(2)}회 · 30세 이상 ${per38(seasonsAll.filter((x) => x.age >= 30)).toFixed(2)}회`);
  console.log(`  목표: 주전 시즌당 0.4~0.8회 → 풀타임 환산 ${target.toFixed(2)}회 ${target >= 0.4 && target <= 0.8 ? '(범위 안)' : '(범위 밖)'}`);
  const grades: InjuryGrade[] = ['minor', 'major', 'seasonEnding'];
  const names: Record<InjuryGrade, string> = { minor: '경상', major: '중상', seasonEnding: '시즌아웃' };
  console.log(`  등급: ${grades.map((g) => {
    const xs = injuriesAll.filter((x) => x.grade === g);
    return `${names[g]} ${xs.length}건 (${((xs.length / injuriesAll.length) * 100).toFixed(0)}%, 평균 ${xs.length ? avg(xs.map((x) => x.weeks)).toFixed(1) : '-'}주)`;
  }).join(' / ')}`);
  const perm = injuriesAll.filter((x) => x.permanent < 0);
  console.log(`  영구 하락: ${perm.length}건, 평균 능력치 합 ${perm.length ? avg(perm.map((x) => x.permanent)).toFixed(1) : '-'} · 커리어당 ${(perm.length / runs.length).toFixed(2)}건`);
}
