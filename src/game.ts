// 게임 진행: 새 게임, 라운드 진행, 시즌 종료, 다음 시즌, 은퇴 (B.2~B.6)

import { A_GRADE_PLAYERS } from '../data/players';
import { BALANCE, BALANCE_VERSION, type Difficulty } from './config/balance';
import type { Replay } from './replay';
import { generatePlayer } from './generate';
import {
  addXp, applyAging, applyAutoGrowth, applyVeteranGrowth, NO_HONORS, playerOvr, randInt, realPeakTarget, reputationFloor,
  reputationFloorTier, veteranXpMultiplier, type AttributeDelta,
} from './growth';
import {
  CLUB_TO_TEAM, createLeague, initialTeams, leaguePosition, nextSeasonLeague, recordResult, simulateScore, teamById,
  type LeagueState,
} from './league';
import { simulateMatch, startProbability, type MatchResult } from './match';
import { fatigueFromDistance, playMyMatch, type EngineMatchInput, type MyMatchOutput, type MyMatchPlan } from './engine/adapter';
import type { ControlMode, DecisionRecord, MomentControl, StopLevel } from './engine/moments';
import { formBonus, pushRating } from './form';
import { addRecord, emptyRecord, recordFromStats, type MatchLogEntry, type MatchRecord } from './matchRecord';
import { healWeek, rollInjury } from './injury';
import { createNpc, growNpc, type NpcState } from './npc';
import {
  createRosters, syncRealPlayers, teamRatings, updateRostersForSeason, type Rosters,
} from './roster';
import { positionOvr, type PlayablePosition } from './positions';
import { decayFormerPosition, gainProficiency, initialProficiency, proficiencyOf, proficientOvr } from './proficiency';
import { awardBadges } from './badges';
import { generateProspectAttributes, randomName, rollPotentialTier, rollStartOvr } from './prospect';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { Badge, FieldPlayerData, Injury, PlayerState, SeasonRecord, SeasonStats, Tier } from './types';
import { PATCH_LABEL } from './version';
import { initialGuide, refreshUnlocks, type GuideState } from './unlocks';
import { slotPos, teamDefaultTactics, type MyTactics } from './myTactics';
import type { FieldPosition } from './positions';

/** 세이브 필드 구조가 바뀌면 올린다 (밸런스 수치 변경과 구분) */
export const SAVE_FORMAT_VERSION = 14;

export type Phase = 'season' | 'offseason' | 'retired';

export interface MatchReport {
  season: number;
  /** 1부터 */
  round: number;
  opponentId: string;
  home: boolean;
  result: MatchResult;
  levelsGained: number;
  ovr: number;
  /** 이 경기에 적용된 폼 보정 */
  formBonus: number;
  /** 이 경기에서 다쳤으면 그 부상 */
  injury?: Injury;
  /** 부상으로 결장한 주 */
  injured?: boolean;
  /** 이번 주로 부상에서 회복 */
  recovered?: boolean;
  /** 출장 정지로 결장 (E.10) */
  suspended?: boolean;
  /** 이 경기에서 받은 카드 */
  cards?: { yellows: number; red: boolean };
  /** 엔진 경기 요약 (빠른 경기면 없음) */
  engine?: EngineSummary;
  /** 내 선수 경기 기록 (부록 C.30). 엔진 경기에 출전했을 때만 */
  rec?: MatchRecord;
  /** 내 결정 기록 (E.11, I.17 10번). 직접 모드로 멈춘 순간이 있었을 때만 */
  decisions?: DecisionRecord[];
  /**
   * 부진 연속 감점 (부록 C.25): 이 경기로 잃은 위상과 연속 경기 수, 기준 평점.
   * blocked 는 티어 하한에 막혀 사라진 감점 (부록 C.27). threshold 는 C.27 이전 세이브에는 없다
   */
  slump?: SlumpReport;
}

export interface SlumpReport { points: number; streak: number; threshold?: number; blocked?: number }

/** 위상 감점 하나 (부록 C.27): 실제로 뺀 값과 티어 하한에 막혀 사라진 값 */
export interface RepDeduction { points: number; blocked: number }

export interface EngineSummary {
  /** 내 팀 점유율 % */
  possession: number;
  /** [내 팀, 상대] */
  shots: [number, number];
  shotsOnTarget: [number, number];
  my?: { passes: number; passesCompleted: number; shots: number; tackles: number; interceptions: number; dribbles: number; distance: number };
}

