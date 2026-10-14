// 게임 진행: 새 게임, 라운드 진행, 시즌 종료, 다음 시즌, 은퇴 (B.2~B.6)

import { A_GRADE_PLAYERS } from '../data/players';
import { BALANCE, BALANCE_VERSION, type Difficulty } from './config/balance';
import { generatePlayer } from './generate';
import {
  addXp, applyAging, applyAutoGrowth, applyVeteranGrowth, playerOvr, randInt, veteranXpMultiplier,
  type AttributeDelta,
} from './growth';
import {
  CLUB_TO_TEAM, createLeague, leaguePosition, nextSeasonLeague, recordResult, simulateScore, teamById,
  type LeagueState,
} from './league';
import { simulateMatch, type MatchResult } from './match';
import { createNpc, growNpc, type NpcState } from './npc';
import type { PlayablePosition } from './positions';
import { generateProspectAttributes, randomName, rollPotentialTier, rollStartOvr } from './prospect';
import { createRng, hashSeed, type Rng } from './rng';
import type { FieldPlayerData, PlayerState, SeasonRecord, SeasonStats } from './types';

/** 세이브 필드 구조가 바뀌면 올린다 (밸런스 수치 변경과 구분) */
export const SAVE_FORMAT_VERSION = 1;

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
  worldSeed: string;
  difficulty: Difficulty;
  phase: Phase;
  player: PlayerState;
  league: LeagueState;
  npcs: NpcState[];
  lastMatch?: MatchReport;
  lastSeasonSummary?: SeasonSummary;
}

export type NewGameOptions =
  | { mode: 'prospect'; name?: string; position: PlayablePosition; seed?: string; difficulty: Difficulty }
  | { mode: 'real'; playerId: string; seed?: string; difficulty: Difficulty };

const rngFor = (seed: string, ...parts: (string | number)[]): Rng => createRng(hashSeed([seed, ...parts].join(':')));

export function emptySeasonStats(): SeasonStats {
  return { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, matchXp: 0, moms: 0 };
}

/** 실제 선수로 시작 가능한 선수: 데이터가 있고 소속팀이 리그에 있는 선수 */
export function selectableRealPlayers(): FieldPlayerData[] {
  return A_GRADE_PLAYERS.filter((p) => CLUB_TO_TEAM[p.club] !== undefined);
}

export function randomSeed(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36);
}

export function newGame(opts: NewGameOptions): GameState {
  const worldSeed = opts.seed?.trim() || randomSeed();
  const season = BALANCE.newGame.startYear;
  const league = createLeague(worldSeed, season);
  const rng = rngFor(worldSeed, 'new-player');

  let player: PlayerState;
  const base = {
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, coachWarned: false, season: emptySeasonStats(), history: [],
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
    };
  } else {
    const data = selectableRealPlayers().find((p) => p.id === opts.playerId);
    if (!data) throw new Error(`선택할 수 없는 선수: ${opts.playerId}`);
    const gen = generatePlayer(data, worldSeed);
    player = {
      ...base,
      name: data.nameKo,
      realPlayerId: data.id,
      position: data.position,
      age: season - data.birthYear,
      teamId: CLUB_TO_TEAM[data.club]!,
      attributes: gen.attributes,
      potentialTier: data.potentialTier,
      reputation: data.reputation,
    };
  }

  const npcs = A_GRADE_PLAYERS.filter((p) => p.id !== player.realPlayerId).map((p) => createNpc(p, worldSeed, season));

  return {
    saveFormat: SAVE_FORMAT_VERSION,
    balanceVersion: BALANCE_VERSION,
    worldSeed,
    difficulty: opts.difficulty,
    phase: 'season',
    player,
    league,
    npcs,
  };
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

/** 한 라운드(한 주) 진행. 마지막 라운드면 시즌 종료 처리까지 한다 */
export function playRound(state: GameState): MatchReport {
  if (state.phase !== 'season') throw new Error('시즌 중이 아님');
  const { league, player } = state;
  const roundIdx = league.round;
  const fixtures = league.schedule[roundIdx]!;
  const seed = state.worldSeed;

  weeklyRecovery(player, true);

  // 내 경기
  const fx = nextFixture(state)!;
  const myTeam = teamById(league, player.teamId);
  const opp = teamById(league, fx.opponentId);
  const ovr = playerOvr(player);
  const result = simulateMatch(
    {
      ovr, position: player.position, fatigue: player.fatigue,
      teamRating: myTeam.rating, oppRating: opp.rating, home: fx.home, difficulty: state.difficulty,
    },
    rngFor(seed, 'match', league.season, roundIdx),
  );

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
  if (result.minutes > 0) {
    s.apps++;
    if (result.started) s.starts++;
    s.minutes += result.minutes;
    s.goals += result.goals;
    s.assists += result.assists;
    s.ratingSum += result.rating ?? 0;
    if (result.mom) s.moms++;
    updateFatigueForMatch(player, result.minutes);
  }
  // 결장한 주도 훈련 XP 를 받는다. 33세부터 고령 감쇠 (6.1)
  result.xp = Math.round(result.xp * veteranXpMultiplier(player.age));
  s.matchXp += result.xp;
  const levelsGained = addXp(player, result.xp);

  league.round++;
  const report: MatchReport = {
    season: league.season, round: roundIdx + 1, opponentId: opp.id, home: fx.home, result, levelsGained, ovr,
  };
  state.lastMatch = report;

  if (league.round >= league.schedule.length) endSeason(state);
  return report;
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

  // 2. 위상
  const reputationBefore = player.reputation;
  player.reputation = Math.min(R.max, Math.round(player.reputation * (1 - R.seasonDecay) + baseXp * R.fromAchievementXp));

  // 3~4. 자동 성장, 노련함, 노화
  const autoGrowth = applyAutoGrowth(player.attributes, age, player.potentialTier, rng);
  const veteranGrowth = applyVeteranGrowth(player.attributes, age, rng);
  const aging = applyAging(player.attributes, age, rng);

  // 5. 나이
  player.age = age + 1;

  // 6. 기록
  const record: SeasonRecord = {
    ...player.season, season, age, teamId: player.teamId, leaguePosition: pos,
    achievementXp, ovr: ovrBefore, reputation: player.reputation,
  };
  player.history.push(record);

  // NPC
  state.npcs = state.npcs.map((n) => growNpc(n, state.worldSeed, season));

  const summary: SeasonSummary = {
    season, age, leaguePosition: pos, achievements, achievementXp, levelsGained,
    reputationBefore, reputationAfter: player.reputation, autoGrowth, veteranGrowth, aging,
    ovrBefore, ovrAfter: playerOvr(player),
    canRetire: age >= BALANCE.retirement.optionalAge,
    forcedRetire: player.age >= BALANCE.retirement.forcedAge,
  };
  state.lastSeasonSummary = summary;
  state.phase = summary.forcedRetire ? 'retired' : 'offseason';
  return summary;
}

/** 비시즌 → 다음 시즌 */
export function startNextSeason(state: GameState): void {
  if (state.phase !== 'offseason') throw new Error('비시즌이 아님');
  state.league = nextSeasonLeague(state.league, state.worldSeed);
  state.player.season = emptySeasonStats();
  state.player.fatigue = 0;
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
