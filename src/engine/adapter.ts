// playRound 어댑터 (E.14): 내 경기를 엔진(자동 모드)으로 돌리고 기존 MatchResult 로 바꾼다

import type { MatchEnv } from './env';
import type { RapportInput } from './rapport';
import { BALANCE, type Difficulty } from '../config/balance';
import type { MatchOutcome, MatchResult } from '../match';
import { matchXp } from '../match';
import { posGroup, type TeamRoster } from '../roster';
import type { FieldPosition } from '../positions';
import type { FieldAttributes } from '../attributes';
import type { Body } from '../body';
import { proficiencyPenalty } from '../proficiency';
import { ENGINE } from './config';
import { teamSetupFromRoster } from './setup';
import { engineTactics, formationLabel, slotPos, teamRoles, withSlots, type MyTactics } from '../myTactics';
import { buildResult, createMatch } from './sim';
import { buildReplay, captureFrame, type Replay, type ReplayFrame } from '../replay';
import type { EngineResult, PlayerSpec, PlayerStats, TeamSetup } from './types';
import type { Moment, MomentChoice, MomentControl } from './moments';
import type { CardInput } from './cards';
import type { MatchSim } from './sim';

export const MY_ID = 'me';

export interface MyMatchPlan {
  /** 선발이면 true */
  started: boolean;
  /** 출전 구간(분). 출전하지 않으면 null */
  minutes: { start: number; end: number } | null;
}

export interface MyPlayerInput {
  position: FieldPosition;
  attributes: FieldAttributes;
  fatigue: number;
  /** 폼 보정 (D.1, ±0.3) */
  form: number;
  /** 지금 포지션 숙련도 0~100 (없으면 100) */
  proficiency?: number;
  /** 신체·양발 (C.45). 없으면 보정 없음 */
  body?: Body;
  /** 등번호 (표시용) */
  shirt?: number;
  /** 경고·퇴장 배율 (다혈질) */
  cardMul?: number;
}

export interface EngineMatchInput {
  myRoster: TeamRoster;
  oppRoster: TeamRoster;
  myRating: number;
  oppRating: number;
  home: boolean;
  me: MyPlayerInput;
  plan: MyMatchPlan;
  difficulty: Difficulty;
  seed: number;
  worldSeed: string;
  bigMatch?: boolean;
  /** 리그 평균 레이팅 (데이터가 없는 팀의 style, E.18 A5) */
  leagueAvg?: number;
  /**
   * 내 팀 전술 (E.19, E3.6): 성향·세부 전술·포메이션·슬롯 역할, 내 선수는 고른 슬롯에 선발. 없으면 팀 데이터 전술과
   * 같은 포지션군 중 가장 약한 자리 (이전 동작, 측정 스크립트용)
   */
  myTactics?: MyTactics;
  /** 내 선수 결정 순간 (E.11): 직접/자동, 정지 빈도, 정책. 없으면 자동 */
  control?: MomentControl;
  /** 내 선수 카드 (C.36): 덱과 숙련도. 없으면 카드 없이 */
  cards?: CardInput;
  /** 날씨·심판 실행 배율 (C.74a). 없으면 맑음·보통 심판 */
  env?: Partial<MatchEnv>;
  /** 동료 호흡·상대 분석·패스 받는 빈도 (C.74c). 없으면 호흡 0·관계 보통·리포트 없음 */
  rapport?: RapportInput;
}

/** 경기 시작 스태미나 = 100 − 피로 × staminaPerFatigue (E.16) */
export function startStamina(fatigue: number): number {
  return Math.max(30, 100 - fatigue * ENGINE.match.staminaPerFatigue);
}

/** 내 선수가 들어갈 슬롯: 같은 포지션군 중 OVR 이 가장 낮은 선수 자리, 없으면 GK 를 뺀 가장 낮은 선수 */
function mySlot(setup: TeamSetup, pos: FieldPosition): number {
  const g = posGroup(pos);
  const outfield = setup.lineup.map((p, i) => ({ p, i })).filter(({ p }) => p.position !== 'GK' && p.slot >= 0);
  const same = outfield.filter(({ p }) => posGroup(p.position) === g);
  const pool = same.length ? same : outfield;
  return pool[pool.length - 1]!.i;
}

/** 숙련도 페널티 (C.24): 내 선수 필드 능력치 전부에서 포지션 OVR 페널티 점수만큼 뺀다 (빠른 경기의 proficientOvr 와 같은 의미) */
export function proficientAttrs(attrs: FieldAttributes, proficiency = 100): FieldAttributes {
  const pen = proficiencyPenalty(proficiency);
  if (pen <= 0) return { ...attrs };
  const out = {} as FieldAttributes;
  for (const [k, v] of Object.entries(attrs) as [keyof FieldAttributes, number][]) out[k] = Math.max(1, v - pen);
  return out;
}