export interface SeasonSummary {
  season: number;
  /** 그 시즌의 나이 */
  age: number;
  leaguePosition: number;
  achievements: { label: string; xp: number }[];
  achievementXp: number;
  levelsGained: number;
  reputationBefore: number;
  reputationAfter: number;
  autoGrowth: AttributeDelta;
  /** 이번 시즌 받은 레전드 배지 (D.4). 이전 버전 세이브에는 없다 */
  badges?: Badge[];
  /** 시즌 중 부진 감점 합계와 시즌 끝 순위 감점 (부록 C.25). 이전 버전 세이브에는 없다 */
  slumpPenalty?: number;
  rankPenalty?: { expected: number; pos: number; points: number; blocked?: number };
  /** 티어 하한 (부록 C.27): 시즌 중 부진 감점과 시즌 감소 중 바닥에 막힌 값, 레드카드·출전 시간 부족 감점, 이번 시즌 처음 닿은 하한 티어 */
  slumpBlocked?: number;
  decayBlocked?: number;
  redPenalty?: RepDeduction & { reds: number };
  minutesPenalty?: RepDeduction & { share: number };
  tierReached?: Tier;
  /** 노련함 능력치 성장 (6.1.1). 이전 버전 세이브에는 없다 */
  veteranGrowth?: AttributeDelta;
  aging: AttributeDelta;
  ovrBefore: number;
  ovrAfter: number;
  canRetire: boolean;
  forcedRetire: boolean;
}

export interface GameState {
  saveFormat: number;
  balanceVersion: number;
  /** 새 게임을 시작한 패치 이름 (21.5.1). null 이면 기록하기 전 세이브 */
  startPatch: string | null;
  worldSeed: string;
  difficulty: Difficulty;
  phase: Phase;
  player: PlayerState;
  league: LeagueState;
  npcs: NpcState[];
  /** 팀 로스터 세이브 정보 (23번): 시즌 갱신 횟수. 로스터 자체는 시드로 다시 만든다 */
  roster: { updates: number };
  /** 팀별 로스터. 세이브에 담지 않고 불러올 때 rebuildRosters 로 재생성한다 */
  rosters: Rosters;
  lastMatch?: MatchReport;
  lastSeasonSummary?: SeasonSummary;
  /** 단계적 공개와 첫 플레이 안내 상태 (21.3·21.4, 부록 C.23) */
  guide: GuideState;
  /** 이번 시즌 내 경기 목록 (부록 C.30). 다음 시즌을 시작하면 비운다 */
  matchLog: MatchLogEntry[];
  /** 내 팀 전술 (E.19, 부록 C.32): 저장한 기본 전술. 바꾸기 전까지 매 경기 쓴다 */
  tactics: MyTactics;
  /** 내 선수 결정 순간 설정 (E.11, 부록 C.34): 직접/자동, 정지 빈도 */
  control: MatchControl;
}

export interface MatchControl {
  mode: ControlMode;
  stop: StopLevel;
}

export type NewGameOptions =
  | { mode: 'prospect'; name?: string; position: PlayablePosition; seed?: string; difficulty: Difficulty }
  | { mode: 'real'; playerId: string; seed?: string; difficulty: Difficulty };

const rngFor = (seed: string, ...parts: (string | number)[]): Rng => createRng(hashSeed([seed, ...parts].join(':')));

export function emptySeasonStats(): SeasonStats {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, matchXp: 0, moms: 0, injuries: 0, injuredWeeks: 0,
    yellows: 0, reds: 0, slumpPenalty: 0, rec: emptyRecord(), recApps: 0,
  };
}

/** 실제 선수로 시작 가능한 선수: 데이터가 있고 소속팀이 리그에 있는 선수 */
export function selectableRealPlayers(): FieldPlayerData[] {
  return A_GRADE_PLAYERS.filter((p) => CLUB_TO_TEAM[p.club] !== undefined);
}

export function randomSeed(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36);
}

/** 내 선수를 뺀 실제 A등급 NPC 초기 상태 */
function initialNpcs(worldSeed: string, realPlayerId: string | undefined): NpcState[] {
  return A_GRADE_PLAYERS.filter((p) => p.id !== realPlayerId).map((p) => createNpc(p, worldSeed, BALANCE.newGame.startYear));
}

/**
 * 로스터 재생성 (23번): 시작 로스터를 시드로 만들고 시즌 갱신을 updates 번 다시 적용한다.
 * 성장, 노화, 은퇴, 신인 보충은 모두 시드로 정해지므로 세이브에는 updates 만 있으면 된다.
 * 실제 선수 능력치는 마지막에 세이브의 NPC 상태와 맞춘다
 */
export function rebuildRosters(
  worldSeed: string, realPlayerId: string | undefined, updates: number, savedNpcs?: NpcState[],
): Rosters {
  const start = BALANCE.newGame.startYear;
  const teams = initialTeams();
  const base = Object.fromEntries(teams.map((t) => [t.id, t.baseRating]));
  let npcs = initialNpcs(worldSeed, realPlayerId);
  let rosters = createRosters(worldSeed, start, teams, npcs);
  for (let k = 0; k < updates; k++) {
    npcs = npcs.map((n) => growNpc(n, worldSeed, start + k));
    rosters = updateRostersForSeason(rosters, worldSeed, start + k, base, npcs);
  }
  if (savedNpcs) syncRealPlayers(rosters, savedNpcs);
  return rosters;
}

