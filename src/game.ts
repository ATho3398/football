// 게임 진행: 새 게임, 라운드 진행, 시즌 종료, 다음 시즌, 은퇴 (B.2~B.6)

import { A_GRADE_PLAYERS } from '../data/players';
import { ATTRIBUTE_NAMES_KO } from './attributes';
import { BALANCE, BALANCE_VERSION, type Difficulty } from './config/balance';
import type { Replay } from './replay';
import { generatePlayer } from './generate';
import {
  addXp, applyAging, applyAutoGrowth, applyVeteranGrowth, NO_HONORS, playerOvr, randInt, realPeakTarget, reputationFloor,
  reputationFloorTier, veteranXpMultiplier, type AttributeDelta,
} from './growth';
import {
  CLUB_TO_TEAM, createLeague, initialTeams, leaguePosition, nextSeasonLeague, recordResult, simulateScore, sortedTable, teamById,
  type Fixture, type LeagueState,
} from './league';
import { simulateMatch, startProbability, type MatchResult } from './match';
import { fatigueFromDistance, MY_ID, playMyMatch, type EngineMatchInput, type MyMatchOutput, type MyMatchPlan } from './engine/adapter';
import { SCENE_LABEL, type ControlMode, type DecisionRecord, type MomentControl, type StopLevel } from './engine/moments';
import { formBonus, pushRating } from './form';
import { addRecord, emptyRecord, recordFromStats, type MatchLogEntry, type MatchRecord } from './matchRecord';
import { healDays, rollInjury } from './injury';
import { addDays, daysBetween, seasonCalendar, type IsoDate, type SeasonCalendar } from './calendar';
import { playNpcMatch, summarize, type GoalRec, type NpcMatchInput, type NpcMatchResult } from './engine/npcMatch';
import { createNpc, growNpc, type NpcState } from './npc';
import {
  assignShirts, createRosters, freeShirt, setNamePoolVersion, syncRealPlayers, teamRatings, updateRostersForSeason, type Rosters,
} from './roster';
import { positionOvr, type PlayablePosition } from './positions';
import { afterTeamMatch, engineProficiency, initialProficiency, initialProfLog, proficientOvr } from './proficiency';
import { awardBadges } from './badges';
import { randomName } from './prospect';
import { clampWeakFoot, realBody, rollBody, type Body, type WeakFoot } from './body';
import { agingMul, bigGameForm, cardMul, formMul, picksToTags, recoveryMul, rollTags, seasonRemovals, xpMul, type PlayerTag, type TagPick, type Tagged } from './tags';
import { derbyOf } from './derby';
import { CUSTOM_HIDDEN_TAGS, customBudget, validCustom } from './custom';
import { TAGS } from './tags';
import { REAL_CAREER } from '../data/players/careers';
import { npcTagMap, recordTagNews, type TagNews } from './npcTags';
import { ensureFinance, type FinanceState } from './finance';
import { afterAccept, afterTrialMatch, applyStart, checkOneClub, release, renewalFails, seasonEndTags, type StartChoice, type TrialState } from './startClub';
import type { Appearance } from './appearance';
import type { FieldAttributes } from './attributes';
import { adviceOpen, aptitudeSeed, checkAdviceTaken, evaluateAdvice, mainPositionAptitude, rollProspect } from './aptitude';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { Badge, FieldPlayerData, Injury, PlayerState, SeasonRecord, SeasonStats, Tier } from './types';
import { PATCH_LABEL } from './version';
import { afterMatch, cardInput, grantLevelPicks, grantSeasonPick, initCollection, type CardCollection } from './cardCollection';
import { cardById } from './config/cards';
import { initialGuide, refreshUnlocks, type GuideState } from './unlocks';
import { previewLineup, slotPos, teamDefaultTactics, type MyTactics } from './myTactics';
import {
  defaultPlan, isFixedRest, initTraining, newTrainingSeason, planFatigue, planXp, takeXp, techBundle, techDay, BUNDLE_NAMES_KO, TRAINING_NAMES_KO,
  type DayPlan, type TrainingDayResult, type TrainingKind, type TrainingState,
} from './training';
import { trainProficiency } from './proficiency';
import type { NameOverrides } from './names';
import type { PixelOverrides } from './pixel';
import type { FieldPosition } from './positions';
import {
  acceptOffer, autoResolveMarket, initialContract, initialMarket, marketPending, onDayEnd, openOffseasonMarket, replayTransfers, runNpcWindow,
  type MarketState, type TransferRec,
} from './transfer';

/** 세이브 필드 구조가 바뀌면 올린다 (밸런스 수치 변경과 구분) */
export const SAVE_FORMAT_VERSION = 26;

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
  /** 이 경기에 쓴 카드 (C.36): 이름, 분, 결과, 자동 규칙으로 썼는지 */
  cardUses?: { name: string; minute: number; result: 'success' | 'fail' | 'neutral'; auto: boolean }[];
  /** 이 경기로 해금된 역할 시그니처 카드 이름 */
  cardUnlock?: string;
  /**
   * 부진 연속 감점 (부록 C.25): 이 경기로 잃은 위상과 연속 경기 수, 기준 평점.
   * blocked 는 티어 하한에 막혀 사라진 감점 (부록 C.27). threshold 는 C.27 이전 세이브에는 없다
   */
  slump?: SlumpReport;
  /** 이 경기 전에 포변 조언대로 바꿔 보너스가 걸렸다 (부록 C.37) */
  adviceTaken?: boolean;
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
  /** 벤치 장기화 감점 (D.19, C.42) */
  benchPenalty?: RepDeduction;
  /** 이번 여름 NPC 이적 수 (C.42) */
  transfers?: number;
  tierReached?: Tier;
  /** 노련함 능력치 성장 (6.1.1). 이전 버전 세이브에는 없다 */
  veteranGrowth?: AttributeDelta;
  /** 이번 시즌 끝에 나온 포변 조언 종류 (부록 C.37) */
  advice?: 'coach' | 'news';
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
  /** 가상 선수 이름 풀 판 (부록 C.45 8번). 없으면 1 = 옛 풀(옛 세이브), 새 게임은 2. 로스터를 다시 만들 때 setNamePoolVersion 으로 맞춘다 */
  namePool?: number;
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
  /** 카드 모음과 덱 세트 (부록 F, C.36) */
  cards: CardCollection;
  /** 캘린더 (25.1~25.2, 부록 C.38): 오늘 날짜. 일정 날짜는 시드로 다시 만든다 (calendarOf) */
  calendar: { date: IsoDate };
  /** 이번 시즌 모든 선수의 리그 기록 합계 (C.38, 다른 경기 포함). 내 선수는 player.season 에 따로 있다 */
  playerStats: Record<string, PlayerTotals>;
  /** 진행 설정 (C.38): quickOthers 면 다른 경기를 빠른 경기(통계)로 계산한다 (느린 기기). 기본은 전체 엔진 */
  options: { quickOthers: boolean };
  /** 훈련 (25.3, 부록 C.41): 날짜별 변경, 기술 훈련 게이지, 주간 XP 상한, 이번 시즌 합계 */
  training: TrainingState;
  /** 지난 시즌 기록 보존 (25.4, 부록 C.41): 내 경기 요약·하이라이트·결정, 다른 경기 스코어·득점자·도움, 선수 시즌 합계 */
  archive: SeasonArchive[];
  /** NPC 이적 기록 (18.6, 부록 C.42). 로스터 재생성 때 같은 순서로 다시 적용한다 */
  transfers: TransferRec[];
  /** 내 선수 계약·제안·이적 요청 (18.10, 부록 C.42) */
  market: MarketState;
  /** 비시즌에만: 다음 시즌 팀 레이팅 (로스터 + 시즌 팀 컨디션). 시즌 종료 때 계산해 제안 화면과 다음 시즌 시작에 쓴다 */
  nextRatings?: Record<string, number>;
  /** 구단 시즌 영입 예산 (C.46, NPC 전용). 쓴 돈·번 돈은 이적 기록 fee, 연봉 총액은 로스터에서 계산한다 */
  finance?: FinanceState;
  /** NPC 커리어 태그 뉴스 (C.45 14번, 최근 3시즌) */
  tagNews?: TagNews[];
  /** 1군 테스트 (C.45 10번): 커스텀 15~18세 유스 구단 선택. 없으면 null */
  trial?: TrialState | null;
  /** 사용자가 고친 선수 이름 (부록 C.44a): 선수 id → 별명·짧은 이름. 경기 화면 라벨에만 쓴다 */
  nameOverrides: NameOverrides;
  /** 사용자가 바꾼 도트 아이콘 (부록 C.45): 선수 id → 피부·머리, 팀 id(대표팀 `n:<국가>`) → 홈·원정 유니폼. 바꾼 것만. 겉모습만(경기 결과·시드 영향 없음) */
  pixelOverrides?: PixelOverrides;
}

