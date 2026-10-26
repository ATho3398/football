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

import {
  reputationTier, TIERS_ASC, TIER_NAMES_KO,
} from '../src/growth';
import { selectableRealPlayers } from '../src/game';
import { BALANCE } from '../src/config/balance';
import { assetScore } from '../src/wealth';
import type { InjuryGrade, Tier } from '../src/types';
import { END_AGE, jobKey, type CareerJob, type CareerMode, type Policy, type Run, type Strategy } from './balance/career';
import { runCareers } from './balance/pool';
import { writeStepSummary } from './balance/summary';

// 측정은 맑음·보통 심판 고정 (부록 C.74a)·측정용 덮어쓰기(VET·ONECLUB·COACH_SCALE·MED_SCALE·COACH_XP)는 scripts/balance/career.ts (워커도 같이)

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS_PER_TIER = Number(env.SEEDS ?? 48);
/** 레전더리 35세 900+ 가드 표본 (C.75k): 레전더리 최적 배분만 이 수까지 시드를 늘린다 (SEEDS 보다 작으면 SEEDS) */
const LEGEND_SEEDS = Number(env.LEGEND_SEEDS ?? 96);
/**
 * 내 선수 이적 정책 (C.42): stay = 제안 모두 거절·재계약 (C.41 까지와 같은 한 팀 커리어), best = 레이팅 +2 이상·주전/로테이션 제안 중 최고 수락.
 * 회귀 가드는 POLICY(기본 stay)로 판정하고, 다른 정책은 [C.42 이적] 측정 줄에 따로 보여 준다
 */
const POLICY = (env.POLICY ?? 'stay') as Policy;
/**
 * 스태프 정책 (C.68a): none = 스태프 없음 (C.67 까지와 같은 경로, 회귀 가드 판정 기본), full = 슬롯이 비면 모집·고용하는 코치 풀 투자 (autoStaff).
 * 기본 실행은 가드 뒤에 [C.68 재정] 줄로 full 도 매번 잰다 (마스터 P 2026-10-19: 레전더리 35세 900+ 13/48 = 0.271 — 기준선 12/48 이 경계라
 * 코치가 게이지 목표를 바꾸는 것만으로 시드 하나가 넘음, 배율 크기와 무관)
 */
const COACH = (env.COACH ?? 'none') as 'none' | 'full';
/**
 * 기록 보상 (C.74b, pending 77-10): 회귀 가드는 보상 끔(RECORDS 기본 off — 기록 추적·달성 판정만 돌고 XP·위상 0), 보상 켬은 가드 뒤 [C.74b 기록 보상] 측정 줄.
 * 레전더리 35세 900+ 기준선 12/48 = 0.25 경계를 XP 보상이 크기와 무관하게(5~20 모두) 시드 하나(legendary-26, 856 → 939)로 넘긴다 — C.68a 코치와 같은 처리
 */
const RECORDS = env.RECORDS === 'on';
/**
 * 대표팀 (C.76d): 회귀 가드는 대표팀 끔(NATIONAL 기본 off — 소집 확률 0, 대회 명단 없음), 켬은 가드 뒤 [C.76d 대표팀] 측정 줄.
 * 레전더리 30세까지 900+ 기준선 9/48 = 0.1875 경계를 대표팀 경기(A매치 출전 48경기, 월드컵 우승 없음)가 시드 하나(legendary-26, 887 → 920)로 넘긴다 — C.68a 코치·C.74b 기록 보상과 같은 처리
 */
const NATIONAL = env.NATIONAL === 'on';
/** 회귀 가드 판정 모드 */
const BASE: CareerMode = { coach: COACH, spend: false, records: RECORDS, national: NATIONAL };
/**
 * 코치 풀 투자 측정 줄·경제 점검 (C.68a·C.68b) 켜기. 로컬 기본 켜짐, CI(pages.yml balance:check)는 COACH_MEASURE=0 으로 끔
 * (마스터 P 2026-10-19 02:40: C.68a 뒤 CI 22 → 44분). 끄면 경제 가드 4개도 빠지고 회귀 가드 15개만 판정
 */