export function newGame(opts: NewGameOptions): GameState {
  const worldSeed = opts.seed?.trim() || randomSeed();
  const season = BALANCE.newGame.startYear;
  const league = createLeague(worldSeed, season);
  const rng = rngFor(worldSeed, 'new-player');
  // 팀 레이팅 = 로스터 라인업 평균 (23번). 내 선수(실제 선수)는 로스터에서 빠진다
  const realPlayerId = opts.mode === 'real' ? opts.playerId : undefined;
  const npcs = initialNpcs(worldSeed, realPlayerId);
  const rosters = rebuildRosters(worldSeed, realPlayerId, 0);
  const ratings = teamRatings(rosters);
  for (const t of league.teams) t.rating = ratings[t.id] ?? t.rating;

  let player: PlayerState;
  const base = {
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, coachWarned: false, injury: null, recentRatings: [], slumpStreak: 0, season: emptySeasonStats(), history: [], suspended: 0,
  };

  if (opts.mode === 'prospect') {
    const potentialTier = rollPotentialTier(rng);
    const ovr = rollStartOvr(rng);
    const attributes = generateProspectAttributes(opts.position, ovr, rng);
    const byRating = [...league.teams].sort((a, b) => b.rating - a.rating);
    const { min, max } = BALANCE.newGame.teamRankRange;
    const team = byRating[randInt(rng, min, max) - 1]!;
    player = {
      ...base,
      name: opts.name?.trim() || randomName(rng),
      position: opts.position,
      age: BALANCE.newGame.startAge,
      teamId: team.id,
      attributes,
      potentialTier,
      reputation: 0,
      proficiency: initialProficiency(opts.position),
      formerPositions: [],
      badges: [],
      honors: { ...NO_HONORS },
    };
  } else {
    const data = selectableRealPlayers().find((p) => p.id === opts.playerId);
    if (!data) throw new Error(`선택할 수 없는 선수: ${opts.playerId}`);
    const gen = generatePlayer(data, worldSeed);
    const age = season - data.birthYear;
    player = {
      ...base,
      name: data.nameKo,
      realPlayerId: data.id,
      peakTarget: realPeakTarget(positionOvr(gen.attributes, data.position), age),
      position: data.position,
      age,
      teamId: CLUB_TO_TEAM[data.club]!,
      attributes: gen.attributes,
      potentialTier: data.potentialTier,
      reputation: data.reputation,
      proficiency: initialProficiency(data.position, data.subPositions),
      formerPositions: [],
      badges: [],
      honors: { ...NO_HONORS },
    };
  }

  return {
    saveFormat: SAVE_FORMAT_VERSION,
    balanceVersion: BALANCE_VERSION,
    startPatch: PATCH_LABEL,
    worldSeed,
    difficulty: opts.difficulty,
    phase: 'season',
    player,
    league,
    npcs,
    roster: { updates: 0 },
    rosters,
    guide: initialGuide(),
    matchLog: [],
    control: { mode: 'direct', stop: 'important' },
    tactics: teamDefaultTactics(player.teamId, rosters[player.teamId], player.position),
  };
}

/** 내 선수가 이번 경기에 뛰는 자리 (전술의 내 슬롯, E.19 ②) */
export function myMatchPosition(state: GameState): FieldPosition {
  return slotPos(state.tactics, state.tactics.mySlot) as FieldPosition;
}

export function seasonLength(state: GameState): number {
  return state.league.schedule.length;
}

/** 이번 라운드 내 팀 경기 */
export function nextFixture(state: GameState): { opponentId: string; home: boolean } | null {
  const round = state.league.schedule[state.league.round];
  if (!round) return null;
  const f = round.find((x) => x.home === state.player.teamId || x.away === state.player.teamId)!;
  const home = f.home === state.player.teamId;
  return { opponentId: home ? f.away : f.home, home };
}

/** 피로: 그 주 회복 후 경기 출전만큼 쌓인다 (7.1) */
function updateFatigueForMatch(p: PlayerState, minutes: number): void {
  const F = BALANCE.fatigue;
  p.fatigue = Math.min(F.max, p.fatigue + (F.perMatch90 * minutes) / 90);
}

function weeklyRecovery(p: PlayerState, hadMatch: boolean): void {
  const F = BALANCE.fatigue;
  p.fatigue = Math.max(0, p.fatigue - (hadMatch ? F.weeklyRecovery : F.noMatchWeekRecovery));
}

export interface PlayOptions {
  /**
   * 내 경기 계산 방식. 'agent' = 에이전트 경기 엔진 (기본, 부록 E), 'quick' = 통계 방식 빠른 경기 (B.4).
   * 밸런스 커리어 시뮬(`npm run balance`)은 수십만 경기를 돌리므로 'quick' 을 쓴다 (부록 C.11)
   */
  engine?: 'agent' | 'quick';
  /** 내 경기의 재생 데이터를 받는다 (E5-lite 경기 화면). 세이브에는 담지 않는다 */
  onReplay?: (replay: Replay) => void;
  /** 내 선수 결정 순간 (E.11): 직접/자동과 정책. 없으면 자동 */
  control?: MomentControl;
  /** 화면에서 결정 순간을 직접 진행한 내 경기 결과 (roundMatch 로 만든 같은 입력, E4). 있으면 다시 계산하지 않는다 */
  engineOut?: MyMatchOutput;
}

