// 밸런스 점검 (B.10): 잠재력 티어별 가상 유망주를 시드 고정으로 17~33세까지 자동 시뮬
// 실행: npm run balance (출력만) / npm run balance:check (목표를 벗어나면 종료 코드 1, 부록 A.1)
// 30세 OVR 기대 범위 (부록 D.7 #3): 최적 배분 일반 74~78 / 레전더리 84~88, 무작위 배분 일반 68~72 / 레전더리 79~83
// 커리어 시뮬은 수십만 경기라 내 경기도 빠른 경기(통계 방식)로 계산한다. 엔진 경기 평점/XP 비교는 npm run balance:engine (부록 C.11)
// 포인트 배분은 두 가지로 본다: 최적(포지션 OVR 효율 순 자동 배분) / 무작위(25개 능력치 중 아무 데나)
// 가상 유망주는 모두 약팀(레이팅 순위 8~20위)에 배정되므로 평균이 곧 약팀 배정 평균이다 (부록 D.0)
// 추가 점검 (부록 D.0): 위상 티어 분포(성장 해금), 30세 이후 OVR 추이(고령 XP 감쇠), 포지션별 30→36세 변화(노련함)
// 부상 점검 (부록 D.5): 주전(시즌 선발 30경기 이상 출전 가능 수준)의 시즌당 부상 횟수 목표 약 0.4~0.8회
// 1.6단계 점검 (부록 D.6): 실제 선수(케인, 래시포드, 손흥민 + A등급 전체) 고능력치 개수, 약팀 유망주 30세 위상 중앙값, 포지션군별 30→36세
// 1.7단계 점검 (부록 D.7): 실제 선수 정점 = 시작 OVR + 시작 나이별 여지(±1.5)
// 13단계 점검 (부록 C.23): 30세 위상 중앙값 일반 유망주 스페셜(250~400), 레전더리 유망주 탑클래스(550~750), 레전더리 유망주 최적 배분 30세까지 900+ 도달 10~20%
// 15단계 점검 (부록 C.25): 레전더리 유망주 최적 배분 35세 900+ 비율 25% 이하 (부진·순위 감점, 31세부터 시즌 상한 축소)
// 16단계 점검 (부록 C.26): 실제 선수 ST/CF 시즌 20골 안팎(17~23골, 25경기 이상) 시즌 평균 평점 7.0~7.4
// 17단계 점검 (부록 C.27): 티어 하한(감점이 지금 티어 컷 밑으로 못 내림)·출전 시간 부족 감점을 넣은 뒤 같은 위상 가드 재통과

/** 회귀 가드 (부록 A.1): 지표마다 기대 범위 */
const CHECK = (globalThis as { process?: { argv: string[] } }).process?.argv.includes('--check') ?? false;
const checks: { name: string; value: number; min: number; max: number; ok: boolean }[] = [];
/**
 * 표시는 소수 첫째 자리. raw = 반올림 전 값으로 판정 (비율 가드, C.67 마스터 P 판단): 첫째 자리 반올림이면
 * "25% 이하" 목표에서 정확히 0.25 가 0.3 으로 실패한다
 */
function check(name: string, value: number, min: number, max: number, raw = false): string {
  const v = Math.round(value * 10) / 10;
  const x = raw ? value : v;
  checks.push({ name, value: raw ? Math.round(value * 1000) / 1000 : v, min, max, ok: x >= min && x <= max });
  return x >= min && x <= max ? '✓' : '✗';
}
const OVR30_TARGET: Record<Strategy, Partial<Record<Tier, [number, number]>>> = {
  best: { normal: [74, 78], legendary: [84, 88] },
  random: { normal: [68, 72], legendary: [79, 83] },
};

import { FIELD_ATTRIBUTES } from '../src/attributes';
import {
  autoAllocate, playerOvr, raiseAttribute, raiseBlock, reputationTier, TIERS_ASC, TIER_NAMES_KO,
} from '../src/growth';
import { autoMarket, newGame, playRound, selectableRealPlayers, startNextSeason, type GameState } from '../src/game';
import { BALANCE } from '../src/config/balance';
import { isOutside } from '../src/transfer';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { createRng } from '../src/rng';
import type { InjuryGrade, Tier } from '../src/types';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS_PER_TIER = Number(env.SEEDS ?? 48);
/**
 * 내 선수 이적 정책 (C.42): stay = 제안 모두 거절·재계약 (C.41 까지와 같은 한 팀 커리어), best = 레이팅 +2 이상·주전/로테이션 제안 중 최고 수락.
 * 회귀 가드는 POLICY(기본 stay)로 판정하고, 다른 정책은 [C.42 이적] 측정 줄에 따로 보여 준다
 */