export function buildMyMatch(m: EngineMatchInput) {
  const t = m.myTactics;
  const myRoster = t ? withSlots(m.myRoster, t) : m.myRoster;
  const mySetup = teamSetupFromRoster(myRoster, m.myRating, m.oppRating, m.worldSeed, undefined, m.leagueAvg, false);
  const oppSetup = teamSetupFromRoster(m.oppRoster, m.oppRating, m.myRating, m.worldSeed, undefined, m.leagueAvg);
  const meSpec: PlayerSpec = {
    id: MY_ID, name: '나', slot: -1, position: t ? slotPos(t, t.mySlot) : m.me.position, attrs: proficientAttrs(m.me.attributes, m.me.proficiency),
    stamina: startStamina(m.me.fatigue), form: m.me.form, isMe: true,
    ...(m.me.body ? { body: m.me.body } : {}), ...(m.me.shirt !== undefined ? { shirt: m.me.shirt } : {}),
    ...(m.me.cardMul && m.me.cardMul !== 1 ? { cardMul: m.me.cardMul } : {}),
  };
  if (t) {
    // 사용자 전술 (E.19): 성향·세부 전술 3단계 값, 슬롯 역할은 직접 고른 것 또는 성향 추천
    mySetup.tactics = engineTactics(t);
    if (t.custom) mySetup.formationName = formationLabel(t);
    const bySlot = new Map(mySetup.lineup.map((p) => [p.slot, p]));
    const roles = teamRoles(t, Array.from({ length: 11 }, (_, i) => (i === t.mySlot && m.plan.started ? meSpec.attrs : bySlot.get(i)?.gk ? undefined : bySlot.get(i)?.attrs)));
    for (const p of mySetup.lineup) p.role = roles[p.slot];
    meSpec.role = roles[t.mySlot];
  }
  if (m.plan.minutes) {
    if (m.plan.started) {
      const k = t ? mySetup.lineup.findIndex((p) => p.slot === t.mySlot) : -1;
      const i = k >= 0 ? k : mySlot(mySetup, m.me.position);
      meSpec.slot = mySetup.lineup[i]!.slot;
      mySetup.lineup[i] = meSpec;
    } else {
      mySetup.bench = [...mySetup.bench, meSpec];
    }
  }
  return createMatch({
    home: m.home ? mySetup : oppSetup,
    away: m.home ? oppSetup : mySetup,
    mode: 'auto',
    myPlayerId: m.plan.minutes ? MY_ID : undefined,
    difficulty: m.difficulty,
    seed: m.seed,
    bigMatch: m.bigMatch ?? false,
    ...(m.plan.minutes ? { myMinutes: m.plan.minutes } : {}),
    ...(m.control ? { control: m.control } : {}),
    ...(m.cards?.deck.length && m.plan.minutes ? { cards: m.cards } : {}),
    ...(m.env ? { env: m.env } : {}),
    ...(m.rapport && m.plan.minutes ? { rapport: m.rapport } : {}),
  });
}

export interface MyMatchOutput {
  result: MatchResult;
  engine: EngineResult;
  my: PlayerStats | null;
  /** 내 팀 쪽 (0 홈, 1 원정) */
  side: 0 | 1;
  /** 재생 데이터 (capture 일 때만) */
  replay?: Replay;
}

/** 엔진 결과 → 기존 MatchResult (E.2 toMatchResult) */
export function toMatchResult(r: EngineResult, side: 0 | 1, started: boolean, difficulty: Difficulty, bigMatch = false): MatchResult {
  const goalsFor = side === 0 ? r.homeGoals : r.awayGoals;
  const goalsAgainst = side === 0 ? r.awayGoals : r.homeGoals;
  const outcome: MatchOutcome = goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';
  const my = r.myStats;
  const minutes = my ? Math.max(1, my.minutes) : 0;
  if (!my || minutes === 0) {
    const xp = Math.round(BALANCE.matchXp.bench * BALANCE.difficulty[difficulty].xp);
    return { goalsFor, goalsAgainst, outcome, started: false, minutes: 0, goals: 0, assists: 0, rating: null, mom: false, xp };
  }
  const R = BALANCE.rating;
  const rating = Math.round(Math.min(R.max, Math.max(R.min, my.rating + BALANCE.difficulty[difficulty].rating)) * 10) / 10;
  const mom = rating >= R.momMin && outcome !== 'loss';
  const xp = matchXp(rating, outcome, mom, minutes, bigMatch, difficulty);
  return { goalsFor, goalsAgainst, outcome, started, minutes, goals: my.goals, assists: my.assists, rating, mom, xp };
}