/** 이번 라운드 내 경기의 엔진 입력 (상태를 바꾸지 않는다). 결장(부상·정지·벤치)이어도 입력은 만든다 */
export interface RoundMatch {
  input: EngineMatchInput;
  plan: MyMatchPlan;
  preInjury: Injury | null;
  /** 재생 화면 팀 이름 [홈, 원정] */
  teams: [string, string];
}

export function roundMatch(state: GameState): RoundMatch {
  const { league, player } = state;
  const roundIdx = league.round;
  const seed = state.worldSeed;
  const injured = player.injury !== null;
  const suspended = !injured && player.suspended > 0;
  // 주간 회복 후 피로 (playRound 의 weeklyRecovery 와 같은 값)
  const F = BALANCE.fatigue;
  const fatigue = Math.max(0, player.fatigue - (!injured ? F.weeklyRecovery : F.noMatchWeekRecovery));
  const p = { ...player, fatigue };
  const fx = nextFixture(state)!;
  const myTeam = teamById(league, player.teamId);
  const opp = teamById(league, fx.opponentId);
  const pos = myMatchPosition(state);
  const ovr = proficientOvr(p, pos);
  const form = formBonus(player.recentRatings);
  const remaining = league.schedule.length - roundIdx - 1;
  const at = { season: league.season, round: roundIdx + 1 };
  // 선발/교체 판정은 기존 방식 (E.10), 부상은 경기 전 판정 후 그 분에 교체 아웃 (E.16)
  const rng = rngFor(seed, 'match', league.season, roundIdx);
  const M = BALANCE.match;
  const available = !injured && !suspended;
  const started = available && rng() < startProbability(ovr, myTeam.rating, fatigue);
  const minutes = started ? 90 : available && rng() < M.subChance ? randInt(rng, M.subMinutes.min, M.subMinutes.max) : 0;
  const plan: MyMatchPlan = { started, minutes: minutes > 0 ? { start: started ? 0 : 90 - minutes, end: 90 } : null };
  let preInjury: Injury | null = null;
  if (plan.minutes) {
    preInjury = rollInjury(p, minutes, state.difficulty, remaining, at, rngFor(seed, 'injury', league.season, roundIdx));
    if (preInjury) {
      const k = rngFor(seed, 'injury-minute', league.season, roundIdx)();
      plan.minutes.end = Math.min(89, Math.max(plan.minutes.start + 1, Math.round(plan.minutes.start + k * minutes)));
    }
  }
  const input: EngineMatchInput = {
    myRoster: state.rosters[player.teamId]!, oppRoster: state.rosters[opp.id]!,
    myRating: myTeam.rating, oppRating: opp.rating, home: fx.home,
    me: { position: pos, attributes: player.attributes, fatigue, form, proficiency: proficiencyOf(player, pos) },
    plan, difficulty: state.difficulty, seed: hashSeed(`${seed}:engine:${league.season}:${roundIdx}`), worldSeed: seed,
    leagueAvg: league.teams.reduce((t, x) => t + x.rating, 0) / league.teams.length, myTactics: state.tactics,
  };
  return { input, plan, preInjury, teams: fx.home ? [myTeam.nameKo, opp.nameKo] : [opp.nameKo, myTeam.nameKo] };
}