/** 지난 시즌 하나의 보존 기록 (25.4 2번). 리플레이 프레임은 담지 않는다 (내 최근 5경기만 세이브 저장소에 따로) */
export interface SeasonArchive {
  season: number;
  teamId: string;
  /** 내 경기 (요약, 하이라이트 3, 결정 기록) */
  my: MatchLogEntry[];
  /** 다른 경기: [라운드(1부터), 홈, 원정, 홈 골, 원정 골, 득점 기록(엔진 경기만)] */
  results: [number, string, string, number, number, GoalRec[]?][];
  /** 선수 시즌 합계 [출전, 골, 도움, 평점 합 ×10] */
  players: Record<string, PlayerTotals>;
  /** 최종 순위 (팀 id, 승점, 득실) */
  table: [string, number, number][];
}

/** 선수 시즌 합계: [출전, 골, 도움, 평점 합 ×10, 출전 분(C.42, 이적 점수의 출전 시간 비율. 옛 기록에는 없다)] */
export type PlayerTotals = [number, number, number, number, number?];

export interface MatchControl {
  mode: ControlMode;
  stop: StopLevel;
}

export type NewGameOptions =
  /**
   * 가상 유망주 (pending 31·36, 부록 C.37). rolled = true 면 시드로 뽑은 유망주(rollProspect(seed))에 position(시작 후보 중 고른 자리)을
   * 붙인다 — 화면의 새 게임. 없으면 position 을 기준 자리로 맞는 재능 타입의 유망주를 만든다 (밸런스·테스트)
   */
  | { mode: 'prospect'; name?: string; position: PlayablePosition; seed?: string; difficulty: Difficulty; rolled?: boolean }
  | { mode: 'real'; playerId: string; seed?: string; difficulty: Difficulty }
  /** 커스텀 생성 (pending 47 2·49 1, 부록 C.45): 능력치·신체·장단점·나이·국적·외모를 고른다. 잠재력·숨은 적성·팀은 시드 랜덤 */
  | { mode: 'custom'; custom: CustomSpec; seed?: string; difficulty: Difficulty };

export interface CustomSpec {
  name?: string;
  position: PlayablePosition;
  /** 15~23 */
  age: number;
  attributes: FieldAttributes;
  body: Body;
  /** 고른 태그 (장단점, 영구/해제형) */
  tags: TagPick[];
  nationality: string;
  appearance: Appearance;
  /** 도트 머리 (경기 화면 캐릭터, pixel-kits 3.4) */
  pixelHair?: string;
  /** 시작 소속 (C.45 10번). 없으면 기존처럼 랜덤 팀 */
  start?: StartChoice;
}

/** 장단점이 정하는 시작 약발 (양발잡이 4, 약발 1) */
export function footFromTraits(body: Body, tags: readonly { id: string }[]): Body {
  const E = BALANCE.tags.effects;
  const traits = tags.map((t) => t.id);
  if (traits.includes('twoFooted')) return { ...body, weakFoot: Math.max(body.weakFoot, E.twoFootedStart) as WeakFoot };
  if (traits.includes('weakFootOne')) return { ...body, weakFoot: E.weakFootOneStart as WeakFoot };
  return body;
}

const rngFor = (seed: string, ...parts: (string | number)[]): Rng => createRng(hashSeed([seed, ...parts].join(':')));

export function emptySeasonStats(): SeasonStats {
  return {
    apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, matchXp: 0, moms: 0, injuries: 0, injuredWeeks: 0,
    yellows: 0, reds: 0, slumpPenalty: 0, rec: emptyRecord(), recApps: 0,
  };
}

/** 약발 +1 을 포인트로 산다 (C.45, pending 47 1): BALANCE.weakFoot.pointCost. 약발 5 면 불가 */
export function buyWeakFoot(state: GameState): boolean {
  const p = state.player;
  const cost = BALANCE.weakFoot.pointCost;
  if (p.body.weakFoot >= 5 || p.unspentPoints < cost) return false;
  p.unspentPoints -= cost;
  p.body = { ...p.body, weakFoot: clampWeakFoot(p.body.weakFoot + 1) };
  if (p.unspentPoints === 0) p.allocation = { levels: 0, raised: {} };
  return true;
}

/** 내 등번호 (C.45): 저장한 번호가 지금 팀에서 겹치면 그 팀에서 비어 있는 관례 번호 */
export function myShirt(state: GameState): number {
  const p = state.player;
  if (p.shirt !== undefined) {
    // 내 번호가 먼저: 같은 번호를 쓰던 팀 동료는 관례대로 다른 번호 (표시용, 로스터 재생성 때마다 같은 결과)
    const r = state.rosters?.[p.teamId];
    if (r && r.players.some((x) => x.shirt === p.shirt)) assignShirts(r, new Set([p.shirt]));
    return p.shirt;
  }
  return freeShirt(rosterShirts(state.rosters?.[p.teamId]), p.position);
}

/** 랜덤 유망주의 신체·장단점 (C.45): `me:<시드>` 신체, 장단점 0~2개. 기존 시드 흐름과 따로 */
export function prospectExtras(worldSeed: string, position: PlayablePosition): { body: Body; tags: PlayerTag[] } {
  const picks = rollTags(rngFor(worldSeed, 'traits'));
  return { body: footFromTraits(rollBody(`me:${worldSeed}`, position), picks), tags: picksToTags(picks, BALANCE.newGame.startYear) };
}

/** 그 팀 로스터의 등번호 */
export function rosterShirts(roster: { players: { shirt?: number }[] } | undefined): Set<number> {
  return new Set((roster?.players ?? []).map((p) => p.shirt).filter((n): n is number => n !== undefined));
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
  worldSeed: string, realPlayerId: string | undefined, updates: number, savedNpcs?: NpcState[], transfers: readonly TransferRec[] = [],
): Rosters {
  const start = BALANCE.newGame.startYear;
  const teams = initialTeams();
  const base = Object.fromEntries(teams.map((t) => [t.id, t.baseRating]));
  let npcs = initialNpcs(worldSeed, realPlayerId);
  let rosters = createRosters(worldSeed, start, teams, npcs);
  // 이적 기록 (C.42): 시즌 갱신 k 번째 전에 at = k 인 기록(그 시즌 겨울 → 시즌 끝 여름)을 차례로 다시 적용한다
  for (let k = 0; k < updates; k++) {
    replayTransfers(rosters, transfers, k, worldSeed);
    npcs = npcs.map((n) => growNpc(n, worldSeed, start + k));
    rosters = updateRostersForSeason(rosters, worldSeed, start + k, base, npcs);
  }
  replayTransfers(rosters, transfers, updates, worldSeed);
  if (savedNpcs) syncRealPlayers(rosters, savedNpcs);
  return rosters;
}