/**
 * 내 경기 진행 (E.14 어댑터, E4): 결정 순간마다 멈출 수 있게 한 단계씩 돌린다. capture 면 위치 프레임을 frameInterval 마다 샘플링해
 * 재생 데이터(E5-lite, 24번)를 만든다. 같은 계산을 그대로 기록하므로 재생과 결과가 같다 (결정성)
 */
export class MyMatchRun {
  readonly sim: MatchSim;
  readonly side: 0 | 1;
  readonly frames: ReplayFrame[] = [];
  private next = ENGINE.time.frameInterval;

  constructor(readonly input: EngineMatchInput, readonly capture?: { teams: [string, string] }) {
    this.sim = buildMyMatch(input);
    this.side = input.home ? 0 : 1;
    if (capture) this.frames.push(captureFrame(this.sim.state));
  }

  get pending(): Moment | null {
    return this.sim.state.moments.pending;
  }

  /** 다음 결정 순간까지 (없으면 경기 끝까지) 돌린다. 멈춘 순간을 돌려준다 */
  advance(): Moment | null {
    const s = this.sim.state;
    if (!this.capture) {
      const r = this.sim.runUntilDecision();
      return r.kind === 'decision' ? r.moment : null;
    }
    while (!s.done) {
      if (s.moments.pending) return s.moments.pending;
      // 골 순간 (24.8): 엔진은 골과 같은 틱에 공을 킥오프 자리로 옮기므로, 골 직전 공 위치로 골 시각 프레임을 하나 더 남긴다
      const goals = s.teams[0].stats.goals + s.teams[1].stats.goals;
      const [bx, by, e0] = [s.ball.x, s.ball.y, s.elapsed];
      this.sim.step();
      if (s.moments.pending) {
        // 멈춘 순간의 정지 화면 (틱은 아직 끝나지 않았다)
        this.frames.push(captureFrame(s));
        return s.moments.pending;
      }
      this.afterTick(goals, bx, by, e0);
    }
    return null;
  }

  /** 결정 확정 후 그 틱을 마저 진행한다 */
  resolve(choice: MomentChoice): void {
    const s = this.sim.state;
    if (!s.moments.pending) return;
    const goals = s.teams[0].stats.goals + s.teams[1].stats.goals;
    const [bx, by, e0] = [s.ball.x, s.ball.y, s.elapsed];
    this.sim.resolve(choice);
    if (this.capture) this.afterTick(goals, bx, by, e0);
  }

  private afterTick(goals: number, bx: number, by: number, e0: number): void {
    const s = this.sim.state;
    const frames = this.frames;
    if (s.teams[0].stats.goals + s.teams[1].stats.goals > goals) {
      const f = captureFrame(s);
      const e = Math.round(e0 * 10) / 10;
      if (e > frames.at(-1)!.e) frames.push({ ...f, e, t: Math.round((s.t - (s.elapsed - e0)) * 10) / 10, ball: { x: bx, y: by, z: 0 } });
    }
    if (s.elapsed + 1e-9 >= this.next) {
      frames.push(captureFrame(s));
      this.next += ENGINE.time.frameInterval;
    }
  }

  /** 남은 결정은 맡기고 끝까지 돌린 뒤 결과 */
  finish(): MyMatchOutput {
    const s = this.sim.state;
    while (!s.done) {
      if (s.moments.pending) this.resolve('delegate');
      else if (this.advance() === null) break;
    }
    const engine = buildResult(s);
    let replay: Replay | undefined;
    if (this.capture) {
      // 같은 흐른 시간의 프레임이 둘이면(정지 화면) 뒤의 것만 남긴다
      const frames = this.frames.filter((f, i, all) => i === all.length - 1 || all[i + 1]!.e > f.e);
      const setups = [s.input.home, s.input.away] as const;
      replay = buildReplay(setups[0], setups[1], this.capture.teams, frames, engine, this.side, ENGINE.time.halfSeconds);
    }
    const m = this.input;
    const result = toMatchResult(engine, this.side, m.plan.started, m.difficulty, m.bigMatch);
    return { result, engine, my: engine.myStats, side: this.side, ...(replay ? { replay } : {}) };
  }
}

/** 내 경기를 한 번에 (자동 모드 또는 정책이 있는 직접 모드) */
export function playMyMatch(m: EngineMatchInput, capture?: { teams: [string, string] }): MyMatchOutput {
  const run = new MyMatchRun(m, capture);
  if (!capture) {
    run.sim.runToEnd();
    return run.finish();
  }
  return run.finish();
}

/** 경기 후 피로 증가 (E.16): 실제 이동 거리에서 환산. 90분 풀타임 평균 거리가 기존 +22 부근 */
export function fatigueFromDistance(distance: number): number {
  return (BALANCE.fatigue.perMatch90 * distance) / ENGINE.match.fatigueRefDistance;
}