/** 한 라운드(한 주) 진행. 마지막 라운드면 시즌 종료 처리까지 한다 */
export function playRound(state: GameState, opts: PlayOptions = {}): MatchReport {
  if (state.phase !== 'season') throw new Error('시즌 중이 아님');
  const { league, player } = state;
  const roundIdx = league.round;
  const fixtures = league.schedule[roundIdx]!;
  const seed = state.worldSeed;
  const useEngine = (opts.engine ?? 'agent') === 'agent';

  const injured = player.injury !== null;
  const suspended = !injured && player.suspended > 0;
  // 내 경기 입력은 주간 회복 전 상태에서 만든다 (roundMatch 가 회복 후 피로를 직접 계산한다)
  const rm = useEngine ? roundMatch(state) : null;
  weeklyRecovery(player, !injured);

  // 내 경기
  const fx = nextFixture(state)!;
  const myTeam = teamById(league, player.teamId);
  const opp = teamById(league, fx.opponentId);
  // 내 슬롯 포지션의 OVR 로 선발 판정 (E.19 ②: 주 포지션 밖이면 그만큼 손해). 빠른 경기는 주 포지션 그대로
  const pos = useEngine ? myMatchPosition(state) : player.position;
  const ovr = proficientOvr(player, pos);
  const form = formBonus(player.recentRatings);
  const remaining = league.schedule.length - roundIdx - 1;
  const at = { season: league.season, round: roundIdx + 1 };

  let result: MatchResult;
  let preInjury: Injury | null = null;
  let engineOut: MyMatchOutput | null = null;
  if (rm) {
    preInjury = rm.preInjury;
    engineOut = opts.engineOut ?? playMyMatch({ ...rm.input, ...(opts.control ? { control: opts.control } : {}) }, opts.onReplay ? { teams: rm.teams } : undefined);
    if (opts.onReplay && engineOut.replay) {
      for (const p of engineOut.replay.players) if (p.isMe) p.name = player.name;
      opts.onReplay(engineOut.replay);
    }
    result = engineOut.result;
    if (injured || suspended) {
      const weekXp = injured ? BALANCE.injury.rehabXp : BALANCE.matchXp.bench;
      result.xp = Math.round(weekXp * BALANCE.difficulty[state.difficulty].xp);
    }
  } else {
    result = simulateMatch(
      {
        ovr, position: player.position, fatigue: player.fatigue,
        teamRating: myTeam.rating, oppRating: opp.rating, home: fx.home, difficulty: state.difficulty,
        formBonus: form, injured: injured || suspended,
      },
      rngFor(seed, 'match', league.season, roundIdx),
    );
    if (suspended && result.minutes === 0) result.xp = Math.round(BALANCE.matchXp.bench * BALANCE.difficulty[state.difficulty].xp);
  }

  // 다른 경기
  const otherRng = rngFor(seed, 'round', league.season, roundIdx);
  for (const f of fixtures) {
    if (f.home === player.teamId) recordResult(league, f, result.goalsFor, result.goalsAgainst);
    else if (f.away === player.teamId) recordResult(league, f, result.goalsAgainst, result.goalsFor);
    else {
      const [hg, ag] = simulateScore(otherRng, teamById(league, f.home).rating, teamById(league, f.away).rating);
      recordResult(league, f, hg, ag);
    }
  }

  // 기록, XP, 피로
  const s = player.season;
  let slump: SlumpReport | null = null;
  if (result.minutes > 0) {
    s.apps++;
    if (result.started) s.starts++;
    s.minutes += result.minutes;
    s.goals += result.goals;
    s.assists += result.assists;
    s.ratingSum += result.rating ?? 0;
    if (result.mom) s.moms++;
    player.recentRatings = pushRating(player.recentRatings, result.rating ?? 0);
    slump = applySlump(player, result.rating ?? 0);
  }
  // 카드와 출장 정지 (E.10): 퇴장 1경기, 시즌 옐로 누적 yellowBanEvery 장마다 1경기
  let cards: { yellows: number; red: boolean } | undefined;
  if (suspended) player.suspended--;
  const my = engineOut?.my;
  if (my && result.minutes > 0 && (my.yellows > 0 || my.red)) {
    const before = Math.floor(s.yellows / BALANCE.discipline.yellowBanEvery);
    const yellows = my.red && my.yellows >= 2 ? 0 : my.yellows;
    s.yellows += yellows;
    if (my.red) s.reds++;
    const banned = my.red || Math.floor(s.yellows / BALANCE.discipline.yellowBanEvery) > before;
    if (banned) player.suspended += BALANCE.discipline.banMatches;
    cards = { yellows: my.yellows, red: my.red };
  }
  // 부상: 결장 주는 회복을 한 주 진행하고, 출전했으면 판정 (피로는 경기 시작 때 값)
  let injury: Injury | undefined;
  let recovered = false;
  if (injured) {
    s.injuredWeeks++;
    recovered = healWeek(player);
  } else if (result.minutes > 0) {
    const rolled = useEngine
      ? preInjury
      : rollInjury(player, result.minutes, state.difficulty, remaining, at, rngFor(seed, 'injury', league.season, roundIdx));
    if (rolled) {
      s.injuries++;
      player.injury = rolled;
      injury = { ...rolled, permanent: { ...rolled.permanent } };
    }
  }
  // 경기 기록 (부록 C.30): 엔진 경기에 출전했으면 기록을 남기고 시즌 합계에 더한다. 빠른 경기는 기록 없음
  const rec = my && result.minutes > 0 ? recordFromStats(my) : undefined;
  if (rec) {
    s.rec = addRecord(s.rec ?? emptyRecord(), rec);
    s.recApps = (s.recApps ?? 0) + 1;
  }
  state.matchLog.push({
    round: roundIdx + 1, opponentId: opp.id, home: fx.home, goalsFor: result.goalsFor, goalsAgainst: result.goalsAgainst,
    minutes: result.minutes, started: result.started, goals: result.goals, assists: result.assists, rating: result.rating, mom: result.mom,
    ...(result.minutes > 0 ? {} : { absent: injured ? 'injured' : suspended ? 'suspended' : 'bench' }),
    position: pos, rec: rec ?? null,
  });
  if (result.minutes > 0) gainProficiency(player, result.minutes, pos);
  if (result.minutes > 0) {
    if (my) player.fatigue = Math.min(BALANCE.fatigue.max, player.fatigue + fatigueFromDistance(my.distance));
    else updateFatigueForMatch(player, result.minutes);
  }
  // 결장한 주도 훈련 XP 를 받는다. 33세부터 고령 감쇠 (6.1)
  result.xp = Math.round(result.xp * veteranXpMultiplier(player.age));
  s.matchXp += result.xp;
  const levelsGained = addXp(player, result.xp);

  league.round++;
  const report: MatchReport = {
    season: league.season, round: roundIdx + 1, opponentId: opp.id, home: fx.home, result, levelsGained, ovr,
    formBonus: form,
    ...(injury ? { injury } : {}),
    ...(injured ? { injured, recovered } : {}),
    ...(suspended ? { suspended } : {}),
    ...(cards ? { cards } : {}),
    ...(engineOut ? { engine: matchSummary(engineOut) } : {}),
    ...(rec ? { rec } : {}),
    ...(engineOut?.engine.decisions.length ? { decisions: engineOut.engine.decisions } : {}),
    ...(slump ? { slump } : {}),
  };
  state.lastMatch = report;

  if (league.round >= league.schedule.length) endSeason(state);
  refreshUnlocks(state);
  return report;
}