const POLICY = (env.POLICY ?? 'stay') as 'stay' | 'best';
/** 측정용: 고령 XP 감쇠 덮어쓰기 (C.49), 예 VET='[[30,0.7],[32,0.5]]' */
if (env.VET) (BALANCE.matchXp as { veteranMultiplier: [number, number][] }).veteranMultiplier = JSON.parse(env.VET);
if (env.ONECLUB !== undefined) (BALANCE.badges as { oneClubEnabled: boolean }).oneClubEnabled = env.ONECLUB === '1';
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
  return { position, ...runCareer(state, strategy, i) };
}

/** 능력치 high 이상 개수 */
const countAtLeast = (state: GameState, high: number) => FIELD_ATTRIBUTES.filter((a) => state.player.attributes[a] >= high).length;

function runCareer(state: GameState, strategy: Strategy, rngSeed: number, policy: 'stay' | 'best' = POLICY) {
  const rng = createRng(rngSeed);
  const ovrByAge: Record<number, number> = { [state.player.age]: playerOvr(state.player) };
  const high95ByAge: Record<number, number> = {};
  const max99ByAge: Record<number, number> = {};
  const repByAge: Record<number, number> = { [state.player.age]: state.player.reputation };
  let starts = 0;
  let seasons = 0;
  let offers = 0;
  const npc: { moved: number; total: number; lowLoy: number; lowMoved: number; exp: number; expMoved: number }[] = [];
  const injuries: { grade: InjuryGrade; weeks: number; permanent: number; age: number }[] = [];
  const seasonLog: { age: number; apps: number; starts: number; minutes: number; injuries: number; injuredWeeks: number }[] = [];
  while (state.player.age < END_AGE) {
    const snap = Object.values(state.rosters).flatMap((r) => r.players.map((p) => ({ id: p.id, low: p.loyalty < 40, exp: p.contractEnd <= state.league.season + 1 })));
    const n0 = state.transfers.length;
    while (state.phase === 'season') {
      const report = playRound(state, { engine: 'quick' });
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
    high95ByAge[state.player.age] = countAtLeast(state, 95);
    max99ByAge[state.player.age] = countAtLeast(state, 99);
    const moved = new Set(state.transfers.slice(n0).map((r) => r.id));
    npc.push({
      moved: moved.size, total: snap.length, lowLoy: snap.filter((x) => x.low).length, lowMoved: snap.filter((x) => x.low && moved.has(x.id)).length,
      exp: snap.filter((x) => x.exp).length, expMoved: snap.filter((x) => x.exp && moved.has(x.id)).length,
    });
    if (state.phase !== 'offseason') break;
    offers += state.market.offers?.length ?? 0;
    autoMarket(state, policy);
    startNextSeason(state);
  }
  const moves = state.market.moves.filter((m) => !m.back).length;
  const intoLeague = state.transfers.filter((r) => !isOutside(r.to)).length;
  const hist = state.player.history.map((h) => ({ age: h.age, xp: h.achievementXp, moms: h.moms, gi: h.goals + h.assists, apps: h.apps, goals: h.goals, rating: h.apps ? h.ratingSum / h.apps : 0 }));
  const badgeAges = state.player.badges.map((b) => state.player.history.find((h) => h.season === b.season)?.age ?? 0);
  return {
    ovrByAge, repByAge, high95ByAge, max99ByAge, starts: starts / seasons, injuries, seasonLog, hist, badgeAges,
    offers: offers / Math.max(1, seasons), moves, npc, intoLeague, oneClub: state.player.badges.some((b) => b.id === 'oneClub10'),
  };
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
    const target = OVR30_TARGET[strategy][tier];
    const mark = target ? `  목표 ${target[0]}~${target[1]} ${check(`30세 OVR ${strategy} ${tier}`, avgAt(30), ...target)}` : '';
    console.log(
      [
        TIER_NAMES_KO[tier].padEnd(6),
        ...ages.map((a) => avgAt(a).toFixed(0).padStart(4)),
        starts.toFixed(1).padStart(10),
        `   ${Math.min(...at30)}~${Math.max(...at30)}`,
        mark,
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
  console.log(`  목표: 주전 시즌당 0.4~0.8회 → 풀타임 환산 ${target.toFixed(2)}회 ${check('부상 풀타임 환산', target, 0.4, 0.8)}`);
  const grades: InjuryGrade[] = ['minor', 'major', 'seasonEnding'];
  const names: Record<InjuryGrade, string> = { minor: '경상', major: '중상', seasonEnding: '시즌아웃' };
  console.log(`  등급: ${grades.map((g) => {
    const xs = injuriesAll.filter((x) => x.grade === g);
    return `${names[g]} ${xs.length}건 (${((xs.length / injuriesAll.length) * 100).toFixed(0)}%, 평균 ${xs.length ? avg(xs.map((x) => x.weeks)).toFixed(1) : '-'}주)`;
  }).join(' / ')}`);
  const perm = injuriesAll.filter((x) => x.permanent < 0);
  console.log(`  영구 하락: ${perm.length}건, 평균 능력치 합 ${perm.length ? avg(perm.map((x) => x.permanent)).toFixed(1) : '-'} · 커리어당 ${(perm.length / runs.length).toFixed(2)}건`);
}

// ── 1.6단계 점검 (부록 D.6) ──
const median = (xs: number[]) => {
  const v = [...xs].sort((a, b) => a - b);
  return v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2;
};
const REAL_SEEDS = Number(env.REAL_SEEDS ?? 12);
const realRuns = (id: string, strategy: Strategy) =>
  Array.from({ length: REAL_SEEDS }, (_, i) =>
    runCareer(newGame({ mode: 'real', playerId: id, seed: `real-${id}-${i}`, difficulty: 'normal' }), strategy, i));
const ALL_REAL_SEEDS = Number(env.ALL_REAL_SEEDS ?? 6);
{
  console.log(`\n[D.6/D.7 실제 선수] 최적 배분, 시드 ${REAL_SEEDS}개 평균. 목표(D.7): 정점 = 시작 OVR + 시작 나이별 여지 (≤20 +10 / 21~23 +8 / 24~26 +7 / 27~29 +4 / 30+ +2, ±1.5)`);
  for (const id of ['kane', 'rashford', 'son']) {
    const runs = realRuns(id, 'best');
    const age0 = Math.min(...Object.keys(runs[0]!.ovrByAge).map(Number));
    const start = avg(runs.map((r) => r.ovrByAge[age0]!));
    const peak = avg(runs.map((r) => Math.max(...Object.values(r.ovrByAge))));
    const at = (age: number, k: 'ovrByAge' | 'high95ByAge' | 'max99ByAge') => avg(runs.map((r) => r[k][age] ?? 0));
    const max99 = Math.max(...runs.flatMap((r) => Object.values(r.max99ByAge)));
    console.log(
      `  ${id.padEnd(9)} ${age0}세 ${start.toFixed(1)} → 30세 OVR ${at(30, 'ovrByAge').toFixed(1)} · 95+ ${at(30, 'high95ByAge').toFixed(1)}개 · 99 ${at(30, 'max99ByAge').toFixed(1)}개` +
        ` · 정점 ${peak.toFixed(1)} (+${(peak - start).toFixed(1)}) · 커리어 최대 99 ${max99}개 · 36세 ${at(36, 'ovrByAge').toFixed(1)}`,
    );
  }
  // 목표: 실제 선수는 어떤 경우에도 99 능력치가 2개를 넘지 않는다 / 정점 여지가 나이별 목표 ±1.5 안
  const all = selectableRealPlayers();
  const stSeasons: Run['hist'] = [];
  let over2 = 0;
  let worst = { id: '', n: 0 };
  let inRange = 0;
  const misses: string[] = [];
  for (const d of all) {
    const deltas: number[] = [];
    let room = 0;
    for (let i = 0; i < ALL_REAL_SEEDS; i++) {
      const state = newGame({ mode: 'real', playerId: d.id, seed: `real-all-${d.id}-${i}`, difficulty: 'normal' });
      const start = playerOvr(state.player);
      room = state.player.peakTarget! - start;
      const r = runCareer(state, 'best', i);
      if (state.player.position === 'ST' || state.player.position === 'CF') stSeasons.push(...r.hist);
      deltas.push(Math.max(...Object.values(r.ovrByAge)) - start);
      const n = Math.max(...Object.values(r.max99ByAge));
      if (n > 2) over2++;
      if (n > worst.n) worst = { id: d.id, n };
    }
    const delta = avg(deltas);
    if (Math.abs(delta - room) <= 1.5) inRange++;
    else misses.push(`${d.id} ${2018 - d.birthYear}세 목표 +${room.toFixed(0)} 결과 +${delta.toFixed(1)}`);
  }
  console.log(`  A등급 전체 ${all.length}명 × 시드 ${ALL_REAL_SEEDS}개: 커리어 중 99 능력치 3개 이상 ${over2}건 · 최대 ${worst.n}개 (${worst.id || '-'}) ${check('실제 선수 99 능력치 3개 이상', over2, 0, 0)}`);
  const share = inRange / all.length;
  // C.26: 시즌 20골 안팎 ST/CF (25경기 이상 출전, 17~23골) 시즌 평균 평점
  const st20 = stSeasons.filter((h) => h.apps >= 25 && h.goals >= 17 && h.goals <= 23);
  const stLow = stSeasons.filter((h) => h.apps >= 25 && h.goals <= 8);
  const stHigh = stSeasons.filter((h) => h.apps >= 25 && h.goals >= 28);
  console.log(`  [C.26 평점] 실제 선수 ST/CF 시즌 (25경기+): 17~23골 ${st20.length}시즌 평균 평점 ${st20.length ? avg(st20.map((h) => h.rating)).toFixed(2) : '-'} ${check('ST 20골 안팎 시즌 평균 평점', st20.length ? avg(st20.map((h) => h.rating)) : 0, 7.0, 7.4)}` +
    ` · 8골 이하 ${stLow.length}시즌 ${stLow.length ? avg(stLow.map((h) => h.rating)).toFixed(2) : '-'} · 28골 이상 ${stHigh.length}시즌 ${stHigh.length ? avg(stHigh.map((h) => h.rating)).toFixed(2) : '-'}`);
  console.log(`  정점 여지 ±1.5 안: ${inRange}/${all.length}명 (${(share * 100).toFixed(0)}%) ${check('실제 선수 정점 여지 적중률', share, 0.8, 1)}${misses.length ? ` · 벗어남: ${misses.join(', ')}` : ''}`);
}
{
  console.log('\n[C.23·C.25·C.27 위상] 약팀 배정 가상 유망주 30세 위상 중앙값. 목표(최적 배분): 일반 250~400 (스페셜), 레전더리 550~750 (탑클래스), 레전더리 30세까지 900+ 도달 10~20%, 레전더리 35세 900+ 25% 이하');
  for (const strategy of ['best', 'random'] as Strategy[]) {
    const perTier = (tier: Tier) => allRuns[strategy].slice(TIERS_ASC.indexOf(tier) * SEEDS_PER_TIER, (TIERS_ASC.indexOf(tier) + 1) * SEEDS_PER_TIER);
    const med = (t: Tier) => median(perTier(t).map((r) => r.repByAge[30] ?? 0));
    const wc = (t: Tier) => perTier(t).filter((r) => Object.entries(r.repByAge).some(([a, v]) => Number(a) <= 30 && v >= 900)).length / SEEDS_PER_TIER;
    const wc35 = (t: Tier) => perTier(t).filter((r) => (r.repByAge[35] ?? 0) >= 900).length / SEEDS_PER_TIER;
    const marks = strategy === 'best'
      ? ` · ${check('위상 중앙값 일반', med('normal'), 250, 400)}${check('위상 중앙값 레전더리', med('legendary'), 550, 750)}${check('레전더리 30세까지 월드클래스 도달', wc('legendary'), 0.1, 0.2, true)}${check('레전더리 35세 월드클래스 비율', wc35('legendary'), 0, 0.25, true)}`
      : '';
    console.log(`  ${strategy === 'best' ? '최적' : '무작위'}: ${TIERS_ASC.map((t) => `${TIER_NAMES_KO[t]} ${med(t).toFixed(0)}`).join(' / ')} · 30세까지 900+ ${TIERS_ASC.map((t) => `${(wc(t) * 100).toFixed(0)}%`).join(' / ')} · 35세 900+ ${TIERS_ASC.map((t) => `${(wc35(t) * 100).toFixed(0)}%`).join(' / ')}${marks}`);
  }
  if (env.DUMP) {
    const out = Object.fromEntries((['best', 'random'] as Strategy[]).map((st) => [st, allRuns[st].map((r, i) => ({ tier: TIERS_ASC[Math.floor(i / SEEDS_PER_TIER)], hist: r.hist, badgeAges: r.badgeAges }))]));
    import('node:fs').then((fs) => fs.writeFileSync(env.DUMP!, JSON.stringify(out)));
  }
}
{
  // C.47: 노익장(조건을 채운 시즌 노화 ×0.7, 사용자 확정)이 잘하는 30대 윙/풀백의 하락을 줄여 C.46 −4.5 → 약 −3.5. 윙/풀백 하한을 −4 → −3 으로 (남은 질문, 마스터 확인)
  console.log('\n[D.6 노화] 포지션군별 36세 − 30세 OVR (전 티어). 목표(최적 배분): 윙/풀백 −3~−6(C.47 노익장 반영), CB/CDM/CM −1~−2, ST/CAM 0~−2');
  const groups: [string, string[], number, number][] = [
    ['윙/풀백', ['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB'], -6, -3],
    ['CB/CDM/CM', ['CB', 'CDM', 'CM'], -3, -1],
    ['ST/CAM', ['ST', 'CF', 'CAM'], -2, 0],
  ];
  for (const strategy of ['best', 'random'] as Strategy[]) {
    const line = groups.map(([name, ps, lo, hi]) => {
      const rs = allRuns[strategy].filter((r) => ps.includes(r.position) && r.ovrByAge[36] !== undefined);
      const d = avg(rs.map((r) => r.ovrByAge[36]! - r.ovrByAge[30]!));
      const mark = strategy === 'best' ? ` ${check(`36-30 ${name}`, d, lo, hi)}` : '';
      return `${name} ${d >= 0 ? '+' : ''}${d.toFixed(1)}${mark}`;
    });
    console.log(`  ${strategy === 'best' ? '최적' : '무작위'}: ${line.join(' / ')}`);
  }
}

// ── C.42 이적 측정 (18.6·18.10, 가드 아님) ──
{
  const runs = [...allRuns.best, ...allRuns.random];
  const rows = runs.flatMap((r) => r.npc);
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((t, r) => t + r[k], 0);
  const rate = sum('moved') / sum('total');
  console.log(`\n[C.42 이적] 내 선수 정책 ${POLICY}, 한 팀 10시즌 배지 ${BALANCE.badges.oneClubEnabled ? '켬' : '끔'}`);
  console.log(`  NPC 시즌당 이동 ${(rate * 100).toFixed(1)}% (목표 5~15%) · 충성도 40 미만 ${(sum('lowMoved') / sum('lowLoy') * 100).toFixed(1)}% · 계약 만료 ${(sum('expMoved') / sum('exp') * 100).toFixed(1)}%`);
  console.log(`  내 선수: 비시즌 제안 평균 ${avg(runs.map((r) => r.offers)).toFixed(1)}개 · 커리어 이적 ${avg(runs.map((r) => r.moves)).toFixed(2)}회 · 한 팀 10시즌 배지 ${(runs.filter((r) => r.oneClub).length / runs.length * 100).toFixed(0)}%`);
  // 다른 정책 비교 (레전더리·일반 최적 배분 각 12 시드): 커리어 이적 횟수, 30세 OVR·위상
  const other = POLICY === 'stay' ? 'best' : 'stay';
  for (const pol of [POLICY, other] as const) {
    for (const tier of ['normal', 'legendary'] as Tier[]) {
      const rs = Array.from({ length: 12 }, (_, i) => {
        const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
        const state = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
        state.player.potentialTier = tier;
        return runCareer(state, 'best', i, pol);
      });
      console.log(`  정책 ${pol} ${TIER_NAMES_KO[tier]} 최적 12시드: 커리어 이적 ${avg(rs.map((r) => r.moves)).toFixed(2)}회 · 30세 OVR ${avg(rs.map((r) => r.ovrByAge[30] ?? 0)).toFixed(1)} · 30세 위상 중앙값 ${median(rs.map((r) => r.repByAge[30] ?? 0)).toFixed(0)} · 한 팀 배지 ${rs.filter((r) => r.oneClub).length}/12`);
    }
  }
}

// ── 회귀 가드 결과 (부록 A.1) ──
{
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n[회귀 가드] ${checks.length - failed.length}/${checks.length} 통과`);
  for (const c of failed) console.log(`  ✗ ${c.name}: ${c.value} (목표 ${c.min}~${c.max})`);
  if (CHECK && failed.length) (globalThis as { process?: { exit(code: number): never } }).process?.exit(1);
}