export function newGame(opts: NewGameOptions): GameState {
  const worldSeed = opts.seed?.trim() || randomSeed();
  const season = BALANCE.newGame.startYear;
  const league = createLeague(worldSeed, season);
  // 팀 레이팅 = 로스터 라인업 평균 (23번). 내 선수(실제 선수)는 로스터에서 빠진다
  const realPlayerId = opts.mode === 'real' ? opts.playerId : undefined;
  const npcs = initialNpcs(worldSeed, realPlayerId);
  // 새 게임은 늘린 이름 풀 (C.45 8번). 로스터를 만들기 전에 맞춘다
  setNamePoolVersion(2);
  const rosters = rebuildRosters(worldSeed, realPlayerId, 0);
  const ratings = teamRatings(rosters);
  for (const t of league.teams) t.rating = ratings[t.id] ?? t.rating;

  let player: PlayerState;
  const base = {
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, coachWarned: false, injury: null, recentRatings: [], slumpStreak: 0, season: emptySeasonStats(), history: [], suspended: 0,
  };

  if (opts.mode === 'custom') {
    const c = opts.custom;
    const C = BALANCE.custom;
    const age = Math.min(C.maxAge, Math.max(C.minAge, Math.round(c.age)));
    const height = Math.min(C.heightMax, Math.max(C.heightMin, Math.round(c.body.height)));
    const picks = c.tags.filter((t) => !CUSTOM_HIDDEN_TAGS.includes(t.id) && TAGS[t.id].source !== 'play');
    if (!validCustom(c.attributes, customBudget(age, picks, c.body.weakFoot), height)) throw new Error('커스텀 능력치가 포인트·상한을 넘었어요');
    // 잠재력·숨은 적성·팀은 랜덤 (숨은 적성은 커스텀에도 랜덤, pending 47 2)
    const roll = rollProspect(worldSeed, c.position);
    const prng = roll.rng;
    const byRating = [...league.teams].sort((a, b) => b.rating - a.rating);
    const { min, max } = BALANCE.newGame.teamRankRange;
    const team = byRating[randInt(prng, min, max) - 1]!;
    player = {
      ...base,
      name: c.name?.trim() || randomName(prng),
      position: c.position,
      age,
      teamId: team.id,
      attributes: { ...c.attributes },
      potentialTier: roll.potentialTier,
      reputation: 0,
      proficiency: initialProficiency(c.position),
      formerPositions: [],
      badges: [],
      honors: { ...NO_HONORS },
      aptitude: roll.aptitude, advice: null, adviceLog: [], aptBoost: null,
      body: { ...c.body, height, weakFoot: clampWeakFoot(c.body.weakFoot) },
      tags: picksToTags(picks, season),
      nationality: c.nationality,
      appearance: c.appearance,
      ...(c.pixelHair ? { pixelHair: c.pixelHair } : {}),
      custom: true,
    };
  } else if (opts.mode === 'prospect') {
    // 재능 타입 → 능력치 → 숨은 적성 (pending 31 2번). 시작 포지션은 시작 후보 중 고른 자리 (rolled) 또는 기준 자리
    const roll = rollProspect(worldSeed, opts.rolled ? undefined : opts.position);
    const prng = roll.rng;
    const byRating = [...league.teams].sort((a, b) => b.rating - a.rating);
    const { min, max } = BALANCE.newGame.teamRankRange;
    const team = byRating[randInt(prng, min, max) - 1]!;
    player = {
      ...base,
      name: opts.name?.trim() || randomName(prng),
      position: opts.position,
      age: BALANCE.newGame.startAge,
      teamId: team.id,
      attributes: roll.attributes,
      potentialTier: roll.potentialTier,
      reputation: 0,
      proficiency: initialProficiency(opts.position),
      formerPositions: [],
      badges: [],
      honors: { ...NO_HONORS },
      aptitude: roll.aptitude, advice: null, adviceLog: [], aptBoost: null,
      // 신체·장단점 (C.45): 별도 시드라 기존 유망주 결과(능력치·팀)는 그대로
      ...prospectExtras(worldSeed, opts.position),
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
      // 실제 선수 (pending 36 ④): 주 포지션군 1.2~1.4, 나머지 0.7~1.0, 엇갈림 없음
      aptitude: mainPositionAptitude(data.position, gen.attributes, aptitudeSeed(worldSeed)), advice: null, adviceLog: [], aptBoost: null,
      body: realBody(data.id) ?? rollBody(data.id, data.position),
      tags: [],
      shirt: data.shirtNumber,
    };
  }
  player.shirt ??= freeShirt(rosterShirts(rosters[player.teamId]), player.position);

  player.profLog = initialProfLog(player.proficiency);
  player.seasonStartAttrs = { ...player.attributes };
  const market = initialMarket({ worldSeed, league, player, phase: 'season' });
  const state: GameState = {
    transfers: [],
    nameOverrides: {},
    market,
    saveFormat: SAVE_FORMAT_VERSION,
    balanceVersion: BALANCE_VERSION,
    startPatch: PATCH_LABEL,
    namePool: 2,
    // 새 커리어는 개막 7일 전 소집부터 (25.3 5번, C.41)
    calendar: { date: addDays(seasonCalendar(worldSeed, season, league.schedule).opening, -BALANCE.training.vacation.campDays) },
    playerStats: {},
    options: { quickOthers: false },
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
    cards: initCollection(player.position),
    training: initTraining(addDays(seasonCalendar(worldSeed, season, league.schedule).opening, -BALANCE.training.vacation.campDays)),
    archive: [],
  };
  // 구단 재정 (C.46): 첫 시즌 예산 (지난 시즌 순위 대신 레이팅 순)
  ensureFinance(state, season);
  // 커스텀 생성 시작 소속 (C.45 10번): 유스 구단 1군 테스트 / 소속팀 선택 / 소속팀 없음(영입 제안)
  if (opts.mode === 'custom' && opts.custom.start) {
    const before = player.teamId;
    applyStart(state, opts.custom.start);
    if (player.teamId !== before) {
      state.tactics = teamDefaultTactics(player.teamId, rosters[player.teamId], player.position);
      const until = state.market.contract.until;
      state.market.contract = { ...initialContract(state), ...(state.trial ? { until } : {}) };
      player.shirt = freeShirt(rosterShirts(rosters[player.teamId]), player.position);
    }
  }
  // 원클럽맨 판정 기록 (C.45): 시작 구단 = 첫 성인 구단. 실제 선수는 지금 구단 입단 시즌부터. 1군 테스트·자유계약이면 계약할 때
  if (!state.trial && !state.market.free) {
    const since = player.realPlayerId ? REAL_CAREER[player.realPlayerId]?.since ?? season : season;
    player.clubRun = { club: player.teamId, renewals: 0, since, first: true };
    if (player.realPlayerId && REAL_CAREER[player.realPlayerId]) player.youth = { club: REAL_CAREER[player.realPlayerId]!.youth };
    checkOneClub(state);
    state.market.notice = null;
  }
  myShirt(state);
  return state;
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

// ── 하루 단위 진행 (25.1~25.2 5·7번, 부록 C.38) ──

/** 이번 시즌 일정 (시드로 다시 만든다) */
export function calendarOf(state: GameState): SeasonCalendar {
  return seasonCalendar(state.worldSeed, state.league.season, state.league.schedule);
}

/** 이번 라운드 내 경기 날짜. 시즌이 아니면 null */
export function myMatchDate(state: GameState): IsoDate | null {
  if (state.phase !== 'season') return null;
  const r = state.league.round;
  const i = state.league.schedule[r]?.findIndex((f) => f.home === state.player.teamId || f.away === state.player.teamId) ?? -1;
  return i >= 0 ? calendarOf(state).fixtureDates[r]![i]! : null;
}

/** 오늘 내 경기가 있다 */
export function isMatchDay(state: GameState): boolean {
  return myMatchDate(state) === state.calendar.date;
}

/** 오늘 열리는, 아직 결과가 없는 다른 팀 경기 [라운드, 경기 순번] */
export function todaysOthers(state: GameState): [number, number][] {
  if (state.phase !== 'season') return [];
  const cal = calendarOf(state);
  const me = state.player.teamId;
  const out: [number, number][] = [];
  state.league.schedule.forEach((round, r) => round.forEach((f, i) => {
    if (cal.fixtureDates[r]![i] === state.calendar.date && f.homeGoals === undefined && f.home !== me && f.away !== me) out.push([r, i]);
  }));
  return out;
}

export interface OtherJob { r: number; i: number; input: NpcMatchInput }

/** 다른 경기의 엔진 입력 (직렬화 가능, Web Worker 로 보낸다). 시드는 시즌·라운드·경기 순번으로 정해진다 */
export function otherJob(state: GameState, r: number, i: number): OtherJob {
  const { league } = state;
  const f = league.schedule[r]![i]!;
  return {
    r, i,
    input: {
      home: state.rosters[f.home]!, away: state.rosters[f.away]!,
      homeRating: teamById(league, f.home).rating, awayRating: teamById(league, f.away).rating,
      seed: hashSeed(`${state.worldSeed}:other:${league.season}:${r}:${i}`), worldSeed: state.worldSeed,
      leagueAvg: league.teams.reduce((t, x) => t + x.rating, 0) / league.teams.length,
    },
  };
}

/** 선수 기록을 시즌 합계에 더한다 (내 선수 'me' 는 player.season 에 따로) */
function addPlayerLines(state: GameState, res: NpcMatchResult): void {
  const st = (state.playerStats ??= {});
  for (const [id, min, g, a, r10] of res.players) {
    if (id === MY_ID) continue;
    const t = (st[id] ??= [0, 0, 0, 0, 0]);
    t[0]++; t[1] += g; t[2] += a; t[3] += r10;
    t[4] = (t[4] ?? 0) + min;
  }
}

/** 다른 경기 결과를 기록한다: 순위표, 스코어·득점자·도움, 선수 시즌 합계 */
export function applyOther(state: GameState, r: number, i: number, res: NpcMatchResult): void {
  const f = state.league.schedule[r]![i]!;
  if (f.homeGoals !== undefined) return;
  recordResult(state.league, f, res.hg, res.ag);
  if (res.goals.length) f.g = res.goals;
  addPlayerLines(state, res);
}

/**
 * 오늘 다른 경기를 이 스레드에서 계산한다. 'engine' = 22명 엔진(프레임 없이), 'quick' = 빠른 경기 (통계, 밸런스 시뮬·느린 기기).
 * 화면은 Web Worker 풀로 같은 otherJob 을 계산해 applyOther 한다 (결과는 같다)
 */
export function playOthers(state: GameState, how: 'engine' | 'quick'): void {
  for (const [r, i] of todaysOthers(state)) {
    if (how === 'engine') {
      applyOther(state, r, i, playNpcMatch(otherJob(state, r, i).input));
    } else {
      const f = state.league.schedule[r]![i]!;
      const [hg, ag] = simulateScore(rngFor(state.worldSeed, 'other', state.league.season, r, i), teamById(state.league, f.home).rating, teamById(state.league, f.away).rating);
      recordResult(state.league, f, hg, ag);
    }
  }
}

// ── 훈련과 휴가 (25.3, 부록 C.41) ──

const myDatesCache = new WeakMap<SeasonCalendar, Map<string, IsoDate[]>>();

/** 이번 시즌 내 경기 날짜 (오름차순) */
export function myMatchDates(state: GameState): IsoDate[] {
  const cal = calendarOf(state);
  const me = state.player.teamId;
  let byTeam = myDatesCache.get(cal);
  if (!byTeam) myDatesCache.set(cal, (byTeam = new Map()));
  let out = byTeam.get(me);
  if (!out) {
    out = state.league.schedule.map((round, r) => cal.fixtureDates[r]![round.findIndex((f) => f.home === me || f.away === me)]!).filter(Boolean);
    out.sort((a, b) => daysBetween(b, a));
    byTeam.set(me, out);
  }
  return out;
}

/** 소집일 = 개막 campDays 일 전 (비시즌 휴가 끝, 25.3 5번) */
export function campDate(state: GameState): IsoDate {
  return addDays(calendarOf(state).opening, -BALANCE.training.vacation.campDays);
}

/** 이번 시즌 소집일부터 지난 날 (포변 조언 기간, C.41) */
export function campDay(state: GameState): number {
  return daysBetween(campDate(state), state.calendar.date);
}

/** 앞 내 경기에서 지난 날, 다음 내 경기까지 남은 날 (그날 경기면 0). 없으면 null */
function matchGaps(state: GameState, date: IsoDate): { prev: IsoDate | null; next: IsoDate | null } {
  const dates = myMatchDates(state);
  let prev: IsoDate | null = null;
  let next: IsoDate | null = null;
  for (const d of dates) {
    const k = daysBetween(d, date);
    if (k > 0) prev = d;
    else if (next === null) next = d;
  }
  return { prev, next };
}

/** 휴가 날 (25.3 5번): A매치 휴식기를 사이에 둔 내 경기 두 개 사이, 앞 경기 afterMatch 일 뒤 ~ 다음 경기 beforeMatch 일 전 */
export function isVacationDay(state: GameState, date: IsoDate): boolean {
  if (state.phase !== 'season') return true;
  const V = BALANCE.training.vacation;
  const { prev, next } = matchGaps(state, date);
  if (!prev || !next) return false;
  if (daysBetween(prev, date) < V.afterMatch || daysBetween(date, next) < V.beforeMatch) return false;
  return calendarOf(state).breaks.some((b) => b.kind === 'international' && daysBetween(prev, b.date) > 0 && daysBetween(b.date, next) > 0);
}

/** 그 날 부상 중인지 (오늘 부상에서 날짜만큼 지난 값) */
function injuredOn(state: GameState, date: IsoDate): boolean {
  const inj = state.player.injury;
  if (!inj) return false;
  return inj.daysLeft > Math.max(0, daysBetween(state.calendar.date, date) - (inj.date === state.calendar.date ? 1 : 0));
}

/** 기본 계획 (변경 없을 때) */
export function plannedDefault(state: GameState, date: IsoDate): TrainingKind {
  const { prev, next } = matchGaps(state, date);
  return defaultPlan(prev ? daysBetween(prev, date) : null, next ? daysBetween(date, next) : null);
}

/**
 * 그 날 계획: 휴가 → 부상 중(재활, 휴식으로 바꿀 수 있음) → 경기 날 → 그날만 바꾼 훈련 → 기본 주간 계획.
 * 휴가 동안은 훈련 선택이 없다. 리그 외 경기(대표팀·컵·챔스, 5-6·6단계)가 생기면 그 일정은 휴가에서 뺀다 (훅: isVacationDay)
 */
export function dayPlan(state: GameState, date: IsoDate = state.calendar.date): DayPlan {
  if (state.phase !== 'season' || isVacationDay(state, date)) return 'vacation';
  const o = state.training?.overrides[date];
  if (injuredOn(state, date)) return o === 'rest' ? 'rest' : 'rehab';
  if (myMatchDates(state).includes(date)) return 'match';
  if (isRestLocked(state, date)) return 'rest';
  return o ?? plannedDefault(state, date);
}

/** 경기 다음 날 휴식 고정 (C.44 pending 52 1번): 부상 중이 아니면 바꿀 수 없다 */
export function isRestLocked(state: GameState, date: IsoDate): boolean {
  if (injuredOn(state, date)) return false;
  const { prev } = matchGaps(state, date);
  return isFixedRest(prev ? daysBetween(prev, date) : null);
}

/** 그날 훈련을 바꾼다 (그날만). 기본 계획과 같으면 변경을 지운다. 휴가·경기 날·경기 다음 날(휴식 고정)은 못 바꾼다 */
export function setDayTraining(state: GameState, date: IsoDate, kind: TrainingKind): boolean {
  const cur = dayPlan(state, date);
  if (cur === 'vacation' || cur === 'match' || daysBetween(state.calendar.date, date) < 0) return false;
  if (isRestLocked(state, date)) return false;
  if ((cur === 'rehab' || cur === 'rest') && injuredOn(state, date)) {
    if (kind !== 'rest' && kind !== 'recovery') return false;
    if (kind === 'rest') state.training.overrides[date] = 'rest';
    else delete state.training.overrides[date];
    return true;
  }
  if (kind === plannedDefault(state, date)) delete state.training.overrides[date];
  else state.training.overrides[date] = kind;
  return true;
}

/** 피로·부상만 (경기 날 아침 예상, 상태를 바꾸지 않는 계산에도 쓴다) */
function conditionStep(p: Pick<PlayerState, 'fatigue' | 'injury'> & Tagged, kind: DayPlan, date: IsoDate): void {
  // 장단점 (C.45): 회복력 +20%·체력 회복 느림 −20% (회복하는 날만)
  const rec = planFatigue(kind);
  p.fatigue = Math.max(0, p.fatigue - (rec > 0 ? rec * recoveryMul(p) : rec));
  if (p.injury && p.injury.date !== date) healDays(p as PlayerState, 1 + (kind === 'rest' ? BALANCE.training.restHealBonus : 0));
}

/** 다음 경기 상대 힌트 후보 (영상 분석) */
function opponentHints(state: GameState): string[] {
  const fx = nextFixture(state);
  if (!fx) return [];
  const { league } = state;
  const opp = teamById(league, fx.opponentId);
  const out: string[] = [];
  const played = league.schedule.slice(0, league.round).flatMap((round) => round.filter((f) => (f.home === opp.id || f.away === opp.id) && f.homeGoals !== undefined));
  const last = played.slice(-5);
  if (last.length) {
    let gf = 0;
    let ga = 0;
    const form = last.map((f) => {
      const [a, b] = f.home === opp.id ? [f.homeGoals!, f.awayGoals!] : [f.awayGoals!, f.homeGoals!];
      gf += a;
      ga += b;
      return a > b ? '승' : a === b ? '무' : '패';
    }).join('');
    out.push(`${opp.nameKo} 최근 ${last.length}경기 ${form} · 득점 ${gf} 실점 ${ga}`);
  }
  const rank = [...league.teams].sort((a, b) => b.rating - a.rating).findIndex((t) => t.id === opp.id) + 1;
  out.push(`${opp.nameKo} 전력 ${Math.round(opp.rating)} (리그 ${rank}위) · ${fx.home ? '우리 홈' : '상대 홈'} 경기`);
  const roster = state.rosters[opp.id];
  const stats = state.playerStats ?? {};
  const top = roster?.players.map((pl) => ({ pl, g: stats[pl.id]?.[1] ?? 0 })).sort((a, b) => b.g - a.g)[0];
  if (top && top.g > 0) out.push(`주 득점원 ${top.pl.nameKo} (이번 시즌 ${top.g}골) — 박스 안 마크를 놓치지 마세요`);
  else {
    const best = roster?.players.filter((pl) => pl.attributes).map((pl) => ({ pl, o: positionOvr(pl.attributes!, pl.position as FieldPosition) })).sort((a, b) => b.o - a.o)[0];
    if (best) out.push(`가장 위험한 선수 ${best.pl.nameKo} (${best.pl.position}) — 공을 잡으면 바로 붙어요`);
  }
  const conceded = played.reduce((t, f) => t + (f.home === opp.id ? f.awayGoals! : f.homeGoals!), 0);
  if (played.length >= 3) out.push(`${opp.nameKo} 경기당 실점 ${(conceded / played.length).toFixed(1)} — ${conceded / played.length >= 1.5 ? '수비가 흔들려요, 슈팅 기회를 노려요' : '수비가 단단해요, 인내심 있게'}`);
  return out;
}

/** 지금 전술에서 내 역할 id */
function myRole(state: GameState): string | undefined {
  const roster = state.rosters?.[state.player.teamId];
  if (!state.tactics || !roster) return undefined;
  return previewLineup(state.tactics, roster, { name: state.player.name, attrs: state.player.attributes })[state.tactics.mySlot]?.role;
}

/** 하루 끝 (7번, C.41): 그날 계획대로 훈련(XP·피로·효과) 또는 휴가·재활. 부상은 다친 날 다음 날부터 하루씩 */
function dayStep(state: GameState, date: IsoDate): TrainingDayResult {
  const p = state.player;
  const t = (state.training ??= initTraining(date));
  const kind = dayPlan(state, date);
  const T = BALANCE.training;
  const res: TrainingDayResult = { date, kind, xp: 0, fatigue: Math.min(p.fatigue, planFatigue(kind) > 0 ? planFatigue(kind) * recoveryMul(p) : planFatigue(kind)) };
  conditionStep(p, kind, date);
  // 휴가는 연속 휴식에 세지 않는다. 회복 훈련은 연속을 끊고 폼 감점을 지운다
  if (kind === 'rest') {
    t.restStreak++;
    if (t.restStreak >= T.restStreak) t.formPenalty = T.restFormPenalty;
  } else if (kind !== 'match' && kind !== 'rehab') {
    t.restStreak = 0;
    if (kind === 'recovery') t.formPenalty = 0;
  }
  const raw = planXp(kind);
  if (raw > 0) {
    const { gained, whole } = takeXp(t, date, raw, veteranXpMultiplier(p.age) * BALANCE.difficulty[state.difficulty].xp * xpMul(p, true));
    res.xp = gained;
    if (whole > 0) addXp(p, whole);
    p.season.trainingXp = (p.season.trainingXp ?? 0) + whole;
  }
  switch (kind) {
    case 'tech': {
      const g = techBundle(t, p.position);
      res.bundle = g;
      // 고령 감쇠는 게이지에도 (25.3 1번 "고령 XP 감쇠도 똑같이")
      const up = techDay(t, p, g, veteranXpMultiplier(p.age));
      if (up) res.up = up;
      break;
    }
    case 'weakFoot': {
      // 약발 훈련 (C.45): 게이지 +1 (고령 감쇠), 다 차면 약발 +1. 시즌 최대 BALANCE.weakFoot.seasonMax
      const W = BALANCE.weakFoot;
      const wt = (p.weakFootTrain ??= { gauge: 0, gained: 0 });
      if (p.body.weakFoot >= 5) res.note = '약발 5 · 이미 양발잡이예요';
      else if (wt.gained >= W.seasonMax) res.note = `이번 시즌 약발 훈련 최대(+${W.seasonMax})에 닿았어요`;
      else {
        wt.gauge += veteranXpMultiplier(p.age);
        if (wt.gauge >= W.trainingGauge - 1e-9) {
          wt.gauge = 0;
          wt.gained++;
          p.body = { ...p.body, weakFoot: clampWeakFoot(p.body.weakFoot + 1) };
          res.weakFootUp = p.body.weakFoot;
          res.note = `약발 ${p.body.weakFoot}${p.body.weakFoot >= 5 ? ' · 양발잡이' : ''}`;
        } else res.note = `약발 게이지 ${Math.floor(wt.gauge)}/${W.trainingGauge}`;
      }
      break;
    }
    case 'intense': {
      const I = T.intenseInjury;
      const rng = rngFor(state.worldSeed, 'train-injury', date);
      if (!p.injury && rng() < I.chance * BALANCE.difficulty[state.difficulty].injury) {
        const days = randInt(rng, I.days[0], I.days[1]);
        p.injury = { grade: 'minor', weeksTotal: Math.ceil(days / 7), daysTotal: days, daysLeft: days, date, season: state.league.season, round: state.league.round + 1, permanent: {} };
        p.season.injuries++;
        res.injured = true;
      }
      break;
    }
    case 'position': {
      const pos = state.tactics ? myMatchPosition(state) : p.position;
      const d = trainProficiency(p, pos, T.positionProf);
      const notes = [d > 0 ? `${pos} 숙련도 +${d.toFixed(2)}` : `${pos} 숙련도 100`];
      const role = myRole(state);
      if (role && state.cards) {
        t.roleProg += T.roleApps;
        if (t.roleProg >= 1 - 1e-9) {
          t.roleProg -= 1;
          const unlocked = afterMatch(state.cards, undefined, role, true);
          if (unlocked) notes.push(`${cardById(unlocked)?.name ?? unlocked} 해금`);
        }
      }
      res.note = notes.join(' · ');
      break;
    }
    case 'setpiece': {
      const deck = state.cards ? cardInput(state.cards).deck : [];
      if (deck.length) {
        const id = deck.reduce((lo, c) => ((state.cards.mastery[c] ?? 0) + (t.cardProg[c] ?? 0) < (state.cards.mastery[lo] ?? 0) + (t.cardProg[lo] ?? 0) ? c : lo));
        t.cardProg[id] = (t.cardProg[id] ?? 0) + T.cardMastery;
        if (t.cardProg[id]! >= 1 - 1e-9) {
          t.cardProg[id]! -= 1;
          state.cards.mastery[id] = (state.cards.mastery[id] ?? 0) + 1;
        }
        res.note = `${cardById(id)?.name ?? id} 숙련 +${T.cardMastery}`;
      }
      break;
    }
    case 'video': {
      const hint = opponentHints(state).find((h) => !t.hints.includes(h));
      if (hint && t.hints.length < T.videoHintsMax) {
        t.hints.push(hint);
        res.note = hint;
      }
      // 경기 전날이면 시작 패 +1 (엔진 카드 입력에 자리가 생기면 쓴다, 지금은 표시만)
      if (myMatchDates(state).includes(addDays(date, 1))) t.eve = true;
      break;
    }
    default: break;
  }
  t.season.fatigue += res.fatigue;
  t.season.days[kind] = (t.season.days[kind] ?? 0) + 1;
  t.last = res;
  for (const d of Object.keys(t.overrides)) if (daysBetween(d, date) >= 0) delete t.overrides[d];
  return res;
}

/** 훈련 결과 한 줄 (화면 알림) */
export function trainingLine(r: TrainingDayResult): string {
  const parts = [TRAINING_NAMES_KO[r.kind] + (r.bundle ? `(${BUNDLE_NAMES_KO[r.bundle]})` : '')];
  if (r.xp > 0) parts.push(`XP +${r.xp.toFixed(1)}`);
  if (r.fatigue > 0) parts.push(`체력 +${r.fatigue.toFixed(1)}`);
  if (r.up) parts.push(`${ATTRIBUTE_NAMES_KO[r.up].replace(/\(.*\)$/, '')} 진행 +1/5칸`);
  if (r.injured) parts.push('훈련 중 부상');
  if (r.note) parts.push(r.note);
  return parts.join(' · ');
}

/** 오늘을 끝내고 다음 날로. 오늘 다른 경기가 남았거나 내 경기를 아직 안 치렀으면 오류 */
export function endDay(state: GameState): TrainingDayResult {
  if (state.phase !== 'season') throw new Error('시즌 중이 아님');
  if (isMatchDay(state)) throw new Error('오늘 내 경기가 남았음');
  if (todaysOthers(state).length) throw new Error('오늘 다른 경기가 남았음');
  const ended = state.calendar.date;
  const r = dayStep(state, ended);
  state.calendar.date = addDays(ended, 1);
  // 이적 (C.42): 1월 1일 이적 명단 제안, 1월 31일 끝 NPC 겨울 이적시장
  onDayEnd(state, ended);
  return r;
}

/** 오늘에서 to 날짜 아침까지 하루씩 넘겼을 때의 피로·부상 (상태는 바꾸지 않는다). 그날들의 훈련 계획대로 */
function projectedCondition(state: GameState, to: IsoDate): Pick<PlayerState, 'fatigue' | 'injury'> {
  const p = { fatigue: state.player.fatigue, injury: state.player.injury ? { ...state.player.injury } : null };
  for (let d = state.calendar.date; daysBetween(d, to) > 0; d = addDays(d, 1)) conditionStep(p, dayPlan(state, d), d);
  return p;
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
  /** false 면 카드 없이 (엔진 회귀 측정용, C.36). 기본은 지금 덱 */
  cards?: boolean;
  /**
   * 내 경기 날까지 넘기는 날의 다른 경기 계산 (C.38). 기본 'quick' (테스트·밸런스). 화면은 Web Worker 로 미리 계산해 두므로
   * 경기 날에 부를 때는 남은 다른 경기가 없다
   */
  others?: 'engine' | 'quick';
}

/** 이번 라운드 내 경기의 엔진 입력 (상태를 바꾸지 않는다). 결장(부상·정지·벤치)이어도 입력은 만든다 */
export interface RoundMatch {
  input: EngineMatchInput;
  plan: MyMatchPlan;
  preInjury: Injury | null;
  /** 재생 화면 팀 이름 [홈, 원정] */
  teams: [string, string];
}

export function roundMatch(state: GameState, opts: { cards?: boolean } = {}): RoundMatch {
  const { league, player } = state;
  const roundIdx = league.round;
  const seed = state.worldSeed;
  // 경기 날 아침의 피로·부상 (오늘이 경기 날이면 지금 값, C.38)
  const cond = projectedCondition(state, myMatchDate(state) ?? state.calendar.date);
  const injured = cond.injury !== null;
  const suspended = !injured && player.suspended > 0;
  const fatigue = cond.fatigue;
  const p = { ...player, fatigue };
  const fx = nextFixture(state)!;
  const myTeam = teamById(league, player.teamId);
  const opp = teamById(league, fx.opponentId);
  const pos = myMatchPosition(state);
  const ovr = proficientOvr(p, pos);
  const form = matchForm(state);
  const remaining = league.schedule.length - roundIdx - 1;
  const at = matchAt(state);
  // 선발/교체 판정은 기존 방식 (E.10), 부상은 경기 전 판정 후 그 분에 교체 아웃 (E.16)
  const rng = rngFor(seed, 'match', league.season, roundIdx);
  const M = BALANCE.match;
  const available = !injured && !suspended;
  // 1군 테스트 중 (C.45 10번)이면 출전 보장 (같은 난수를 써서 테스트가 없을 때 결과는 그대로)
  const startRoll = rng();
  const started = available && (!!state.trial || startRoll < startProbability(ovr, myTeam.rating, fatigue));
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
    me: { position: pos, attributes: player.attributes, fatigue, form, proficiency: engineProficiency(player, pos), body: player.body, shirt: myShirt(state), cardMul: cardMul(player) },
    plan, difficulty: state.difficulty, seed: hashSeed(`${seed}:engine:${league.season}:${roundIdx}`), worldSeed: seed,
    leagueAvg: league.teams.reduce((t, x) => t + x.rating, 0) / league.teams.length, myTactics: state.tactics,
    ...(opts.cards !== false && state.cards ? { cards: cardInput(state.cards) } : {}),
  };
  return { input, plan, preInjury, teams: fx.home ? [myTeam.nameKo, opp.nameKo] : [opp.nameKo, myTeam.nameKo] };
}