/** 경기 후 화면용 요약 (엔진 경기만) */
function matchSummary(o: MyMatchOutput): EngineSummary {
  const [own, opp] = o.side === 0 ? o.engine.teamStats : [o.engine.teamStats[1], o.engine.teamStats[0]];
  const poss = own.possessionTicks / Math.max(1, own.possessionTicks + opp.possessionTicks);
  const my = o.my;
  return {
    possession: Math.round(poss * 100),
    shots: [own.shots, opp.shots],
    shotsOnTarget: [own.shotsOnTarget, opp.shotsOnTarget],
    ...(my ? {
      my: {
        passes: my.passes, passesCompleted: my.passesCompleted, shots: my.shots, tackles: my.tacklesWon,
        interceptions: my.interceptions, dribbles: my.dribblesWon, distance: Math.round(my.distance / 100) / 10,
      },
    } : {}),
  };
}

export function averageRating(s: SeasonStats): number | null {
  return s.apps > 0 ? s.ratingSum / s.apps : null;
}

/** 시즌 전 팀 레이팅 순위 (1 = 최강). 레이팅은 시즌 중에 바뀌지 않는다 */
export function ratingRank(league: LeagueState, teamId: string): number {
  const own = teamById(league, teamId).rating;
  return 1 + league.teams.filter((t) => t.rating > own).length;
}

/** 시즌 업적 (5.3): 리그 순위, 평균 평점, 팀 내 활약 */
export function seasonAchievements(player: PlayerState, league: LeagueState): { label: string; xp: number }[] {
  const A = BALANCE.achievements;
  const s = player.season;
  const out: { label: string; xp: number }[] = [];
  const pos = leaguePosition(league, player.teamId);
  const posAch = A.leaguePosition.find(([maxPos]) => pos <= maxPos);
  if (posAch) out.push({ label: `리그 ${pos}위`, xp: posAch[1] });
  const avg = averageRating(s);
  if (avg !== null && avg >= A.highAvgRating.minAvg && s.apps >= A.highAvgRating.minApps) {
    out.push({ label: `시즌 평균 평점 ${A.highAvgRating.minAvg} 이상`, xp: A.highAvgRating.xp });
  } else if (avg !== null && avg >= A.steadyRating.minAvg && s.apps >= A.steadyRating.minApps) {
    out.push({ label: `안정적인 활약 (평균 평점 ${A.steadyRating.minAvg} 이상)`, xp: A.steadyRating.xp });
  }
  const teamGoals = league.table.find((r) => r.teamId === player.teamId)?.gf ?? 0;
  if (s.apps >= A.teamAttack.minApps && teamGoals > 0 && (s.goals + s.assists) / teamGoals >= A.teamAttack.share) {
    out.push({ label: `팀 공격 기여 (팀 득점 ${teamGoals} 중 ${s.goals + s.assists} 관여)`, xp: A.teamAttack.xp });
  }
  const expected = ratingRank(league, player.teamId);
  if (expected - pos >= A.underdog.minPlacesAbove) {
    out.push({ label: `언더독 돌풍 (예상 ${expected}위 → ${pos}위)`, xp: A.underdog.xp });
  }
  return out;
}

/** 부진 기준 평점 (부록 C.25): 가장 최근 minApps 경기 이상 뛴 시즌의 내 평균 − belowAvg. 그런 시즌이 없으면 fallbackAvg 기준 */
export function slumpThreshold(player: PlayerState): number {
  const S = BALANCE.reputation.slump;
  const last = [...player.history].reverse().find((h) => h.apps >= S.minApps);
  return (last ? last.ratingSum / last.apps : S.fallbackAvg) - S.belowAvg;
}

/** 부진 연속 streak 번째 경기의 위상 감점. fromStreak 번째부터 위상 × perStep × (연속 − 1), 최대 위상 × maxShare */
export function slumpPenalty(reputation: number, streak: number): number {
  const S = BALANCE.reputation.slump;
  if (streak < S.fromStreak) return 0;
  return Math.round(reputation * Math.min(S.maxShare, S.perStep * (streak - 1)));
}

/** 위상에서 points 를 뺀다. 지금 티어의 컷 밑으로는 내려가지 않고, 막힌 만큼은 사라진다 (티어 하한, 부록 C.27) */
export function deductReputation(player: PlayerState, points: number): RepDeduction {
  const applied = Math.max(0, Math.min(points, player.reputation - reputationFloor(player.reputation)));
  player.reputation -= applied;
  return { points: applied, blocked: Math.max(0, points - applied) };
}

