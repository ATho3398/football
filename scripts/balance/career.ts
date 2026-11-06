// 밸런스 점검 커리어 1개 (C.78l): 메인 스레드와 워커(worker_threads)가 같은 함수를 쓴다.
// 결과는 작업 명세(티어·시드·전략·정책·측정 모드)만으로 정해진다 — 워커 수·실행 순서와 무관.

import { FIELD_ATTRIBUTES } from '../../src/attributes';
import { autoAllocate, playerOvr, raiseAttribute, raiseBlock } from '../../src/growth';
import { autoMarket, newGame, playRound, startNextSeason, type GameState } from '../../src/game';
import { BALANCE } from '../../src/config/balance';
import { isOutside } from '../../src/transfer';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import { createRng } from '../../src/rng';
import { autoStaff, CHOICE_CATS, ensureMoney, flowsIn, flowsOut } from '../../src/money';
import { careerNet, autoSpend, netWorth } from '../../src/wealth';
import type { InjuryGrade, Tier } from '../../src/types';
import { setEnvironmentFixed } from '../../src/weather';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
/** 측정용: 고령 XP 감쇠 덮어쓰기 (C.49), 예 VET='[[30,0.7],[32,0.5]]' */
if (env.VET) (BALANCE.matchXp as { veteranMultiplier: [number, number][] }).veteranMultiplier = JSON.parse(env.VET);
if (env.ONECLUB !== undefined) (BALANCE.badges as { oneClubEnabled: boolean }).oneClubEnabled = env.ONECLUB === '1';
/** 측정용 (C.68a): 코치 배율 배수 COACH_SCALE, XP 몫 COACH_XP */
if (env.COACH_SCALE) for (const k of Object.keys(BALANCE.staff.coach.boost)) (BALANCE.staff.coach.boost as Record<string, number>)[k]! *= Number(env.COACH_SCALE);
if (env.MED_SCALE) for (const r of Object.values(BALANCE.staff.medical)) for (const k of Object.keys(r)) (r as Record<string, number>)[k]! *= Number(env.MED_SCALE);
if (env.COACH_XP !== undefined) (BALANCE.staff.coach as { xpShare: number }).xpShare = Number(env.COACH_XP);

/** 기록 보상 (C.74b) 켬/끔 — 끄면 XP·위상 보상 0 */
const RECORD_REWARD = structuredClone(BALANCE.records.reward) as Record<string, [number, number]>;
function setRecordReward(on: boolean) {
  const r = BALANCE.records.reward as unknown as Record<string, [number, number]>;
  for (const k of Object.keys(RECORD_REWARD)) r[k] = on ? [...RECORD_REWARD[k]!] : [0, 0];
}
/** 대표팀 (C.76d) 켬/끔 — 끄면 소집 확률 0 */
const NATIONAL_CALLUP = structuredClone(BALANCE.national.callup) as Record<string, number>;
function setNational(on: boolean) {
  const c = BALANCE.national.callup as unknown as Record<string, number>;
  for (const k of Object.keys(NATIONAL_CALLUP)) if (k !== 'minAge') c[k] = on ? NATIONAL_CALLUP[k]! : 0;
}

export const END_AGE = 37;
export type Strategy = 'best' | 'random';
export type Policy = 'stay' | 'best';
/** 측정 모드: coach = 스태프 정책 (C.68a), spend = 평범한 지출 (C.68b), records = 기록 보상 (C.74b), national = 대표팀 (C.76d) */
export interface CareerMode { coach: 'none' | 'full'; spend: boolean; records: boolean; national: boolean }
export type CareerJob =
  /** 가상 유망주: 시드 `balance-<tier>-<i>`, 포지션 순환 */
  | ({ kind: 'prospect'; tier: Tier; i: number; strategy: Strategy; policy: Policy } & CareerMode)
  /** 실제 선수: 시드 문자열 그대로 (`real-<id>-<i>`, `real-all-<id>-<i>`) */
  | ({ kind: 'real'; id: string; seed: string; i: number; strategy: Strategy; policy: Policy } & CareerMode);

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