/** 이번 경기 폼 보정: 최근 평점 폼 − 연속 휴식 감점 (C.41) */
function matchForm(state: GameState): number {
  const p = state.player;
  const fx = nextFixture(state);
  const big = !!fx && derbyOf(p.teamId, fx.opponentId) !== null;
  return formBonus(p.recentRatings, formMul(p)) + bigGameForm(p, big) - (state.training?.formPenalty ?? 0);
}

/** 부상 판정용 경기 시점: 시즌·라운드(1부터)·날짜·최종 라운드까지 남은 날 */
function matchAt(state: GameState): { season: number; round: number; date: IsoDate; daysToEnd: number } {
  const date = myMatchDate(state) ?? state.calendar.date;
  return { season: state.league.season, round: state.league.round + 1, date, daysToEnd: daysBetween(date, calendarOf(state).final) };
}

/**
 * 다음 내 경기까지 진행 (C.38): 내 경기 날까지 하루씩 넘기고(다른 경기는 opts.others), 그날 다른 경기 → 내 경기를 치른 뒤
 * 그날을 끝낸다. 마지막 라운드면 시즌 종료 처리까지 한다
 */
export function playRound(state: GameState, opts: PlayOptions = {}): MatchReport {
  if (state.phase !== 'season') throw new Error('시즌 중이 아님');
  const how = opts.others ?? 'quick';
  while (!isMatchDay(state)) {
    playOthers(state, how);
    endDay(state);
  }
  playOthers(state, how);
  const report = playMyRound(state, opts);
  if (state.phase === 'season') endDay(state);
  return report;
}