const COACH_MEASURE = env.COACH_MEASURE !== '0';

/**
 * C.78l: 커리어는 시드마다 독립이라 먼저 필요한 커리어를 모두 모아 워커로 병렬 실행하고(같은 명세는 한 번만 — 예: [C.42 이적] 정책 stay 12시드 = 본 표본 앞 12개),
 * 아래 출력·가드 계산은 결과를 명세로 찾아 C.78l 전과 같은 순서로 한다
 */
const plan = new Map<string, CareerJob>();
const prospect = (tier: Tier, i: number, strategy: Strategy, mode: CareerMode = BASE, policy: Policy = POLICY): CareerJob =>
  ({ kind: 'prospect', tier, i, strategy, policy, ...mode });
const real = (id: string, seed: string, i: number): CareerJob => ({ kind: 'real', id, seed, i, strategy: 'best', policy: POLICY, ...BASE });
const want = (job: CareerJob) => void plan.set(jobKey(job), job);
const seeds = (n: number, from = 0) => Array.from({ length: n }, (_, k) => from + k);

const REAL_SEEDS = Number(env.REAL_SEEDS ?? 12);
const ALL_REAL_SEEDS = Number(env.ALL_REAL_SEEDS ?? 6);
const FULL_SEEDS = Number(env.FULL_SEEDS ?? SEEDS_PER_TIER);
const ECON_SEEDS = Number(env.ECON_SEEDS ?? env.FULL_SEEDS ?? SEEDS_PER_TIER);
const COACH_FULL: CareerMode = { ...BASE, coach: 'full' };
const ECON: CareerMode = { ...BASE, coach: 'full', spend: true };
const REC_ON: CareerMode = { ...BASE, records: true };
const NAT_ON: CareerMode = { ...BASE, national: true };
const REAL_ALL = selectableRealPlayers();
const POLICY_OTHER: Policy = POLICY === 'stay' ? 'best' : 'stay';
for (const strategy of ['best', 'random'] as Strategy[]) for (const tier of TIERS_ASC) for (const i of seeds(SEEDS_PER_TIER)) want(prospect(tier, i, strategy));
for (const id of ['kane', 'rashford', 'son']) for (const i of seeds(REAL_SEEDS)) want(real(id, `real-${id}-${i}`, i));
for (const d of REAL_ALL) for (const i of seeds(ALL_REAL_SEEDS)) want(real(d.id, `real-all-${d.id}-${i}`, i));
for (const i of seeds(Math.max(0, LEGEND_SEEDS - SEEDS_PER_TIER), SEEDS_PER_TIER)) want(prospect('legendary', i, 'best'));
for (const pol of [POLICY, POLICY_OTHER]) for (const tier of ['normal', 'legendary'] as Tier[]) for (const i of seeds(12)) want(prospect(tier, i, 'best', BASE, pol));
if (COACH_MEASURE) {
  for (const [tier, strategy] of [['legendary', 'best'], ['normal', 'best'], ['legendary', 'random'], ['normal', 'random']] as const) for (const i of seeds(FULL_SEEDS)) want(prospect(tier, i, strategy, COACH_FULL));
  for (const tier of ['normal', 'legendary'] as Tier[]) for (const i of seeds(ECON_SEEDS)) want(prospect(tier, i, 'best', ECON));
  if (!RECORDS) for (const tier of ['legendary', 'normal'] as Tier[]) for (const i of seeds(SEEDS_PER_TIER)) want(prospect(tier, i, 'best', REC_ON));
  if (!NATIONAL) for (const tier of ['legendary', 'normal'] as Tier[]) for (const i of seeds(SEEDS_PER_TIER)) want(prospect(tier, i, 'best', NAT_ON));
}
const planned = [...plan.values()];
const results = new Map<string, Run>();
(await runCareers(planned)).forEach((r, k) => results.set(jobKey(planned[k]!), r));
const get = (job: CareerJob) => results.get(jobKey(job))!;
const simulateCareer = (tier: Tier, i: number, strategy: Strategy, mode: CareerMode = BASE) => get(prospect(tier, i, strategy, mode));