/** 출전 경기 평점으로 부진 연속을 갱신하고 감점한다. 감점(또는 바닥에 막힌 감점)이 있으면 그 값과 연속 수 */
function applySlump(player: PlayerState, rating: number): SlumpReport | null {
  const threshold = slumpThreshold(player);
  if (rating >= threshold) {
    player.slumpStreak = 0;
    return null;
  }
  player.slumpStreak++;
  const want = Math.min(player.reputation, slumpPenalty(player.reputation, player.slumpStreak));
  if (want <= 0) return null;
  const { points, blocked } = deductReputation(player, want);
  player.season.slumpPenalty = (player.season.slumpPenalty ?? 0) + points;
  if (blocked > 0) player.season.slumpBlocked = (player.season.slumpBlocked ?? 0) + blocked;
  return { points, streak: player.slumpStreak, threshold, ...(blocked > 0 ? { blocked } : {}) };
}

/** 순위 감점 (부록 C.25): 시즌 전 예상 순위보다 낮게 마친 계단마다 위상 × perPlace, 최대 위상 × maxShare */
export function rankPenalty(reputation: number, pos: number, expected: number): number {
  const R = BALANCE.reputation.rankDrop;
  const below = pos - expected;
  if (below <= 0) return 0;
  return Math.min(reputation, Math.round(reputation * Math.min(R.maxShare, R.perPlace * below)));
}

/** 레드카드 감점 (부록 C.27): 퇴장 1회당 위상 × perRed, 최대 위상 × maxShare */
export function redCardPenalty(reputation: number, reds: number): number {
  const R = BALANCE.reputation.redCard;
  if (reds <= 0) return 0;
  return Math.round(reputation * Math.min(R.maxShare, R.perRed * reds));
}

/** 출전 시간 부족 감점 (부록 C.27): 출전 비율이 minShare 미만이면 모자란 step 마다(올림) 위상 × perStep, 최대 위상 × maxShare */
export function minutesShortPenalty(reputation: number, share: number): number {
  const M = BALANCE.reputation.minutesShort;
  if (share >= M.minShare) return 0;
  const steps = Math.ceil((M.minShare - share) / M.step - 1e-9);
  return Math.round(reputation * Math.min(M.maxShare, M.perStep * steps));
}

/** 시즌 출전 시간 비율: 출전 분 / 리그 전체 시간 (라운드 수 × 90분). 부상 결장도 그대로 센다 (부록 C.27) */
export function minutesShare(s: SeasonStats, league: LeagueState): number {
  return s.minutes / Math.max(1, league.schedule.length * 90);
}

/** 이 나이 시즌의 위상 증가 상한 (부록 C.25: 31세부터 낮아진다) */
export function seasonGainCap(age: number): number {
  const R = BALANCE.reputation;
  return age >= R.lateSeasonGainMax.fromAge ? R.lateSeasonGainMax.max : R.seasonGainMax;
}

/** 개인 기록 위상 가산 (8.1): MOM, 골+어시. 시즌 상한 있음 */
export function personalReputation(s: SeasonStats): number {
  const P = BALANCE.reputation.personal;
  const gi = Math.floor((s.goals + s.assists) / P.goalInvolvements.per) * P.goalInvolvements.points;
  return Math.min(P.max, s.moms * P.perMom + gi);
}