/** 오늘(내 경기 날) 내 경기 한 라운드. 다른 경기는 이미 계산했어야 한다 */
function playMyRound(state: GameState, opts: PlayOptions): MatchReport {
  const { league, player } = state;
  const roundIdx = league.round;
  const fixtures = league.schedule[roundIdx]!;
  const seed = state.worldSeed;
  const useEngine = (opts.engine ?? 'agent') === 'agent';

  const injured = player.injury !== null;
  const suspended = !injured && player.suspended > 0;
  // 피로 회복은 하루가 끝날 때마다 (dayStep). 오늘이 경기 날이라 roundMatch 의 피로는 지금 값이다
  const rm = useEngine ? roundMatch(state, { cards: opts.cards }) : null;

  // 내 경기
  const fx = nextFixture(state)!;
  const myTeam = teamById(league, player.teamId);
  const opp = teamById(league, fx.opponentId);
  // 내 슬롯 포지션의 OVR 로 선발 판정 (E.19 ②: 주 포지션 밖이면 그만큼 손해). 빠른 경기는 주 포지션 그대로
  const pos = useEngine ? myMatchPosition(state) : player.position;
  const ovr = proficientOvr(player, pos);
  const form = matchForm(state);
  const remaining = league.schedule.length - roundIdx - 1;
  const at = matchAt(state);
  // 포변 조언 (부록 C.37): 기간이 지났으면 지우고, 조언받은 포지션군으로 뛰면 보너스를 건다
  const adviceTaken = checkAdviceTaken(player, pos, league.season, campDay(state));

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
  } else {
    result = simulateMatch(
      {
        ovr, position: player.position, fatigue: player.fatigue,
        teamRating: myTeam.rating, oppRating: opp.rating, home: fx.home, difficulty: state.difficulty,
        formBonus: form, injured: injured || suspended, ...(state.trial ? { forceStart: true } : {}),
      },
      rngFor(seed, 'match', league.season, roundIdx),
    );
  }

  // 내 경기 결과 (다른 경기는 그날 따로 계산했다, C.38). 엔진 경기면 득점자·도움과 양 팀 선수 기록도 남긴다
  const myFx = fixtures.find((f) => f.home === player.teamId || f.away === player.teamId)!;
  if (myFx.home === player.teamId) recordResult(league, myFx, result.goalsFor, result.goalsAgainst);
  else recordResult(league, myFx, result.goalsAgainst, result.goalsFor);
  if (engineOut) {
    const sum = summarize(engineOut.engine);
    if (sum.goals.length) myFx.g = sum.goals;
    addPlayerLines(state, sum);
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
  // 부상: 결장한 라운드를 세고 (회복은 하루 단위, 다음 내 경기 전에 낫는지 표시), 출전했으면 판정 (피로는 경기 시작 때 값)
  let injury: Injury | undefined;
  let recovered = false;
  if (injured) {
    s.injuredWeeks++;
    const next = league.schedule[roundIdx + 1] ? calendarOf(state).fixtureDates[roundIdx + 1]![league.schedule[roundIdx + 1]!.findIndex((f) => f.home === player.teamId || f.away === player.teamId)]! : null;
    recovered = next !== null && player.injury!.daysLeft <= daysBetween(state.calendar.date, next);
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
  const decisions = engineOut?.engine.decisions ?? [];
  const hl = engineOut ? matchHighlights(state, myFx, fx.home, result, decisions) : [];
  state.matchLog.push({
    round: roundIdx + 1, opponentId: opp.id, home: fx.home, goalsFor: result.goalsFor, goalsAgainst: result.goalsAgainst,
    minutes: result.minutes, started: result.started, goals: result.goals, assists: result.assists, rating: result.rating, mom: result.mom,
    ...(result.minutes > 0 ? {} : { absent: injured ? 'injured' : suspended ? 'suspended' : 'bench' }),
    position: pos, rec: rec ?? null,
    ...(hl.length ? { hl } : {}),
    ...(decisions.length ? { dec: decisions.map((d) => ({ m: d.minute, scene: SCENE_LABEL[d.scene], label: d.label, r: d.seen?.result ?? d.result, d: Math.round(d.delta * 100) / 100, ...(d.card ? { card: d.card } : {}) })) } : {}),
  });
  afterTeamMatch(player, result.minutes, pos);
  if (result.minutes > 0) {
    if (my) player.fatigue = Math.min(BALANCE.fatigue.max, player.fatigue + fatigueFromDistance(my.distance));
    else updateFatigueForMatch(player, result.minutes);
  }
  // 경기 XP × 0.8, 결장 경기는 0 (옛 결장 주 훈련 XP·재활 XP 는 하루 훈련으로, 25.3 1번). 30세부터 고령 감쇠 (6.1)
  result.xp = result.minutes > 0 ? Math.round(result.xp * BALANCE.training.matchXpScale * veteranXpMultiplier(player.age)) : 0;
  // 늦은 개화 (C.45): 경기 XP 배율
  const xm = xpMul(player, false);
  if (xm !== 1) result.xp = Math.round(result.xp * xm);
  // 영상 분석 힌트·연속 휴식 폼 감점은 이 경기로 끝
  if (state.training) {
    state.training.hints = [];
    state.training.eve = false;
    state.training.formPenalty = 0;
  }
  s.matchXp += result.xp;
  const levelsGained = addXp(player, result.xp);
  // 카드 (C.36): 숙련도, 역할 출전 → 시그니처 해금, 레벨업 5레벨마다 선택권
  let cardUnlock: string | undefined;
  if (state.cards) {
    const unlocked = afterMatch(state.cards, engineOut?.engine.cards, engineOut?.engine.myRole, result.minutes > 0);
    if (unlocked) cardUnlock = cardById(unlocked)?.name;
    grantLevelPicks(state.cards, player.level, player.position, seed);
  }
  const cardUses = engineOut?.engine.cards?.uses.map((u) => ({ name: cardById(u.id)?.name ?? u.id, minute: u.minute, result: u.result, auto: u.auto }));

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
    ...(cardUses?.length ? { cardUses } : {}),
    ...(cardUnlock ? { cardUnlock } : {}),
    ...(slump ? { slump } : {}),
    ...(adviceTaken ? { adviceTaken: true } : {}),
  };
  state.lastMatch = report;
  // 1군 테스트 (C.45 10번): 경기마다 기록, 3경기 뒤 판정 (합격 → 계약 제안, 방출 → 영입 제안, 애매하면 5경기까지)
  if (state.trial) afterTrialMatch(state, result);

  if (league.round >= league.schedule.length) endSeason(state);
  refreshUnlocks(state);
  return report;
}