const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length;
const allRuns: Record<Strategy, Run[]> = { best: [], random: [] };

const ages = Array.from({ length: END_AGE - 17 + 1 }, (_, i) => 17 + i);
for (const strategy of ['best', 'random'] as Strategy[]) {
  console.log(`\n[${strategy === 'best' ? '최적 배분' : '무작위 배분'}] 티어별 평균 OVR (시드 ${SEEDS_PER_TIER}개, 포지션 순환, 난이도 보통)`);
  console.log(['티어'.padEnd(6), ...ages.map((a) => String(a).padStart(4)), '  선발/시즌', ' 30세 범위'].join(''));
  for (const tier of TIERS_ASC) {
    const runs = seeds(SEEDS_PER_TIER).map((i) => simulateCareer(tier, i, strategy));
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
  const grades: InjuryGrade[] = ['minor', 'moderate', 'major', 'seasonEnding'];
  const names: Record<InjuryGrade, string> = { minor: '경상', moderate: '중등도', major: '중상', seasonEnding: '시즌아웃' };
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
const realRuns = (id: string) => seeds(REAL_SEEDS).map((i) => get(real(id, `real-${id}-${i}`, i)));
{
  console.log(`\n[D.6/D.7 실제 선수] 최적 배분, 시드 ${REAL_SEEDS}개 평균. 목표(D.7): 정점 = 시작 OVR + 시작 나이별 여지 (≤20 +10 / 21~23 +8 / 24~26 +7 / 27~29 +4 / 30+ +2, ±1.5)`);
  for (const id of ['kane', 'rashford', 'son']) {
    const runs = realRuns(id);
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
  const all = REAL_ALL;
  const stSeasons: Run['hist'] = [];
  let over2 = 0;
  let worst = { id: '', n: 0 };
  let inRange = 0;
  const misses: string[] = [];
  for (const d of all) {
    const deltas: number[] = [];
    let room = 0;
    for (let i = 0; i < ALL_REAL_SEEDS; i++) {
      const r = get(real(d.id, `real-all-${d.id}-${i}`, i));
      const start = r.startOvr;
      room = r.peakRoom;
      if (r.position === 'ST' || r.position === 'CF') stSeasons.push(...r.hist);
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
  console.log('\n[C.23·C.25·C.27 위상] 약팀 배정 가상 유망주 30세 위상 중앙값. 목표(최적 배분): 일반 250~400 (스페셜), 레전더리 550~750 (탑클래스), 레전더리 30세까지 900+ 도달 10~20%, 레전더리 35세 900+ 30% 이하(시드 96, C.75k)');
  for (const strategy of ['best', 'random'] as Strategy[]) {
    const perTier = (tier: Tier) => allRuns[strategy].slice(TIERS_ASC.indexOf(tier) * SEEDS_PER_TIER, (TIERS_ASC.indexOf(tier) + 1) * SEEDS_PER_TIER);
    const med = (t: Tier) => median(perTier(t).map((r) => r.repByAge[30] ?? 0));
    const wc = (t: Tier) => perTier(t).filter((r) => Object.entries(r.repByAge).some(([a, v]) => Number(a) <= 30 && v >= 900)).length / SEEDS_PER_TIER;
    const wc35 = (t: Tier) => perTier(t).filter((r) => (r.repByAge[35] ?? 0) >= 900).length / SEEDS_PER_TIER;
    // C.75k (E-4 44g-b, 마스터 결정): 레전더리 35세 900+ 는 기준선 12/48 = 0.25 가 경계라 시드 하나로 네 번 뒤집혔다(C.67·C.68·C.73a·C.74b).
    // 그 행만 레전더리 최적 시드를 LEGEND_SEEDS(기본 96)로 늘리고(앞 48개 + 시드 48~95 추가) 기준 ≤ 0.30 (p 0.25 · n 96 의 1σ 0.044)
    let legend35 = '';
    if (strategy === 'best') {
      const extra = seeds(Math.max(0, LEGEND_SEEDS - SEEDS_PER_TIER), SEEDS_PER_TIER).map((i) => simulateCareer('legendary', i, 'best'));
      const lr = [...perTier('legendary'), ...extra];
      const n = lr.filter((r) => (r.repByAge[35] ?? 0) >= 900).length;
      legend35 = ` · 레전더리 35세 900+ ${n}/${lr.length} = ${(n / lr.length).toFixed(3)}(≤ 0.30) ${check('레전더리 35세 월드클래스 비율', n / lr.length, 0, 0.3, true)}`;
    }
    const marks = strategy === 'best'
      ? ` · ${check('위상 중앙값 일반', med('normal'), 250, 400)}${check('위상 중앙값 레전더리', med('legendary'), 550, 750)}${check('레전더리 30세까지 월드클래스 도달', wc('legendary'), 0.1, 0.2, true)}${legend35}`
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
  for (const pol of [POLICY, POLICY_OTHER]) {
    for (const tier of ['normal', 'legendary'] as Tier[]) {
      const rs = seeds(12).map((i) => get(prospect(tier, i, 'best', BASE, pol)));
      console.log(`  정책 ${pol} ${TIER_NAMES_KO[tier]} 최적 12시드: 커리어 이적 ${avg(rs.map((r) => r.moves)).toFixed(2)}회 · 30세 OVR ${avg(rs.map((r) => r.ovrByAge[30] ?? 0)).toFixed(1)} · 30세 위상 중앙값 ${median(rs.map((r) => r.repByAge[30] ?? 0)).toFixed(0)} · 한 팀 배지 ${rs.filter((r) => r.oneClub).length}/12`);
    }
  }
}

// ── C.68a 코치 풀 투자 측정 (가드 아님, 마스터 P 2026-10-19 01:05: 회귀 가드는 COACH=none, full 은 매번 측정 줄로) ──
// 레전더리 35세 900+ 기준선이 12/48 = 0.25 경계라 시드 하나로 뒤집힌다 (부록 C.68a). 시드 FULL_SEEDS(기본 48)
if (COACH_MEASURE) {
  const fullRuns = (tier: Tier, strategy: Strategy) => seeds(FULL_SEEDS).map((i) => simulateCareer(tier, i, strategy, COACH_FULL));
  const lb = fullRuns('legendary', 'best');
  const nb = fullRuns('normal', 'best');
  const lr = fullRuns('legendary', 'random');
  const nr = fullRuns('normal', 'random');
  const at30 = (rs: Run[]) => avg(rs.map((r) => r.ovrByAge[30] ?? 0)).toFixed(1);
  const wc30 = lb.filter((r) => Object.entries(r.repByAge).some(([a, v]) => Number(a) <= 30 && v >= 900)).length;
  const wc35 = lb.filter((r) => (r.repByAge[35] ?? 0) >= 900).length;
  console.log(`\n[C.68 재정] 코치 풀 투자(COACH=full, 시드 ${FULL_SEEDS}) — 가드 아님, 기준 비교용`);
  console.log(`  30세 OVR 최적 일반 ${at30(nb)}(74~78) · 레전더리 ${at30(lb)}(84~88) · 무작위 일반 ${at30(nr)}(68~72) · 레전더리 ${at30(lr)}(79~83)` +
    ` | 레전더리 30세까지 900+ ${wc30}/${FULL_SEEDS} = ${(wc30 / FULL_SEEDS).toFixed(3)}(0.1~0.2) · 35세 900+ ${wc35}/${FULL_SEEDS} = ${(wc35 / FULL_SEEDS).toFixed(3)}(0~0.25)`);
  console.log('  시즌 순수입·잔고 평균 (억 원, 최적 배분)');
  for (const [name, runs] of [['일반', nb], ['레전더리', lb]] as const) {
    const at = (age: number, k: 'net' | 'cash' | 'staff') => avg(runs.map((r) => r.money.find((x) => x.age === age)?.[k] ?? 0));
    const neg = runs.reduce((t, r) => t + r.money.filter((x) => x.need < 0).length, 0);
    const all = runs.reduce((t, r) => t + r.money.length, 0);
    console.log(`  ${name.padEnd(6)} 순수입 18세 ${(at(18, 'net') / 1e4).toFixed(1)} · 24세 ${(at(24, 'net') / 1e4).toFixed(1)} · 30세 ${(at(30, 'net') / 1e4).toFixed(1)} · 33세 ${(at(33, 'net') / 1e4).toFixed(1)}` +
      ` | 잔고 30세 ${(at(30, 'cash') / 1e4).toFixed(0)} · 36세 ${(at(36, 'cash') / 1e4).toFixed(0)} | 스태프 24세 ${at(24, 'staff').toFixed(1)}명 | 필수 순수입 음수 시즌 ${neg}/${all}`);
  }
}

// ── C.68b 경제 점검 (19.11): 코치 풀 투자 + 평범한 지출(autoSpend: 집·차·기부(15억 넘는 순수입의 60% + 5%)·남는 돈 20% 투자), 최적 배분 ──
if (COACH_MEASURE) {
  const runsOf = (tier: Tier) => seeds(ECON_SEEDS).map((i) => simulateCareer(tier, i, 'best', ECON));
  const econRuns = [['일반', runsOf('normal')], ['레전더리', runsOf('legendary')]] as const;
  console.log(`\n[C.68b 경제] 코치 풀 투자 + 평범한 지출(시드 ${ECON_SEEDS}, 최적 배분) — 19.11 표: 평범한 유망주 약 178억·자산 74 · 스타 약 346억·84`);
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
  const econ: { name: string; neg: number; all: number; score: number }[] = [];
  for (const [name, runs] of econRuns) {
    const at = (age: number, k: 'net' | 'need' | 'cash') => q(runs.map((r) => r.money.find((x) => x.age === age)?.[k] ?? 0), 0.5);
    const neg = runs.reduce((t, r) => t + r.money.filter((x) => x.need < 0).length, 0);
    const all = runs.reduce((t, r) => t + r.money.length, 0);
    const scores = runs.map((r) => assetScore(r.worth));
    const worths = runs.map((r) => r.worth / 1e4);
    console.log(`  ${name.padEnd(6)} 순수입 중앙 18세 ${(at(18, 'net') / 1e4).toFixed(1)} · 24세 ${(at(24, 'net') / 1e4).toFixed(1)} · 30세 ${(at(30, 'net') / 1e4).toFixed(1)} · 33세 ${(at(33, 'net') / 1e4).toFixed(1)}억` +
      ` | 커리어 누적 순수입 중앙 ${q(runs.map((r) => r.career / 1e4), 0.5).toFixed(0)}억 · 은퇴 순자산 중앙 ${q(worths, 0.5).toFixed(0)}억(10% ${q(worths, 0.1).toFixed(0)} · 90% ${q(worths, 0.9).toFixed(0)})` +
      ` | 자산 점수 평균 ${avg(scores).toFixed(1)}(10% ${q(scores, 0.1)} · 중앙 ${q(scores, 0.5)} · 90% ${q(scores, 0.9)}) | 필수 순수입 음수 시즌 ${neg}/${all}`);
    econ.push({ name, neg, all, score: avg(scores) });
  }
  // 경제 가드 (넓은 범위, C.68b): 필수 순수입(고르는 지출 뺌) 음수 시즌 ≤ 5%, 자산 점수 평균 일반 55~90 · 레전더리 65~95
  for (const e of econ) {
    checks.push({ name: `[C.68b 경제] ${e.name} 필수 순수입 음수 시즌 비율`, value: Number((e.neg / Math.max(1, e.all)).toFixed(3)), min: 0, max: 0.05, ok: e.neg / Math.max(1, e.all) <= 0.05 });
    const [lo, hi] = e.name === '일반' ? [55, 90] : [65, 95];
    checks.push({ name: `[C.68b 경제] ${e.name} 자산 점수 평균`, value: Number(e.score.toFixed(1)), min: lo, max: hi, ok: e.score >= lo && e.score <= hi });
  }
}

// ── C.74b 기록 보상 측정 (가드 아님): 보상을 켠 레전더리·일반 최적 배분 ──
if (COACH_MEASURE && !RECORDS) {
  const runs = (tier: Tier) => seeds(SEEDS_PER_TIER).map((i) => simulateCareer(tier, i, 'best', REC_ON));
  const lb = runs('legendary');
  const nb = runs('normal');
  const at30 = (rs: Run[]) => avg(rs.map((r) => r.ovrByAge[30] ?? 0)).toFixed(1);
  const wc30 = lb.filter((r) => Object.entries(r.repByAge).some(([a, v]) => Number(a) <= 30 && v >= 900)).length;
  const wc35 = lb.filter((r) => (r.repByAge[35] ?? 0) >= 900).length;
  const d36 = (rs: Run[]) => avg(rs.filter((r) => r.ovrByAge[36] !== undefined).map((r) => (r.ovrByAge[36] ?? 0) - (r.ovrByAge[30] ?? 0))).toFixed(1);
  console.log(`\n[C.74b 기록 보상] 보상 켬(RECORDS=on, 시드 ${SEEDS_PER_TIER}, 최적 배분) — 가드 아님, 기준 비교용`);
  console.log(`  30세 OVR 일반 ${at30(nb)}(74~78) · 레전더리 ${at30(lb)}(84~88) | 레전더리 30세까지 900+ ${wc30}/${SEEDS_PER_TIER} = ${(wc30 / SEEDS_PER_TIER).toFixed(3)}(0.1~0.2) · 35세 900+ ${wc35}/${SEEDS_PER_TIER} = ${(wc35 / SEEDS_PER_TIER).toFixed(3)}(0~0.25) | 36−30 OVR 일반 ${d36(nb)} · 레전더리 ${d36(lb)}`);
}

// ── C.76d 대표팀 측정 (가드 아님): 대표팀을 켠 레전더리·일반 최적 배분 ──
if (COACH_MEASURE && !NATIONAL) {
  const runs = (tier: Tier) => seeds(SEEDS_PER_TIER).map((i) => simulateCareer(tier, i, 'best', NAT_ON));
  const lb = runs('legendary');
  const nb = runs('normal');
  const at30 = (rs: Run[]) => avg(rs.map((r) => r.ovrByAge[30] ?? 0)).toFixed(1);
  const wc30 = lb.filter((r) => Object.entries(r.repByAge).some(([a, v]) => Number(a) <= 30 && v >= 900)).length;
  const wc35 = lb.filter((r) => (r.repByAge[35] ?? 0) >= 900).length;
  const inj = (rs: Run[]) => { const l = rs.flatMap((r) => r.seasonLog).filter((x) => x.minutes > 0); return (l.reduce((t, x) => t + x.injuries, 0) / l.reduce((t, x) => t + x.minutes, 0) * 38 * 90).toFixed(2); };
  console.log(`\n[C.76d 대표팀] 대표팀 켬(NATIONAL=on, 시드 ${SEEDS_PER_TIER}, 최적 배분) — 가드 아님, 기준 비교용`);
  console.log(`  30세 OVR 일반 ${at30(nb)}(74~78) · 레전더리 ${at30(lb)}(84~88) | 레전더리 30세까지 900+ ${wc30}/${SEEDS_PER_TIER} = ${(wc30 / SEEDS_PER_TIER).toFixed(3)}(0.1~0.2) · 35세 900+ ${wc35}/${SEEDS_PER_TIER} = ${(wc35 / SEEDS_PER_TIER).toFixed(3)} | 리그 부상 풀타임 환산 일반 ${inj(nb)} · 레전더리 ${inj(lb)}`);
}

// ── 회귀 가드 결과 (부록 A.1) ──
{
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n[회귀 가드] ${checks.length - failed.length}/${checks.length} 통과`);
  for (const c of failed) console.log(`  ✗ ${c.name}: ${c.value} (목표 ${c.min}~${c.max})`);
  writeStepSummary(checks);
  if (CHECK && failed.length) (globalThis as { process?: { exit(code: number): never } }).process?.exit(1);
}