/** 시즌 종료 (B.5): 업적 XP → 위상 → 자동 성장 → 노련함 → 노화 → 나이 +1 → 기록 저장 */
export function endSeason(state: GameState): SeasonSummary {
  const { player, league } = state;
  const R = BALANCE.reputation;
  const season = league.season;
  const age = player.age;
  const ovrBefore = playerOvr(player);
  const rng = rngFor(state.worldSeed, 'season-end', season);

  // 1. 업적 XP
  const pos = leaguePosition(league, player.teamId);
  const achievements = seasonAchievements(player, league);
  const baseXp = achievements.reduce((t, a) => t + a.xp, 0);
  const achievementXp = Math.round(baseXp * BALANCE.difficulty[state.difficulty].xp);
  const levelsGained = addXp(player, achievementXp);

  // 2. 위상: 시즌 시작 값(시즌 중 부진 감점 전) → 감소 + 증가(나이별 상한) → 순위·레드카드·출전 시간 부족 감점 (부록 C.25, C.27).
  // 모든 감점은 티어 하한을 따른다: 감소는 감소 전 티어의 컷, 시즌 끝 감점은 증가 뒤 티어의 컷 밑으로 내려가지 않는다
  const slumpTotal = player.season.slumpPenalty ?? 0;
  const reputationBefore = player.reputation + slumpTotal;
  const startFloorTier = reputationFloorTier(reputationBefore);
  const repGain = Math.min(seasonGainCap(age), baseXp * R.fromAchievementXp + personalReputation(player.season));
  const decayFloor = reputationFloor(player.reputation);
  const afterGain = Math.min(R.max, Math.round(player.reputation * (1 - R.seasonDecay) + repGain));
  const decayBlocked = Math.max(0, decayFloor - afterGain);
  player.reputation = Math.max(decayFloor, afterGain);
  const expected = ratingRank(league, player.teamId);
  const repBase = player.reputation;
  const rank = deductReputation(player, rankPenalty(repBase, pos, expected));
  const reds = player.season.reds;
  const red = deductReputation(player, redCardPenalty(repBase, reds));
  const share = minutesShare(player.season, league);
  const short = deductReputation(player, minutesShortPenalty(repBase, share));

  // 3~4. 자동 성장, 노련함, 노화
  // 실제 선수는 정점 목표 근처에 오면 자동 성장을 멈춘다 (부록 D.7 #1)
  const nearPeak = player.peakTarget !== undefined && ovrBefore >= player.peakTarget - BALANCE.growth.realPeak.autoGrowthStopBelow;
  const autoGrowth = nearPeak ? {} : applyAutoGrowth(player.attributes, age, player.potentialTier, rng);
  const veteranGrowth = applyVeteranGrowth(player.attributes, age, rng);
  const aging = applyAging(player.attributes, age, rng, player.position);

  // 5. 나이
  player.age = age + 1;

  // 6. 기록
  const record: SeasonRecord = {
    ...player.season, season, age, teamId: player.teamId, leaguePosition: pos,
    achievementXp, ovr: ovrBefore, reputation: player.reputation,
  };
  player.history.push(record);

  // 7. 이전 주 포지션 숙련도 감소 (D.3), 레전드 배지 (D.4: 부여 시 위상 +BALANCE.badges.reputation)
  decayFormerPosition(player);
  const badges = awardBadges(player, season);
  record.reputation = player.reputation;
  const endFloorTier = reputationFloorTier(player.reputation);
  const tierReached = endFloorTier && endFloorTier !== startFloorTier ? endFloorTier : undefined;

  // NPC
  state.npcs = state.npcs.map((n) => growNpc(n, state.worldSeed, season));
  const base = Object.fromEntries(league.teams.map((t) => [t.id, t.baseRating]));
  state.rosters = updateRostersForSeason(state.rosters, state.worldSeed, season, base, state.npcs);
  state.roster.updates++;

  const summary: SeasonSummary = {
    season, age, leaguePosition: pos, achievements, achievementXp, levelsGained,
    reputationBefore, reputationAfter: player.reputation, slumpPenalty: slumpTotal,
    rankPenalty: { expected, pos, points: rank.points, blocked: rank.blocked },
    slumpBlocked: player.history.at(-1)!.slumpBlocked ?? 0, decayBlocked,
    redPenalty: { reds, ...red }, minutesPenalty: { share, ...short },
    ...(tierReached ? { tierReached } : {}), badges, autoGrowth, veteranGrowth, aging,
    ovrBefore, ovrAfter: playerOvr(player),
    canRetire: age >= BALANCE.retirement.optionalAge,
    forcedRetire: player.age >= BALANCE.retirement.forcedAge,
  };
  state.lastSeasonSummary = summary;
  state.phase = summary.forcedRetire ? 'retired' : 'offseason';
  return summary;
}

/** 다음 시즌 리그 팀 레이팅 = 로스터 레이팅 + 시즌 팀 컨디션 (23번, 부록 C.8) */
export function seasonTeamRatings(state: GameState): Record<string, number> {
  const season = state.league.season + 1;
  const out = teamRatings(state.rosters);
  for (const id of Object.keys(out)) {
    out[id] = out[id]! + gaussian(rngFor(state.worldSeed, 'team-form', season, id)) * BALANCE.roster.seasonFormSd;
  }
  return out;
}

/** 비시즌 → 다음 시즌 */
export function startNextSeason(state: GameState): void {
  if (state.phase !== 'offseason') throw new Error('비시즌이 아님');
  state.league = nextSeasonLeague(state.league, state.worldSeed, seasonTeamRatings(state));
  state.player.season = emptySeasonStats();
  state.matchLog = [];
  state.player.fatigue = 0;
  healWeek(state.player, BALANCE.injury.offseasonWeeks);
  state.lastMatch = undefined;
  state.phase = 'season';
}

export function retire(state: GameState): void {
  if (state.phase !== 'offseason' || !state.lastSeasonSummary?.canRetire) throw new Error('은퇴할 수 없음');
  state.phase = 'retired';
}

export interface CareerTotals {
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  avgRating: number | null;
  peakOvr: number;
  bestFinish: number | null;
}

export function careerTotals(p: PlayerState): CareerTotals {
  const h = p.history;
  const apps = h.reduce((t, r) => t + r.apps, 0);
  const ratingSum = h.reduce((t, r) => t + r.ratingSum, 0);
  return {
    seasons: h.length,
    apps,
    goals: h.reduce((t, r) => t + r.goals, 0),
    assists: h.reduce((t, r) => t + r.assists, 0),
    avgRating: apps > 0 ? ratingSum / apps : null,
    peakOvr: Math.max(playerOvr(p), ...h.map((r) => r.ovr)),
    bestFinish: h.length ? Math.min(...h.map((r) => r.leaguePosition)) : null,
  };
}