/** 선수 이름 (내 선수는 내 이름) */
function playerName(state: GameState, id: string): string {
  if (id === MY_ID) return state.player.name;
  for (const r of Object.values(state.rosters ?? {})) {
    const p = r.players.find((x) => x.id === id);
    if (p) return p.nameKo;
  }
  return id;
}

/**
 * 하이라이트 3줄 (25.4 2번): 내가 낀 골 → 그 밖의 골 → 결과가 크게 갈린 내 결정 → MOM 순으로 3개까지.
 * 리플레이 프레임 없이도 보이는 글로 남긴다
 */
function matchHighlights(state: GameState, f: Fixture, home: boolean, result: MatchResult, decisions: DecisionRecord[]): string[] {
  const side = home ? 0 : 1;
  const goals = (f.g ?? []).map(([min, team, scorer, assist]) => ({
    min, mine: scorer === MY_ID || assist === MY_ID,
    text: `${min}' ${team === side ? '득점' : '실점'} — ${playerName(state, scorer)}${assist ? ` (도움 ${playerName(state, assist)})` : ''}`,
  }));
  const out = [...goals.filter((g) => g.mine), ...goals.filter((g) => !g.mine)].map((g) => ({ min: g.min, text: g.text }));
  const big = [...decisions].filter((d) => d.result !== 'neutral').sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const d of big.slice(0, 2)) out.push({ min: d.minute, text: `${d.minute}' ${SCENE_LABEL[d.scene]} · ${d.label} ${d.result === 'success' ? '성공' : '실패'}` });
  const top = out.slice(0, 3).sort((a, b) => a.min - b.min).map((x) => x.text);
  if (top.length < 3 && result.mom) top.push('경기 최우수 선수 (MOM)');
  return top;
}