/** 능력치 high 이상 개수 */
const countAtLeast = (state: GameState, high: number) => FIELD_ATTRIBUTES.filter((a) => state.player.attributes[a] >= high).length;

function runCareer(state: GameState, strategy: Strategy, rngSeed: number, policy: Policy, mode: CareerMode) {
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
  const money: { age: number; net: number; need: number; cash: number; staff: number; worth: number }[] = [];
  while (state.player.age < END_AGE) {
    const snap = Object.values(state.rosters).flatMap((r) => r.players.map((p) => ({ id: p.id, low: p.loyalty < 40, exp: p.contractEnd <= state.league.season + 1 })));
    const n0 = state.transfers.length;
    while (state.phase === 'season') {
      const report = playRound(state, { engine: 'quick' });
      if (mode.coach === 'full') autoStaff(state);
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
    // 재정 (C.68a): 시즌 순수입 (비시즌 몫까지 들어간 지난 시즌 합계) · 잔고 · 스태프 수. C.68b: 순자산, 코치 풀 투자 측정이면 평범한 지출(autoSpend)
    const h = ensureMoney(state).history.at(-1)!;
    const net = flowsIn(h.flows) - flowsOut(h.flows);
    // 필수 순수입 = 순수입에서 고르는 지출(카드·집·차 구매·기부)을 뺀 것 — 코치 풀 투자에도 양수인지 (19.11)
    money.push({ age: state.player.age - 1, net, need: net - CHOICE_CATS.reduce((t, c) => t + (h.flows[c] ?? 0), 0), cash: h.cash, staff: ensureMoney(state).staff.length, worth: netWorth(state) });
    if (mode.spend) autoSpend(state);
  }
  const moves = state.market.moves.filter((m) => !m.back).length;
  const intoLeague = state.transfers.filter((r) => !isOutside(r.to)).length;
  const hist = state.player.history.map((h) => ({ age: h.age, xp: h.achievementXp, moms: h.moms, gi: h.goals + h.assists, apps: h.apps, goals: h.goals, rating: h.apps ? h.ratingSum / h.apps : 0 }));
  const badgeAges = state.player.badges.map((b) => state.player.history.find((h) => h.season === b.season)?.age ?? 0);
  return {
    ovrByAge, repByAge, high95ByAge, max99ByAge, starts: starts / seasons, injuries, seasonLog, hist, badgeAges,
    offers: offers / Math.max(1, seasons), moves, npc, intoLeague, oneClub: state.player.badges.some((b) => b.id === 'oneClub10'), money,
    career: careerNet(state), worth: netWorth(state),
  };
}

/** 작업 1개 실행. position·시작 OVR·정점 여지(peakRoom)는 실제 선수 점검(D.6/D.7)용 */
export function runCareerJob(job: CareerJob) {
  setRecordReward(job.records);
  setNational(job.national);
  const state = job.kind === 'prospect'
    ? newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[job.i % PLAYABLE_POSITIONS.length]!, seed: `balance-${job.tier}-${job.i}`, difficulty: 'normal' })
    : newGame({ mode: 'real', playerId: job.id, seed: job.seed, difficulty: 'normal' });
  if (job.kind === 'prospect') state.player.potentialTier = job.tier;
  const position = job.kind === 'prospect' ? PLAYABLE_POSITIONS[job.i % PLAYABLE_POSITIONS.length]! : state.player.position;
  const startOvr = playerOvr(state.player);
  const peakRoom = (state.player.peakTarget ?? startOvr) - startOvr;
  return { position, startOvr, peakRoom, ...runCareer(state, job.strategy, job.i, job.policy, job) };
}

export type Run = ReturnType<typeof runCareerJob>;
/** 같은 계산을 한 번만 돌리기 위한 작업 열쇠 (명세가 같으면 결과도 같다) */
export const jobKey = (job: CareerJob) => JSON.stringify(job);