/** 시즌 기록 보존 (25.4 2번): 다음 시즌을 시작할 때 이번 시즌을 줄여 담는다 */
function archiveSeason(state: GameState): SeasonArchive {
  const me = state.player.teamId;
  const results: SeasonArchive['results'] = [];
  state.league.schedule.forEach((round, r) => round.forEach((f) => {
    if (f.homeGoals === undefined || f.home === me || f.away === me) return;
    results.push(f.g?.length ? [r + 1, f.home, f.away, f.homeGoals, f.awayGoals!, f.g] : [r + 1, f.home, f.away, f.homeGoals, f.awayGoals!]);
  }));
  return {
    season: state.league.season, teamId: me, my: state.matchLog, results, players: state.playerStats ?? {},
    table: sortedTable(state.league).map((row) => [row.teamId, row.points, row.gf - row.ga]),
  };
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
  // 벤치 장기화 (D.19, C.42): 출전 시간 비율 maxShare 미만 시즌이 seasons 시즌 연속
  const BS = R.benchStreak;
  const prevShares = player.history.slice(-(BS.seasons - 1)).map((h) => h.minutes / Math.max(1, league.schedule.length * 90));
  const benchLong = share < BS.maxShare && prevShares.length === BS.seasons - 1 && prevShares.every((x) => x < BS.maxShare);
  const bench = benchLong ? deductReputation(player, Math.round(repBase * BS.points)) : null;

  // 3~4. 자동 성장, 노련함, 노화
  // 실제 선수는 정점 목표 근처에 오면 자동 성장을 멈춘다 (부록 D.7 #1)
  const nearPeak = player.peakTarget !== undefined && ovrBefore >= player.peakTarget - BALANCE.growth.realPeak.autoGrowthStopBelow;
  const autoGrowth = nearPeak ? {} : applyAutoGrowth(player.attributes, age, player.potentialTier, rng);
  const veteranGrowth = applyVeteranGrowth(player.attributes, age, rng);
  const aging = applyAging(player.attributes, age, rng, player.position, agingMul(player));

  // 5. 나이
  player.age = age + 1;

  // 6. 기록
  const record: SeasonRecord = {
    ...player.season, season, age, teamId: player.teamId, leaguePosition: pos,
    achievementXp, ovr: ovrBefore, reputation: player.reputation, position: player.position,
  };
  player.history.push(record);

  // 7. 레전드 배지 (D.4: 부여 시 위상 +BALANCE.badges.reputation). 숙련도 감소는 경기마다 (C.39)
  // 포변 조언 (pending 31 3번): 2시즌 연속 부진 + 적성이 더 높은 포지션군 → 감독 한마디, 그다음부터 뉴스 (시즌 종료마다 한 번)
  const advice = evaluateAdvice(player, season);
  const badges = awardBadges(player, season);
  record.reputation = player.reputation;
  const endFloorTier = reputationFloorTier(player.reputation);
  const tierReached = endFloorTier && endFloorTier !== startFloorTier ? endFloorTier : undefined;

  // NPC: 여름 이적시장 (C.42, 이번 시즌 기록·계약으로, 성장 전) → 성장 → 로스터 시즌 갱신 (은퇴·보충·재계약)
  const tagsBefore = npcTagMap(state);
  // 구단 재정 (C.46): 다가올 시즌 예산 = 등급 + 이번 시즌 순위 상금 (판 선수 몸값은 이적 기록으로 더해진다)
  ensureFinance(state, season + 1, Object.fromEntries(sortedTable(league).map((r, i) => [r.teamId, i + 1])));
  const summer = runNpcWindow(state, 'summer');
  state.npcs = state.npcs.map((n) => growNpc(n, state.worldSeed, season));
  const base = Object.fromEntries(league.teams.map((t) => [t.id, t.baseRating]));
  state.rosters = updateRostersForSeason(state.rosters, state.worldSeed, season, base, state.npcs);
  state.roster.updates++;
  // NPC 커리어 태그 뉴스 (C.45 14번): 다음 시즌 기준으로 새로 붙은 원클럽맨·영원한 <구단>
  recordTagNews(state, tagsBefore, season + 1);
  state.nextRatings = seasonTeamRatings(state);

  const summary: SeasonSummary = {
    season, age, leaguePosition: pos, achievements, achievementXp, levelsGained,
    reputationBefore, reputationAfter: player.reputation, slumpPenalty: slumpTotal,
    rankPenalty: { expected, pos, points: rank.points, blocked: rank.blocked },
    slumpBlocked: player.history.at(-1)!.slumpBlocked ?? 0, decayBlocked,
    redPenalty: { reds, ...red }, minutesPenalty: { share, ...short },
    ...(bench ? { benchPenalty: bench } : {}), transfers: summer.length,
    ...(tierReached ? { tierReached } : {}), ...(advice ? { advice: advice.kind } : {}), badges, autoGrowth, veteranGrowth, aging,
    ovrBefore, ovrAfter: playerOvr(player),
    canRetire: age >= BALANCE.retirement.optionalAge,
    // 내 선수 강제 은퇴 없음 (pending 48 1, C.45). 필드는 옛 세이브·화면 호환으로 늘 false
    forcedRetire: false,
  };
  // 시즌 종료 카드 보상 3택 1 (F.1 간이 경로, C.36)
  if (state.cards) grantSeasonPick(state.cards, state.league.season, state.player.position, state.worldSeed);
  state.lastSeasonSummary = summary;
  state.phase = summary.forcedRetire ? 'retired' : 'offseason';
  // 내 선수 (18.10): 임대 복귀, 계약 만료면 재계약, 제안 3~5개
  if (state.phase === 'offseason') {
    openOffseasonMarket(state);
    // 재계약 판정 (C.46, 모든 선수): 연봉 여력·포지션 인원·팀 안 순위로 재계약 실패·방출 → 영입 제안
    if (state.market.renewal && renewalFails(state)) release(state, 'renew', `${teamById(league, player.teamId).nameKo} 재계약 실패 · 방출됐어요. 영입 제안을 골라요`);
  }
  // 태그 (C.45): 해제형 태그 판정, 원클럽맨·영원한
  const gone = seasonRemovals(player, player.injury?.grade === 'seasonEnding');
  if (gone.length) state.market.notice = `태그 해제 · ${gone.map((t) => TAGS[t.id].ko).join(', ')}`;
  seasonEndTags(state);
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
  // 답하지 않은 제안은 거절, 만료 계약은 기본 재계약 (화면은 [다음 시즌] 전에 멈춰 답을 받는다, C.42)
  if (marketPending(state)) autoMarket(state, 'stay');
  (state.archive ??= []).push(archiveSeason(state));
  state.league = nextSeasonLeague(state.league, state.worldSeed, state.nextRatings ?? seasonTeamRatings(state));
  delete state.nextRatings;
  if (state.market) state.market.request = null;
  state.player.season = emptySeasonStats();
  state.player.season.startLevel = state.player.level;
  state.player.seasonStartAttrs = { ...state.player.attributes };
  state.matchLog = [];
  // 비시즌 휴가 (25.3 5번): 피로 하루 −6 이라 소집 때는 0. 개막 7일 전 소집부터 훈련 계획과 첫 경기 준비
  state.player.fatigue = 0;
  healDays(state.player, BALANCE.injury.offseasonWeeks * 7);
  state.calendar = { date: campDate(state) };
  state.training ??= initTraining(state.calendar.date);
  newTrainingSeason(state.training);
  // 약발 훈련 시즌 상한 초기화 (게이지는 남긴다, C.45)
  if (state.player.weakFootTrain) state.player.weakFootTrain.gained = 0;
  state.training.restStreak = 0;
  state.training.formPenalty = 0;
  state.playerStats = {};
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

/** 내 선수 제안 수락 (C.42): 약팀 이적이면 위상 감점 (D.19, 티어 하한) */
export function acceptMyOffer(state: GameState, index: number): { points: number } {
  const offers = [...(state.market.offers ?? [])];
  const from = state.player.teamId;
  const r = acceptOffer(state, index, (pts) => deductReputation(state.player, pts).points);
  // 스토리 태그 (C.45 13번): 아카데미 출신·친정 선택·귀환·방출의 설움
  if (offers[index]) afterAccept(state, offers[index]!, offers, from);
  return r;
}

/** 커리어 시뮬의 자동 응답 (밸런스·테스트) */
export function autoMarket(state: GameState, policy: 'stay' | 'best'): void {
  autoResolveMarket(state, policy, (pts) => deductReputation(state.player, pts).points);
}

/** 주 포지션 변경 요청이 되는지 (D.3 비시즌 + 포변 조언 기간, 부록 C.37) */
export function canChangePosition(state: GameState): boolean {
  return state.phase === 'offseason' || (state.phase === 'season' && adviceOpen(state.player, state.league.season, campDay(state)));
}
