// 뷰모델 (부록 H.2): 게임 상태 → 화면에 필요한 값. 화면 모듈(src/ui/views/)은 이 값만 받아 그린다.
// 게임 로직(확률, 성장 계산)은 넣지 않고 기존 함수의 결과를 읽기만 한다

import { CLIP_KO, findClips, type ClipKind } from '../highlightClips';
import { pickLeagueOf, prospectTeamPick, leagueGroupOf } from './teamPickVM';
import { rollCustom } from './customRandom';
import { goalLabel, SOURCE_KO, TIER_KO, valueLabel } from '../seasonGoals';
import { CHAPTER_IDS, CHAPTER_KO, CHAPTER_THEME_KO, currentChapter, pendingChapterReview, type ChapterId } from '../chapters';
import { topChemMates, type ChemMateVM } from '../rapport';
import { isNeutralMatch, matchCompLabel, myMatchConditions, myShirt, rosterLeagues, venueKo, weekFreeDays } from '../game';
import { forecastOpen, WEATHER_HINT, WEATHER_KO, WEATHER_LINE, type WeatherKind } from '../weather';
import { refereeTraits } from '../referees';
import { compNameKo, cupNameKo, cupRoster, GROUP_LETTERS, groupTable, KO_NAMES, myCupMatches, reachLabel, stageName, uclReachLabel, type CompId, type CupTie } from '../cups';
import { ensureNational, natId, natLabel, natRoster, nationFromId } from '../national';
import { FOOT_KO } from '../body';
import { formMul, TAGS } from '../tags';
import { ENGINE } from '../engine/config';
import { SCENE_LABEL } from '../engine/moments';
import { attrDisplay, ATTRIBUTE_GROUPS, ATTRIBUTE_NAMES_KO, displayDelta, FIELD_ATTRIBUTES, GROUP_NAMES, type AttributeGroup, type FieldAttribute } from '../attributes';
import { adviceOpen, adviceText } from '../aptitude';
import { LIFE_KINDS, isForeign, isLifeKind, lifeHints, type LifeKind } from '../life';
import { awardsTodo } from './awardsVM';
import { raceRank } from '../awards';
import { BALANCE } from '../config/balance';
import { TEAM_TACTICS } from '../engine/teamData';
import { formBonus, formLevel, type FormLevel } from '../form';
import {
  activePreset, averageRating, calendarOf, campDate, campDay, careerTotals, dayPlan, isRestLocked, isTravelDay, presetWeekPlan, recommendPreset, isVacationDay, myMatchDate, nextFixture, plannedDefault, selectableRealPlayers,
  slumpThreshold, trainingLine, type GameState, type SeasonSummary,
} from '../game';
import {
  BASE_PRESETS, bundleCapped, gaugeNeed, PRESET_SLOTS, presetById, presetSummary, planFatigue, planXp, techBundle, BUNDLE_NAMES_KO, TRAINING_DESC_KO, TRAINING_KINDS, TRAINING_NAMES_KO, TRAINING_SHORT_KO,
  type DayPlan, type TrainingKind,
} from '../training';
import { addDays, dateLabel, daysBetween, weekday as weekdayOf } from '../calendar';
import { isUnlocked } from '../unlocks';
import { generatePlayer } from '../generate';
import {
  attributeOvrWeight, allPositionOvrs, PLAYABLE_POSITIONS, POSITION_NAMES_KO, positionOvr, positionOvrExact, profileOf, type FieldPosition,
  type PlayablePosition,
} from '../positions';
import {
  costTier, isMaxed, legendaryConditions, nextReputationTier, playerOvr, pointCost, raiseBlock, reputationFloorTier, reputationTier, TIER_NAMES_KO, xpToLevel, type AttributeDelta,
} from '../growth';
import type { Scene } from '../highlights';
import { SEASON_HL_KO, seasonHighlights3, type SeasonHighlight, type SeasonHighlightKind } from '../seasonHighlights';
import {
  ALL_ITEMS, primaryItems, recordLine, recordRows, type MatchLogEntry, type MatchRecord, type RecordRowVM,
} from '../matchRecord';
import { INJURY_NAMES_KO } from '../injury';
import { shownTracks } from '../records';
import { CLUB_TO_TEAM, clubKo, initialTeams, leagueOfTeam, leaguePosition, leagueTeamById, sortedTable, teamById, type LeagueState } from '../league';
import { DEFAULT_LEAGUES, leagueCatalog, leagueData } from '../../data/leagues';
import { cupBannerVM, type CupBannerVM } from './seasonVM';
import { calendarKind, normalizeLeagues, otherLeagueCalendar, otherScorers, type OtherLeague } from '../otherLeagues';
import { MLS_CONFERENCE } from '../../data/leagues/mls';
import { abroadLegends, FUTURE_STARS, futureDebut, futureEntry, LEGEND_BY_ID, legendClub, legendPeak, legendPlacement, legendRosterPlayer, selectableLegends, upcomingFutureStars, waitingFutureStars } from '../legends';
import { OUTSIDE_BY_ID } from '../../data/outsideClubs';
import { findRosterPlayer, naturalOvr } from '../roster';
import { MY_ID } from '../engine/adapter';
import { npcOvr } from '../npc';
import { isU21 } from '../squad';
import { careerNet, endingScores } from '../wealth';
import { careerKey, type LegacyStore } from '../legacy';
import { moneyLabel } from '../money';
import { AWARD_KO, awardValue, leaderboard, npcStanding, ratingMinApps, seasonAwards, type BoardKind } from '../worldStats';
import { tierLabel } from '../finance';
import { restartLabel, type Replay, type ReplayEvent, type ReplayFrame } from '../replay';
import type { SaveMeta } from '../save';
import { reportInput, tacticalReport, type TacticalReport, type Tendency } from '../tacticalReport';
import type { BadgeId, Tier } from '../types';
import { activeBadges, BADGE_DESC_KO, BADGE_NAMES_KO } from '../badges';
import { positionPenalty, proficiencyOf, proficientOvr } from '../proficiency';
import { saveStartNotice, versionLabel } from '../version';
import type { DesignTier, FeedKind, FormationSlotProps, TacticStyle } from './components';
import type { FieldAttributes } from '../attributes';
import { attrShort, coachBoost } from '../money';
import type { AttrGroupVM } from './views/attrGrid';
import { derbyOf } from '../derby';
import type { FaceRef } from './faces';
import { PROSPECT_NATIONALITY, realAppearance, rollAppearance } from '../appearance';
import { FACE_PHOTOS, isFacePhoto, isRace, PHOTO_KO, PHOTO_OF, RACE_KO, RACES, rollIdentity } from '../identity';
import { NATIONALITY_KO } from './customVM';
import { FORMATIONS } from '../formations';
import {
  customized, fitOf, formationLabel, fitScore, leagueFitAverages, previewLineup, slotPos, type Fit, type MyTactics,
} from '../myTactics';
import {
  DETAIL_NAMES_KO, DETAILS, LEVEL_NAMES_KO, recommendedRole, ROLE_OPTIONS, roleFit, roleGroup, TENDENCIES, TENDENCY_DESC_KO, TENDENCY_NAMES_KO, tendencyLevels,
  type Detail, type Level,
} from '../engine/tactics';
import { ROLE_DESC_KO, ROLE_NAMES_KO } from '../engine/roles';
export { ROLE_DESC_KO };

// ── 공통 변환 ──

/** 성장(포인트 찍기)이 아직 안 열렸으면 포인트 버튼·배너를 숨긴다 (21.3 단계적 공개, 부록 C.23) */
export function visiblePoints(g: GameState): number {
  return isUnlocked(g.guide, 'growth') ? g.player.unspentPoints : 0;
}

/** 시즌 이름 표시 방식 (C.76c): 내 리그가 3~12월 리그면 "2018", 아니면 "2018-19". 화면이 그릴 때 내 리그로 맞춘다 */
let labelKind: 'autumn-spring' | 'spring-autumn' = 'autumn-spring';
export function setSeasonLabelKind(kind: 'autumn-spring' | 'spring-autumn'): void {
  labelKind = kind;
}
export const seasonLabel = (y: number, kind: 'autumn-spring' | 'spring-autumn' = labelKind): string =>
  kind === 'spring-autumn' ? `${y}` : `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

const DESIGN_TIER: Record<Tier, DesignTier> = { normal: 'normal', special: 'key', topClass: 'top', worldClass: 'world', legendary: 'legend' };
export const designTier = (t: Tier): DesignTier => DESIGN_TIER[t];

const FORM_STEP: Record<FormLevel, 1 | 2 | 3 | 4 | 5> = { veryBad: 1, bad: 2, normal: 3, good: 4, veryGood: 5 };

const TACTIC_STYLE: Record<Tendency, TacticStyle> = {
  balanced: 'balanced', tikitaka: 'tikitaka', gegenpress: 'gegen', counter: 'counter', direct: 'direct', block: 'block',
};
export const tacticStyle = (t: Tendency): TacticStyle => TACTIC_STYLE[t];

export interface TacticVM { tactic: TacticStyle; formation: string }

/** 팀 AI 기본 전술 (E.19, 전술 화면 E3.6 전까지는 내 팀도 이것) */
export function teamTactic(teamId: string): TacticVM | undefined {
  const t = TEAM_TACTICS[teamId];
  return t ? { tactic: tacticStyle(t.tendency), formation: t.formation } : undefined;
}

export interface VersionVM { label: string; notice: string | null }

export function versionVM(g?: GameState | null): VersionVM {
  return { label: versionLabel(), notice: g ? saveStartNotice(g.startPatch) : null };
}

export interface ConditionVM {
  fatigue: number;
  form: 1 | 2 | 3 | 4 | 5;
  formLabel: string;
  yellows: number;
  yellowEvery: number;
  /** 시즌 누적 피로 (C.78t 게겐 비용, 경기 체력에서 더 빠진다). 0 이면 없음 */
  seasonFatigue?: number;
  /** 생활 힌트 (C.63 b): 숨은 생활 지표를 숫자 없이 문장으로 */
  life?: string[];
}

/**
 * 폼 효과 문구 (C.79n): 엔진 경기(기본)에서 폼은 평점에 더해지지 않고 내 선수 패스·드리블·유효 슈팅 성공 확률에
 * 폼 × formToProb 로 들어간다 (E.16). 빠른 경기(통계)에서만 평점에 그대로 더한다
 */
export function formEffectLabel(b: number, engine = true): string {
  const s = b >= 0 ? '+' : '−';
  if (!engine) return `평점 보정 ${s}${Math.abs(b).toFixed(2)}`;
  const pp = Math.round(Math.abs(b) * ENGINE.match.formToProb * 1000) / 10;
  return `성공 확률 ${s}${pp}%p`;
}

/** 내 상태 폼 줄 (C.79n): 최근 평점 폼(롤러코스터·꾸준함 배율 포함)의 엔진 효과. N경기 미만이면 n/N경기 */
export function formLine(p: GameState['player']): string {
  return p.recentRatings.length >= BALANCE.form.games ? formEffectLabel(formBonus(p.recentRatings, formMul(p))) : `${p.recentRatings.length}/${BALANCE.form.games}경기`;
}

function conditionVM(g: GameState): ConditionVM {
  const p = g.player;
  return {
    fatigue: Math.round(p.fatigue),
    ...((p.seasonFatigue ?? 0) >= 1 ? { seasonFatigue: Math.round(p.seasonFatigue!) } : {}),
    form: FORM_STEP[formLevel(p.recentRatings)],
    formLabel: formLine(p),
    yellows: p.season.yellows % BALANCE.discipline.yellowBanEvery,
    yellowEvery: BALANCE.discipline.yellowBanEvery,
    life: lifeHints(g),
  };
}

export interface PlayerCardVM {
  name: string; age: number; position: string; ovr: number; tier: DesignTier; tierScore: number; level: number; xp: number; xpMax: number; team: string;
  face: FaceRef;
}

/**
 * 내 선수 얼굴 (부록 C.43): 실제 선수면 그 선수 id(사진·페이스온 공유), 가상 유망주는 `me:<월드 시드>`.
 * 외모군·기본 사진은 생성 때 저장한다 (C.45 커스텀, C.73c 랜덤). 없으면(옛 세이브 이식 전) id 로 정한다
 */
export function myFace(g: GameState): FaceRef {
  const p = g.player;
  if (p.realPlayerId) return { id: p.realPlayerId, age: p.age, appearance: realAppearance(p.realPlayerId, '') };
  // 레전드로 시작 (C.47): 레전드 id 로 사진을 찾는다
  if (p.legendId) return { id: p.legendId, age: p.age, ...(p.appearance ? { appearance: p.appearance } : {}) };
  const id = `me:${g.worldSeed}`;
  // 커스텀 생성 (C.45): 고른 외모군·국적. 기본 사진 (C.73c): 고른 사진, 없으면 외모군 사진
  const appearance = p.appearance ?? rollAppearance(id, p.nationality ?? PROSPECT_NATIONALITY);
  return { id, age: p.age, appearance, photo: p.facePhoto ?? PHOTO_OF[appearance] };
}

function playerCardVM(g: GameState): PlayerCardVM {
  const p = g.player;
  return {
    name: p.name, age: p.age, position: p.position, ovr: playerOvr(p), tier: designTier(reputationTier(p.reputation, p.honors)), tierScore: p.reputation,
    level: p.level, xp: p.xp, xpMax: xpToLevel(p), team: teamById(g.league, p.teamId).nameKo, face: myFace(g),
  };
}

/** 부상 복귀 예정 시점 (날짜, 부록 C.38). 비시즌에 BALANCE.injury.offseasonWeeks 주만큼 회복된다 */
function returnLabel(g: GameState): string {
  const inj = g.player.injury!;
  const off = BALANCE.injury.offseasonWeeks * 7;
  let carry = inj.daysLeft - off;
  if (g.phase === 'season') {
    const cal = calendarOf(g);
    // 다친 날이면 다음 날부터 줄어든다
    const back = addDays(g.calendar.date, inj.daysLeft + (inj.date === g.calendar.date ? 1 : 0));
    if (daysBetween(back, cal.final) >= 0) return dateLabel(back);
    carry = inj.daysLeft - daysBetween(g.calendar.date, cal.final) - off;
  }
  return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 개막 ${Math.ceil(carry / 7)}주 뒤`;
}

export interface BannerVM { tone: 'injury' | 'warning' | 'info' | 'success'; title: string; body?: string; action?: string; act?: string; to?: string; /** 아이콘 칸 + 라임 낮은 면 (240B 도감) */ icon?: 'album' }

function injuryBanner(g: GameState): BannerVM | null {
  const inj = g.player.injury;
  if (!inj) {
    // 조기 복귀 뒤 재부상 위험 창 (C.74b)
    const r = g.player.reinjury;
    const left = r && g.phase === 'season' ? daysBetween(g.calendar.date, r.until) : 0;
    return r && left > 0 ? { tone: 'warning', title: `조기 복귀 · 재부상 위험 ${left}일 남음`, body: `부상 확률 ×${r.mul} (${dateLabel(r.until)}까지). 고강도 훈련은 피하는 게 좋아요.` } : null;
  }
  // 부상 복귀 선택 (C.74b): 회복 막바지
  if (inj.ret === 'ask' && g.phase === 'season') {
    return {
      tone: 'injury', title: `복귀 시점을 골라요 · ${inj.daysLeft}일 남음`,
      body: `조기 복귀하면 오늘부터 뛰지만 ${BALANCE.injuryReturn.reinjuryDays}일 동안 부상 확률 ×${BALANCE.injuryReturn.reinjuryMul}. 완전 회복은 복귀 예정 ${returnLabel(g)}.`,
      action: '고르기', act: 'inj-return-open',
    };
  }
  return {
    tone: 'injury', title: `부상 (${INJURY_NAMES_KO[inj.grade]}) · ${inj.daysLeft}일 남음`,
    body: `복귀 예정 ${returnLabel(g)}. 부상 중에는 경기에 나가지 못하고 재활(XP 주 ${BALANCE.injury.rehabXp})만 해요. 휴식으로 바꾸면 XP 대신 회복이 하루 +${BALANCE.training.restHealBonus}일 빨라요.`,
  };
}

function pointsBanner(g: GameState): BannerVM | null {
  const n = visiblePoints(g);
  return n > 0 ? { tone: 'success', title: `찍을 포인트 ${n}P`, body: '레벨업으로 얻은 포인트를 능력치에 써요.', action: '찍기', act: 'go', to: 'allocate' } : null;
}

// ── 홈 (I.3, 디자인 22·25) ──

export interface HomeVM {
  /** 머리말 왼쪽 위 ‹ 초기화면으로 (C.73d): 경기 중이 아니면 main 이 켠다 */
  exit?: boolean;
  /** 지금 챕터 이름 (22.1, C.73a): "도약 챕터" */
  chapter: string;
  /** 발롱도르 레이스 내 순위 (C.76t, 시즌 중 파워 랭킹 — 리그 8라운드 뒤, 순위 밖이면 없음) */
  race?: number;
  /** 재정 (C.68a): 고를 수 있는 코치 후보 수 (홈 재정 아이콘 배지) */
  money?: number;
  /** 안 읽은 인박스 (C.76g 디자인 197·211 머리말 알림 종 배지, main 이 채움) */
  inbox?: number;
  /** 부상 남은 날 (C.76g 디자인 228 머리말 칩 "부상 · n일 남음") */
  injuryDays?: number;
  season: string;
  round: number;
  /** 다음 경기 대회 한 줄 (C.67): "리그 12R" / "FA컵 32강" */
  comp: string;
  rounds: number;
  phase: GameState['phase'];
  banners: BannerVM[];
  next: null | {
    my: string; opp: string; home: boolean; neutral?: boolean; myRating: number; oppRating: number;
    /** 컵·챔스 경기 배지 (C.67b) */
    cup?: { label: string; comp: CompId | 'nat' };
    myTactic?: TacticVM; oppTactic?: TacticVM;
    /** 전술 화면이 열렸으면 "전술" 버튼 (21.3: 3경기 뒤) */
    tacticsOpen: boolean;
    /** 결장(부상·출장 정지)이면 경기 버튼은 "결장(관전)" */
    out: boolean;
    /** 내 선수 결정 (E.11): 직접/자동, 정지 빈도 */
    control: GameState['control'];
    /** 더비면 이름 (C.44) */
    derby: { name: string; big: boolean } | null;
    /** 날씨 예보·심판 (C.74a): 경기 forecastDays 일 전부터 공개 (open). 그 전에는 며칠 뒤 공개인지만 */
    env: EnvVM;
  };
  card: PlayerCardVM;
  condition: ConditionVM;
  stats: { apps: number; starts: number; goals: number; assists: number; avg: string };
  version: VersionVM;
  /** 캘린더 (부록 C.38): 오늘, 다음 일정, 이번 달 */
  day: DayVM | null;
  /** 남은 능력치 포인트 (C.39 홈 배지, 성장 기능이 열렸을 때만) */
  points: number;
  /** 훈련 (C.41): 오늘 훈련, 주간 계획, 게이지 */
  training: TrainingVM | null;
  /** 비시즌 휴가가 끝나는 소집일 (개막 7일 전, C.41) */
  camp: string | null;
  /** 미페 머리말 (C.57, 디자인 B 86·132): 등번호 · 소속 줄 · 포지션 */
  kit: number;
  team: string;
  /** 다음 내 경기 날짜 ("9월 22일 (토)") */
  nextDate: string | null;
  /** 1군 테스트 띠 (C.45, 디자인 132) */
  trial: TrialVM | null;
}

export interface TrialVM {
  team: string;
  /** 지금까지 치른 경기 / 필요한 경기 (연장이면 최대) */
  games: number;
  need: number;
  extended: boolean;
  avg: number | null;
  goals: number;
  assists: number;
  /** 경기 칸: 치른 경기는 평점, 다음 경기는 상대 이름만 */
  cells: { label: string; rating: number | null; next: boolean }[];
  pass: number;
  cut: number;
  maxGames: number;
}

export interface DayCellVM { d: number; date: string; today: boolean; past: boolean; kind: '' | 'home' | 'away' | 'league' | 'break'; title: string; /** C.76i (디자인 200): 생활 하루 행동 날 = 아이콘 + 두 글자 */ life?: LifeKind; lifeShort?: string; /** C.76i (디자인 216): 컵·대표팀 경기 날 = 트로피 */ cup?: boolean }

export interface DayVM {
  /** "8월 11일 (토)" */
  date: string;
  /** 큰 글씨 "8.11", "토요일" */
  short: string;
  weekdayKo: string;
  /** "8월 24일 (금)" (머리말, C.52 디자이너 버그) */
  full: string;
  year: number;
  matchDay: boolean;
  /** 다음 내 경기까지 남은 날 (오늘이면 0) */
  daysTo: number | null;
  nextLabel: string | null;
  quick: boolean;
  upcoming: { date: string; text: string; kind: 'home' | 'away' | 'break' | 'end' | 'train'; sub?: string; /** 상대 팀 (C.53: 누르면 팀 상세) */ team?: string; /** C.76i (디자인 216): 대회 칩 (컵·대표팀) */ cup?: string }[];
  month: { title: string; lead: number; days: DayCellVM[] };
}

const BREAK_KO = { international: 'A매치 휴식기', cup: '컵 주간 (리그 없음)', winter: '휴식기' } as const;

export function dayVM(g: GameState): DayVM | null {
  if (g.phase !== 'season') return null;
  const cal = calendarOf(g);
  const today = g.calendar.date;
  const me = g.player.teamId;
  const myDates = new Map<string, { home: boolean; opp: string; r: number; neutral?: boolean }>();
  const leagueDays = new Set<string>();
  g.league.schedule.forEach((round, r) => round.forEach((f, i) => {
    const d = cal.fixtureDates[r]![i]!;
    leagueDays.add(d);
    if (f.home === me || f.away === me) myDates.set(d, { home: f.home === me, opp: f.home === me ? f.away : f.home, r });
  }));
  // 컵 (C.67): 내 컵 경기 (치른 것 + 추첨된 것)
  const cupDays = new Map<string, { home: boolean; opp: string; label: string; neutral?: boolean }>();
  for (const c of myCupMatches(g)) cupDays.set(c.date, { home: c.home, opp: c.opponentId, label: c.label, neutral: isNeutralMatch({ cup: c }) });
  // 대표팀 (C.76d): 소집된 A매치 주간 경기
  for (const m of g.national?.fixtures ?? []) if (m.season === g.league.season && m.key.startsWith('w:')) cupDays.set(m.date, { home: m.home, opp: natId(m.opp), label: natLabel(m), neutral: isNeutralMatch({ nat: m }) });
  for (const [d, c] of cupDays) myDates.set(d, { home: c.home, opp: c.opp, r: -1, neutral: c.neutral });
  const breakDays = new Map<string, keyof typeof BREAK_KO>();
  for (const b of cal.breaks) for (let k = -1; k <= 0; k++) breakDays.set(addDays(b.date, k + 1), b.kind);
  const next = myMatchDate(g);
  const daysTo = next ? daysBetween(today, next) : null;
  const upcoming: DayVM['upcoming'] = [];
  // 오늘 훈련 (C.41)
  if (daysTo !== 0) {
    const k = dayPlan(g, today);
    upcoming.push({ date: dateLabel(today), text: `오늘 · ${TRAINING_NAMES_KO[k]}`, kind: 'train', sub: g.training?.overrides[today] ? '변경' : k === 'vacation' ? '휴장' : '계획' });
  }
  const brk = cal.breaks.filter((b) => daysBetween(today, b.date) >= -1);
  // 내 컵 경기가 있는 컵 주말은 휴식기로 적지 않는다
  for (const x of myUpcoming(g)) {
    if (upcoming.length >= 6) break;
    while (brk.length && daysBetween(brk[0]!.date, x.date) > 0 && upcoming.length < 6) {
      const b = brk.shift()!;
      if (!(b.kind === 'cup' && [...cupDays.keys()].some((d) => Math.abs(daysBetween(d, b.date)) <= 1))) upcoming.push({ date: dateLabel(b.date), text: BREAK_KO[b.kind], kind: 'break' });
    }
    if (upcoming.length >= 6) break;
    upcoming.push({ date: dateLabel(x.date), text: x.cup || x.nat ? teamById(g.league, x.opp).nameKo : `${x.comp} ${teamById(g.league, x.opp).nameKo}`, kind: x.home ? 'home' : 'away', sub: venueKo(x.home, x.neutral), team: x.opp, ...(x.cup || x.nat ? { cup: x.comp } : {}) });
  }
  if (upcoming.length < 6 && g.league.round >= g.league.schedule.length - 5) upcoming.push({ date: dateLabel(cal.final), text: '시즌 종료', kind: 'end' });
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const first = `${today.slice(0, 7)}-01`;
  const len = daysBetween(first, addDays(`${(m === 12 ? y + 1 : y)}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, 0));
  const days: DayCellVM[] = [];
  for (let k = 0; k < len; k++) {
    const d = addDays(first, k);
    const mine = myDates.get(d);
    const vac = !mine && daysBetween(today, d) >= 0 && isVacationDay(g, d);
    const kind: DayCellVM['kind'] = mine ? (mine.home ? 'home' : 'away') : breakDays.has(d) || vac ? 'break' : leagueDays.has(d) ? 'league' : '';
    const pk = !mine && daysBetween(today, d) >= 0 && daysBetween(d, cal.final) >= 0 ? dayPlan(g, d) : null;
    const plan = pk ? TRAINING_SHORT_KO[pk] : '';
    const title = mine ? `${mine.r < 0 ? cupDays.get(d)!.label : `${mine.r + 1}R`} ${teamById(g.league, mine.opp).nameKo} ${venueKo(mine.home, mine.neutral)}` : [breakDays.has(d) ? BREAK_KO[breakDays.get(d)!] : kind === 'league' ? '다른 팀 경기' : '', plan ? `훈련: ${plan}` : ''].filter(Boolean).join(' · ');
    days.push({ d: k + 1, date: d, today: d === today, past: daysBetween(d, today) > 0, kind, title, ...(pk && isLifeKind(pk) ? { life: pk, lifeShort: plan.slice(0, 2) } : {}), ...(mine && mine.r < 0 ? { cup: true } : {}) });
  }
  return {
    date: dateLabel(today), short: `${m}.${+today.slice(8, 10)}`, weekdayKo: `${'일월화수목금토'[weekdayOf(today)]}요일`, full: `${m}월 ${+today.slice(8, 10)}일 (${'일월화수목금토'[weekdayOf(today)]})`, year: y, matchDay: daysTo === 0, daysTo, nextLabel: next ? dateLabel(next) : null, quick: g.options?.quickOthers ?? false,
    upcoming, month: { title: `${y}년 ${m}월`, lead: weekdayOf(first), days },
  };
}

/** 바닥에 막힌 감점에 붙이는 말 (부록 C.27): "(탑클래스 티어 유지)". 막히지 않았으면 빈 문자열 */
export function floorNote(blocked: number | undefined, reputation: number): string {
  const t = blocked ? reputationFloorTier(reputation) : null;
  return t ? `(${TIER_NAMES_KO[t]} 티어 유지)` : '';
}

/** 부진 감점 한 줄 (부록 C.25, C.27): 마지막 경기에서 위상이 깎였거나 감점이 티어 하한에 막혔으면 */
export function slumpBanner(g: GameState): BannerVM | null {
  const s = g.lastMatch?.slump;
  if (!s) return null;
  const thr = (s.threshold ?? slumpThreshold(g.player)).toFixed(1);
  const kept = floorNote(s.blocked, g.player.reputation);
  return {
    tone: 'warning', title: `위상 −${s.points} ${kept || `(부진 ${s.streak}경기 연속)`}`,
    body: `최근 경기력이 평소보다 떨어졌어요(평점 ${thr} 미만 ${s.streak}경기 연속). 다음 경기에서 ${thr} 이상이면 멈춰요.`,
  };
}

/** 날씨 예보·심판 한 줄 (C.74a, 다음 경기 카드·경기 준비) */
export interface EnvVM {
  open: boolean;
  /** 공개까지 남은 날 (open 이면 0) */
  opensIn: number;
  weather?: WeatherKind;
  weatherKo?: string;
  hint?: string;
  referee?: string;
  /** 성향 이름표: "카드 엄격" · "흐름 중시" (보통이면 "카드 보통") */
  refTraits?: string[];
}

export function envVM(g: GameState): EnvVM {
  const date = myMatchDate(g);
  const cond = myMatchConditions(g);
  if (!date || !cond) return { open: false, opensIn: 0 };
  const days = daysBetween(g.calendar.date, date);
  if (!forecastOpen(days)) return { open: false, opensIn: days - BALANCE.weather.forecastDays };
  const t = refereeTraits(cond.referee);
  return {
    open: true, opensIn: 0, weather: cond.weather, weatherKo: WEATHER_KO[cond.weather], hint: WEATHER_HINT[cond.weather],
    referee: cond.referee.nameKo, refTraits: [t.card ?? '카드 보통', ...(t.flow ? [t.flow] : [])],
  };
}

export function homeVM(g: GameState): HomeVM {
  const p = g.player;
  const banners: BannerVM[] = [];
  const inj = injuryBanner(g);
  if (inj) banners.push(inj);
  let next: HomeVM['next'] = null;
  if (g.phase === 'season') {
    const fx = nextFixture(g)!;
    const my = teamById(g.league, p.teamId);
    const opp = teamById(g.league, fx.opponentId);
    if (!inj && p.suspended > 0) {
      banners.push({ tone: 'warning', title: `출장 정지 ${p.suspended}경기`, body: `${opp.nameKo}전에 나설 수 없어요. 경기가 없는 날 훈련으로 XP를 받아요.` });
    }
    next = {
      my: my.nameKo, opp: opp.nameKo, home: fx.home, neutral: isNeutralMatch(fx), myRating: my.rating, oppRating: opp.rating,
      myTactic: myTacticVM(g), oppTactic: teamTactic(opp.id), out: !!inj || p.suspended > 0,
      tacticsOpen: isUnlocked(g.guide, 'tactics'),
      control: g.control,
      derby: derbyBadge(p.teamId, opp.id),
      env: envVM(g),
      ...(fx.cup ? { cup: { label: fx.cup.comp === 'ucl' ? `챔피언스리그 · ${fx.cup.stage}` : fx.cup.label, comp: fx.cup.comp } } : {}),
      ...(fx.nat ? { cup: { label: `${natLabel(fx.nat)} · ${teamById(g.league, natId(ensureNational(g).nation)).nameKo} 대표팀`, comp: 'nat' as const } } : {}),
    };
  }
  const slump = g.phase === 'season' ? slumpBanner(g) : null;
  if (slump) banners.push(slump);
  const pts = pointsBanner(g);
  if (pts) banners.push(pts);
  const s = p.season;
  const avg = averageRating(s);
  return {
    chapter: `${CHAPTER_KO[currentChapter(g)]} 챕터`,
    ...((() => { const r = raceRank(g); return r ? { race: r } : {}; })()),
    money: g.money?.candidates.length ?? 0,
    ...(g.player.injury ? { injuryDays: g.player.injury.daysLeft } : {}),
    season: seasonLabel(g.league.season), round: Math.min(g.league.round + 1, g.league.schedule.length), rounds: g.league.schedule.length,
    comp: g.phase === 'season' ? matchCompLabel(g) : '',
    phase: g.phase, banners, next, card: playerCardVM(g), condition: conditionVM(g),
    stats: { apps: s.apps, starts: s.starts, goals: s.goals, assists: s.assists, avg: avg === null ? '-' : avg.toFixed(2) },
    version: versionVM(g),
    day: dayVM(g),
    points: visiblePoints(g),
    training: trainingVM(g),
    camp: g.phase === 'offseason' ? campLabel(g) : null,
    kit: myShirt(g),
    team: teamById(g.league, p.teamId).nameKo,
    nextDate: dayVM(g)?.upcoming.find((u) => u.kind === 'home' || u.kind === 'away')?.date ?? null,
    trial: trialVM(g),
  };
}

/** 1군 테스트 (C.45): 치른 경기 = 테스트 팀 경기 기록 중 마지막 games 개 (테스트 중에는 출전 보장) */
export function trialVM(g: GameState): TrialVM | null {
  const t = g.trial;
  if (!t) return null;
  const S = BALANCE.startClub;
  const need = t.extended ? S.trialMaxGames : S.trialGames;
  const played = g.matchLog.filter((m) => m.minutes > 0).slice(-t.games);
  const cells: TrialVM['cells'] = played.map((m) => ({ label: `${m.round}R ${teamById(g.league, m.opponentId).nameKo}`, rating: m.rating, next: false }));
  const fx = g.phase === 'season' ? nextFixture(g) : null;
  for (let i = cells.length; i < need; i++) {
    const r = Math.min(g.league.round + 1 + (i - cells.length), g.league.schedule.length);
    cells.push({ label: i === cells.length && fx ? `${r}R ${teamById(g.league, fx.opponentId).nameKo}` : `${r}R`, rating: null, next: i === played.length });
  }
  const avg = t.ratings.length ? t.ratings.reduce((a, b) => a + b, 0) / t.ratings.length : null;
  return {
    team: teamById(g.league, t.teamId).nameKo, games: t.games, need, extended: t.extended, avg, goals: t.goals, assists: t.assists,
    cells, pass: S.greatRating, cut: S.badRating, maxGames: S.trialMaxGames,
  };
}

function derbyBadge(a: string, b: string): { name: string; big: boolean } | null {
  const d = derbyOf(a, b);
  return d ? { name: d.name, big: d.big } : null;
}

// ── 자동 진행 범위 (C.44 pending 52 4번) ──

export interface AutoTargetVM {
  id: string;
  label: string;
  /** 대회가 아직 없으면 false (회색 "아직 없음", 훅) */
  available: boolean;
  /** 다음 경기: 날짜·상대, 그 전까지 자동으로 치를 경기 수, 시즌에 남은 이 종류 경기 수. iso = 멈출 날짜 (C.67) */
  next: null | { date: string; iso: string; text: string; before: number; left: number };
  /** next 가 없을 때 한 줄 (예 "FA컵 16강 탈락") */
  note?: string;
}

export interface AutoSheetVM {
  /** 남은 내 경기 수 (리그 + 추첨된 컵) */
  remaining: number;
  quick: number[];
  targets: AutoTargetVM[];
  date: string;
}

/** 남은 내 경기 (리그 + 추첨된 컵, 날짜 순, C.67) */
function myUpcoming(g: GameState): { date: string; opp: string; home: boolean; neutral?: boolean; comp: string; cup: CompId | null; nat?: boolean }[] {
  const me = g.player.teamId;
  const cal = calendarOf(g);
  const out: { date: string; opp: string; home: boolean; neutral?: boolean; comp: string; cup: CompId | null; nat?: boolean }[] = [];
  for (let r = g.league.round; r < g.league.schedule.length; r++) {
    const i = g.league.schedule[r]!.findIndex((f) => f.home === me || f.away === me);
    if (i < 0) continue;
    const f = g.league.schedule[r]![i]!;
    out.push({ date: cal.fixtureDates[r]![i]!, opp: f.home === me ? f.away : f.home, home: f.home === me, comp: `${r + 1}R`, cup: null });
  }
  if (g.phase === 'season') for (const c of myCupMatches(g)) if (c.tie.hg === undefined) out.push({ date: c.date, opp: c.opponentId, home: c.home, neutral: c.final, comp: c.label, cup: c.comp });
  // 대표팀 (C.76d): 잡힌 A매치
  if (g.phase === 'season') for (const m of g.national?.fixtures ?? []) if (m.season === g.league.season && m.gf === undefined) out.push({ date: m.date, opp: natId(m.opp), home: m.home, neutral: m.comp !== 'friendly', comp: natLabel(m), cup: null, nat: true });
  return out.sort((a, b) => daysBetween(b.date, a.date));
}

/** 자동 진행 "국가대표 A매치" (C.76d): 소집돼 잡힌 다음 A매치에서 멈춘다 */
function natTarget(g: GameState, list: ReturnType<typeof myUpcoming>): AutoTargetVM {
  const k = list.findIndex((x) => x.nat);
  const x = list[k];
  return {
    id: 'aMatch', label: '국가대표 A매치', available: true,
    next: x ? { date: dateLabel(x.date), iso: x.date, text: `${x.comp} · ${teamById(g.league, x.opp).nameKo}전 · ${venueKo(x.home, x.neutral)}`, before: k, left: list.filter((y) => y.nat).length } : null,
    ...(x ? {} : { note: '소집되면 A매치 주간 경기가 잡혀요 (발표는 휴식기 5일 전)' }),
  };
}

export function autoSheetVM(g: GameState): AutoSheetVM {
  const list = myUpcoming(g);
  const remaining = list.length;
  const derbies = list.map((x, k) => ({ ...x, k, d: derbyOf(g.player.teamId, x.opp) })).filter((x) => !x.cup && !x.nat && x.d);
  const nd = derbies[0];
  // 컵·챔스 (C.67): 날짜가 잡힌 다음 내 경기, 없으면 결과 한 줄
  const cups = g.cups?.season === g.league.season ? g.cups : null;
  const cupTarget = (id: CompId, label: string, has: boolean, reach: string): AutoTargetVM => {
    const k = list.findIndex((x) => x.cup === id);
    const x = list[k];
    return {
      id: id === 'fa' ? 'cup' : 'ucl', label, available: has,
      next: x ? { date: dateLabel(x.date), iso: x.date, text: `${x.comp} · ${teamById(g.league, x.opp).nameKo}전 · ${venueKo(x.home, x.neutral)}`, before: k, left: list.filter((y) => y.cup === id).length } : null,
      ...(x ? {} : { note: reach === '출전 안 함' ? `이번 시즌 ${label}에 나가지 않아요` : `${label} ${reach}` }),
    };
  };
  const me = g.player.teamId;
  const targets: AutoTargetVM[] = [
    {
      id: 'derby', label: '더비 매치', available: true,
      next: nd ? {
        date: dateLabel(nd.date), iso: nd.date, text: `${teamById(g.league, nd.opp).nameKo}전 · ${nd.home ? '홈' : '원정'} · ${nd.d!.name}`, before: nd.k, left: derbies.length,
      } : null,
    },
    natTarget(g, list),
    { id: 'nationsCup', label: '국가대표 토너먼트', available: false, next: null, note: '월드컵·대륙컵은 시즌이 끝난 여름에 자동으로 치러요' },
    cupTarget('ucl', '챔피언스리그', !!cups?.ucl, cups?.ucl ? uclReachLabel(g, cups.ucl, me) : ''),
    cupTarget('fa', cupNameKo(g.league.id), !!cups?.fa, cups?.fa ? reachLabel(cups.fa, me) : ''),
  ];
  return { remaining, quick: [1, 3, 5, 10].filter((n) => n < remaining), targets, date: dateLabel(g.calendar.date) };
}

// ── 훈련과 휴가 (25.3, 부록 C.41) ──

export interface TrainingDayVM {
  date: string;
  /** "토" */
  wd: string;
  /** "8.18" */
  md: string;
  kind: DayPlan;
  short: string;
  today: boolean;
  /** 그날만 바꾼 훈련 */
  changed: boolean;
  /** 경기·휴가 날·경기 다음 날(휴식 고정, C.44)은 못 바꾼다 */
  locked: boolean;
  /** 경기 다음 날 휴식 고정 */
  fixed: boolean;
  /** 원정 전날 이동일 (C.74b): 영상 분석·회복만 */
  travel: boolean;
}

export interface TrainingOptionVM { kind: TrainingKind; name: string; desc: string; xp: number; fatigue: number; planned: boolean; selected: boolean; /** 생활 하루 행동 (C.63 b) */ life?: boolean }

export interface GaugeVM { id: AttributeGroup; name: string; value: number; full: number; ups: number; max: number; capped: boolean; today: boolean; /** 코치 (C.68a) "코치 +20% · 드리블" */ coach?: string }

export interface TrainingVM {
  today: { date: string; iso: string; kind: DayPlan; name: string; desc: string; xp: number; fatigue: number; bundle: string | null; changed: boolean; locked: boolean; injured: boolean; fixed: boolean; /** 원정 전날 이동일 (C.74b) */ travel: boolean };
  week: TrainingDayVM[];
  weekXp: number;
  cap: number;
  seasonXp: number;
  gauges: GaugeVM[];
  focus: AttributeGroup | 'auto';
  seasonUps: number;
  seasonMax: number;
  hints: string[];
  eve: boolean;
  formPenalty: boolean;
  last: string | null;
  /** 휴가 중이면 휴가가 끝나는 날 (훈련 재개) */
  vacation: { until: string; days: number } | null;
  /** 훈련 프리셋 (C.52, 디자인 159) */
  presets: PresetsVM;
}

export interface PresetDayVM { wd: string; short: string; kind: DayPlan; fixed: boolean; today: boolean }
export interface PresetRowVM { id: string; name: string; desc: string; week: PresetDayVM[]; active: boolean; recommended: boolean; custom: boolean }
export interface PresetsVM {
  auto: boolean;
  /** 이번 주에 직접 고름 (그 주만 유지) */
  manual: boolean;
  activeId: string;
  activeName: string;
  /** "8.20~8.26" */
  weekLabel: string;
  rec: { id: string; name: string; chips: { label: string; tone: 'neutral' | 'warn' | 'good' }[]; line: string; applied: boolean };
  base: PresetRowVM[];
  custom: PresetRowVM[];
}

const md = (d: string) => `${+d.slice(5, 7)}.${+d.slice(8, 10)}`;

export function presetsVM(g: GameState): PresetsVM {
  const t = g.training;
  const today = g.calendar.date;
  const activeId = activePreset(g, today);
  const rec = recommendPreset(g, today);
  const row = (p: { id: string; name: string; slots: TrainingKind[]; desc?: string }, custom: boolean): PresetRowVM => {
    const week = presetWeekPlan(g, p.id, today);
    const free = week.filter((d) => !d.fixed).length;
    const sum = presetSummary(p.slots, free);
    return {
      id: p.id, name: p.name, desc: custom ? `${sum || '훈련일 없음'} · 내가 만듦` : `${p.desc} · ${sum || '이번 주 훈련일 없음'}`, custom,
      week: week.map((d) => ({ wd: '일월화수목금토'[weekdayOf(d.date)]!, short: TRAINING_SHORT_KO[d.kind], kind: d.kind, fixed: d.fixed, today: d.date === today })),
      active: p.id === activeId, recommended: p.id === rec.id,
    };
  };
  const wk = presetWeekPlan(g, activeId, today);
  const days = rec.matches.map((d) => '일월화수목금토'[weekdayOf(d)]).join('·');
  return {
    auto: t.presetAuto !== false, manual: !!t.presetManual, activeId, activeName: presetById(t, activeId).name,
    weekLabel: `${md(wk[0]!.date)}~${md(wk[6]!.date)}`,
    rec: {
      id: rec.id, name: presetById(t, rec.id).name, line: rec.line, applied: rec.id === activeId,
      chips: [
        { label: rec.matches.length ? `경기 ${rec.matches.length}번 · ${days}` : '경기 없음', tone: 'neutral' },
        { label: `체력 ${rec.condition}`, tone: rec.condition < BALANCE.training.presets.lowCondition ? 'warn' : 'neutral' },
        { label: rec.injured ? '부상 중' : '부상 없음', tone: rec.injured ? 'warn' : 'good' },
      ],
    },
    base: BASE_PRESETS.map((p) => row(p, false)),
    custom: (t.customPresets ?? []).map((p) => row(p, true)),
  };
}

/** 커스텀 프리셋 편집 시트 (새로 만들기 = id null) */
export interface PresetEditVM {
  id: string | null; name: string; slots: { kind: TrainingKind; label: string; short: string }[]; kinds: { id: TrainingKind; label: string }[];
  /** 고른 칸 (아래 종류 줄이 이 칸을 바꾼다, C.71a 디자인 167) · 이번 주 쓰는 칸 수 · 요약("3·2·2" / "약발·기술·회복") */
  sel: number; used: number; summary: { counts: string; names: string };
}

export function presetEditVM(g: GameState, id: string | null, draft?: { name: string; slots: TrainingKind[] } | null, sel = 0): PresetEditVM {
  const p = id ? g.training.customPresets?.find((x) => x.id === id) : undefined;
  const src = draft?.slots ?? p?.slots ?? presetById(g.training, activePreset(g)).slots;
  const kinds = Array.from({ length: PRESET_SLOTS }, (_, i) => src[i] ?? 'tech');
  const n = new Map<TrainingKind, number>();
  for (const k of kinds) n.set(k, (n.get(k) ?? 0) + 1);
  const top = [...n].sort((a, b) => b[1] - a[1] || kinds.indexOf(a[0]) - kinds.indexOf(b[0]));
  return {
    id: p?.id ?? null, name: draft?.name ?? p?.name ?? '',
    slots: kinds.map((k, i) => ({ kind: k, label: `${i + 1}번째`, short: TRAINING_SHORT_KO[k] })),
    kinds: TRAINING_KINDS.map((k) => ({ id: k, label: TRAINING_SHORT_KO[k] })),
    sel: Math.max(0, Math.min(PRESET_SLOTS - 1, sel)), used: Math.min(PRESET_SLOTS, weekFreeDays(g)),
    summary: { counts: top.map((x) => x[1]).join('·'), names: top.map((x) => TRAINING_SHORT_KO[x[0]]).join('·') },
  };
}

const PLAN_DESC: Record<'match' | 'vacation' | 'rehab', string> = {
  match: '경기 날에는 훈련하지 않아요.',
  vacation: `리그 휴장 · 훈련 선택 없이 쉬어요. XP 없음, 체력 하루 +${BALANCE.training.vacation.fatigue}, 폼 저하 없음.`,
  rehab: `부상 중 재활: XP 주 ${BALANCE.injury.rehabXp}, 체력 회복. 휴식으로 바꾸면 회복이 하루 +${BALANCE.training.restHealBonus}일 빨라요.`,
};

export function trainingVM(g: GameState): TrainingVM | null {
  if (g.phase !== 'season' || !g.training) return null;
  const t = g.training;
  const today = g.calendar.date;
  const kind = dayPlan(g, today);
  const T = BALANCE.training;
  const injured = !!g.player.injury;
  const week: TrainingDayVM[] = [];
  const final = calendarOf(g).final;
  for (let k = 0; k < 7; k++) {
    const d = addDays(today, k);
    if (daysBetween(d, final) < 0) break;
    const kd = dayPlan(g, d);
    week.push({
      date: d, wd: '일월화수목금토'[weekdayOf(d)]!, md: `${+d.slice(5, 7)}.${+d.slice(8, 10)}`, kind: kd, short: TRAINING_SHORT_KO[kd], today: k === 0,
      changed: !!t.overrides[d] && !isRestLocked(g, d), locked: kd === 'match' || kd === 'vacation' || isRestLocked(g, d), fixed: isRestLocked(g, d),
      travel: isTravelDay(g, d),
    });
  }
  let vacation: TrainingVM['vacation'] = null;
  if (kind === 'vacation') {
    let d = today;
    let n = 0;
    while (isVacationDay(g, d) && n < 120) { d = addDays(d, 1); n++; }
    vacation = { until: dateLabel(d), days: n };
  }
  // 코치 (C.68a): 자동 묶음·게이지 칸 수에 코치 전문 능력치 반영 (dayStep 과 같게)
  const cb = (id: AttributeGroup) => coachBoost(g, g.player, id);
  const tb = techBundle(t, g.player.position, (id) => cb(id)?.boost ?? 0);
  return {
    today: {
      date: dateLabel(today), iso: today, kind, name: TRAINING_NAMES_KO[kind], desc: kind === 'match' || kind === 'vacation' || kind === 'rehab' ? PLAN_DESC[kind] : TRAINING_DESC_KO[kind],
      xp: planXp(kind), fatigue: planFatigue(kind), bundle: kind === 'tech' ? BUNDLE_NAMES_KO[tb] : null, changed: !!t.overrides[today],
      locked: kind === 'match' || kind === 'vacation' || isRestLocked(g, today), injured, fixed: isRestLocked(g, today), travel: isTravelDay(g, today),
    },
    week, weekXp: Math.round(t.weekXp * 10) / 10, cap: T.weeklyXpCap, seasonXp: Math.round(t.season.xp),
    gauges: GROUP_NAMES.map((id) => ({
      id, name: BUNDLE_NAMES_KO[id], value: Math.floor(t.gauges[id] ?? 0), full: gaugeNeed(g.player, id, cb(id)?.target), ...(cb(id) ? { coach: `코치 +${Math.round(cb(id)!.boost * 100)}% · ${attrShort(cb(id)!.target)}` } : {}), ups: t.seasonUps[id] ?? 0, max: T.gauge.bundleSeasonMax,
      capped: bundleCapped(t, id), today: id === tb,
    })),
    focus: t.focus, seasonUps: t.season.ups, seasonMax: T.gauge.seasonMax,
    hints: [...t.hints], eve: t.eve, formPenalty: t.formPenalty > 0, last: t.last ? `${dateLabel(t.last.date)} · ${trainingLine(t.last)}` : null, vacation,
    presets: presetsVM(g),
  };
}

/** 하루 훈련 고르기 (바텀시트) */
export function trainingOptionsVM(g: GameState, date: string): { date: string; injured: boolean; travel: boolean; options: TrainingOptionVM[] } | null {
  const kind = dayPlan(g, date);
  if (kind === 'match' || kind === 'vacation' || isRestLocked(g, date)) return null;
  const injured = kind === 'rehab' || (kind === 'rest' && !!g.player.injury);
  const planned = plannedDefault(g, date);
  // 생활 하루 행동 (C.63 b, pending 47 4번): 훈련 칸에서 훈련 대신 고른다. 외국어 공부는 외국인 선수만
  const life = LIFE_KINDS.filter((k) => k !== 'language' || isForeign(g));
  // 원정 전날 이동일 (C.74b): 영상 분석·회복만
  const travel = !injured && isTravelDay(g, date);
  const kinds: TrainingKind[] = injured ? ['recovery', 'rest'] : travel ? [...BALANCE.travelDay.allowed] : [...TRAINING_KINDS, ...life];
  return {
    date: dateLabel(date), injured, travel,
    options: kinds.map((k) => injured && k === 'recovery'
      ? { kind: k, name: '재활 (기본)', desc: PLAN_DESC.rehab, xp: planXp('rehab'), fatigue: planFatigue('rehab'), planned: true, selected: kind === 'rehab' }
      : { kind: k, name: TRAINING_NAMES_KO[k], desc: TRAINING_DESC_KO[k], xp: planXp(k), fatigue: planFatigue(k), planned: !injured && k === planned, selected: kind === k, ...(isLifeKind(k) ? { life: true } : {}) }),
  };
}

/** 비시즌 휴가 (25.3 5번): 소집일 */
export function campLabel(g: GameState): string {
  const next = { ...g, league: { ...g.league, season: g.league.season + 1 } } as GameState;
  return dateLabel(addDays(campDate(next), 0));
}

// ── 선수 (I.8, 디자인 44) ──

export interface PlayerVM {
  /** 호흡 좋은 동료 상위 3 (C.74c) */
  chem: ChemMateVM[];
  /** 지금 챕터 이름 (22.1, C.73a) */
  chapter: string;
  /** 소속 팀 상세 링크 (C.53) */
  teamId: string;
  /** 미페 머리말 등번호 (C.58) */
  kit: number;
  face: FaceRef;
  name: string; position: string; positionKo: string; age: number; ovr: number; team: string;
  tier: DesignTier; tierName: string; reputation: number; repMax: number;
  next: { name: string; cut: number; from: number } | null;
  level: number; xp: number; xpMax: number; totalXp: number;
  condition: ConditionVM;
  suspended: number;
  nextOpp: string | null;
  /** 능력치 바둑판 (C.39): 이번 시즌 변화 */
  attrs: AttrGroupVM[];
  posOvrs: { pos: string; ovr: number; main: boolean; prof: number; penalty: number }[];
  badges: { id: string; name: string; desc: string; earned: string | null; progress: string }[];
  /** 레전더리 조건 목록 (8.1, 부록 C.23). 발롱도르·트레블·월드컵은 5단계 대회 전까지 잠김 */
  legendary: { label: string; met: boolean; locked: boolean }[];
  isLegendary: boolean;
  history: HistoryRowVM[];
  /** 이번 시즌 경기 목록과 합계 (부록 C.30) */
  matches: SeasonMatchesVM;
}

export interface HistoryRowVM { season: string; age: number; ovr: number; apps: number; goals: number; assists: number; avg: string; pos: number }

/** 레전드 배지 (D.4): 받은 것은 시즌, 아직이면 진행 상황 */
function badgesVM(g: GameState): PlayerVM['badges'] {
  const p = g.player;
  const B = BALANCE.badges;
  const h = p.history;
  const goals = h.reduce((t, r) => t + r.goals, 0) + p.season.goals;
  const titles = h.filter((r) => r.leaguePosition === 1).length;
  let streak = 0;
  for (let i = h.length - 1; i >= 0 && h[i]!.teamId === p.teamId; i--) streak++;
  const progress: Record<BadgeId, string> = {
    goals500: `${goals} / ${B.careerGoals}골`, titles5: `${titles} / ${B.leagueTitles}회`, oneClub10: `${streak} / ${B.sameTeamSeasons}시즌`,
    worldCup: `월드컵 우승 ${p.honors?.worldCups ?? 0}회`,
    ballonDor: `발롱도르 ${p.honors?.ballonDor ?? 0}회`,
  };
  return activeBadges().map((id) => {
    const b = (p.badges ?? []).find((x) => x.id === id);
    return { id, name: BADGE_NAMES_KO[id], desc: BADGE_DESC_KO[id], earned: b ? `${seasonLabel(b.season)} 시즌` : null, progress: progress[id] };
  });
}

/** 비시즌 주 포지션 변경 요청 (D.3): 포지션마다 숙련도와 바꾼 뒤 OVR */
export interface PositionOptionVM { pos: string; ko: string; prof: number; ovr: number; penalty: number; current: boolean }

/** 포변 조언 홈 알림 카드 (부록 C.37): 조언이 살아 있고 닫지 않았을 때 */
export function adviceCardVM(g: GameState): import('./views/home').AdviceCardVM | null {
  const a = g.player.advice;
  const day = g.phase === 'season' ? campDay(g) : 0;
  if (!a || a.dismissed || g.phase === 'retired' || !adviceOpen(g.player, g.league.season, day)) return null;
  const left = g.league.season < a.untilSeason ? a.untilDays : a.untilDays - day;
  const t = adviceText(g.player, a, left);
  return { kind: a.kind, ...t, pos: a.pos };
}

export function positionOptionsVM(g: GameState): PositionOptionVM[] {
  const p = g.player;
  return PLAYABLE_POSITIONS.map((pos) => {
    const prof = Math.floor(proficiencyOf(p, pos));
    return { pos, ko: POSITION_NAMES_KO[pos], prof, ovr: proficientOvr(p, pos), penalty: Math.round(positionPenalty(p, pos) * 10) / 10, current: pos === p.position };
  }).sort((a, b) => Number(b.current) - Number(a.current) || b.ovr - a.ovr);
}

/** 화면 표시 묶음 (C.58 디자인 93, 5-apply 확인 필요 2 = 디자인대로): 몸 다루기 · 마무리 · 패스·시야 · 수비 · 스피드 · 피지컬 · 정신.
 *  민첩성은 표시만 몸 다루기 칸에 둔다 — 훈련 게이지·성장 묶음(ATTRIBUTE_GROUPS)은 그대로 */
export const DISPLAY_GROUPS: readonly { name: string; attrs: readonly FieldAttribute[] }[] = [
  { name: '몸 다루기', attrs: ['dribbling', 'ballControl', 'agility'] },
  { name: '마무리', attrs: ATTRIBUTE_GROUPS.finishing },
  { name: '패스·시야', attrs: ATTRIBUTE_GROUPS.passing },
  { name: '수비', attrs: ATTRIBUTE_GROUPS.defending },
  { name: '스피드', attrs: ['pace', 'acceleration'] },
  { name: '피지컬', attrs: ATTRIBUTE_GROUPS.physical },
  { name: '정신', attrs: ATTRIBUTE_GROUPS.mental },
];

function historyVM(g: GameState): HistoryRowVM[] {
  return g.player.history.map((r) => ({
    season: seasonLabel(r.season), age: r.age, ovr: r.ovr, apps: r.apps, goals: r.goals, assists: r.assists,
    avg: r.apps ? (r.ratingSum / r.apps).toFixed(2) : '-', pos: r.leaguePosition,
  }));
}

/** 능력치 바둑판 (C.39): 분류별 박스. base 가 있으면 변화 = 지금 − base */
export function attrGroupsVM(attrs: FieldAttributes, keys: readonly FieldAttribute[], base?: FieldAttributes): AttrGroupVM[] {
  return DISPLAY_GROUPS.map((grp) => ({
    name: grp.name,
    cells: grp.attrs.map((a) => ({
      attr: a, label: ATTRIBUTE_NAMES_KO[a], value: attrs[a], ...(base ? { base: base[a] } : {}), key: keys.includes(a),
    })),
  }));
}

export function playerVM(g: GameState): PlayerVM {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const tier = reputationTier(p.reputation, p.honors);
  const nx = nextReputationTier(p.reputation, p.honors);
  const fx = g.phase === 'season' ? nextFixture(g) : null;
  return {
    chapter: `${CHAPTER_KO[currentChapter(g)]} 챕터`,
    face: myFace(g), kit: myShirt(g),
    name: p.name, position: p.position, positionKo: POSITION_NAMES_KO[p.position], age: p.age, ovr: playerOvr(p),
    team: teamById(g.league, p.teamId).nameKo, teamId: p.teamId,
    tier: designTier(tier), tierName: TIER_NAMES_KO[tier], reputation: p.reputation, repMax: BALANCE.reputation.max,
    next: nx ? { name: TIER_NAMES_KO[nx.tier], cut: nx.cut, from: BALANCE.reputation.tierCuts[tier] } : null,
    level: p.level, xp: p.xp, xpMax: xpToLevel(p), totalXp: p.totalXp,
    condition: conditionVM(g), suspended: p.suspended,
    nextOpp: fx ? teamById(g.league, fx.opponentId).nameKo : null,
    attrs: attrGroupsVM(p.attributes, keys, p.seasonStartAttrs),
    posOvrs: PLAYABLE_POSITIONS.map((pos) => {
      const prof = Math.floor(proficiencyOf(p, pos));
      return { pos, ovr: proficientOvr(p, pos), main: pos === p.position, prof, penalty: Math.round(positionPenalty(p, pos) * 10) / 10 };
    }),
    badges: badgesVM(g),
    chem: topChemMates(g),
    // 발롱도르·챔스·월드컵은 5단계 대회 기능이라 아직 얻을 수 없다 (위상 조건만 열림)
    legendary: legendaryConditions(p.reputation, p.honors).map((c) => ({ ...c, locked: false })),
    isLegendary: tier === 'legendary',
    history: historyVM(g),
    matches: seasonMatchesVM(g),
  };
}

// ── 포인트 찍기 (I.7) ──

export interface AllocRowVM { attr: FieldAttribute; label: string; value: number; raised: number; cost: number | null; ovrDelta: number | null; maxed: boolean; blocked: boolean; key: boolean }

export interface AllocateVM {
  points: number; position: string; startOvr: number; startExact: number; ovr: number; exact: number;
  /** 지금 레벨, 비용 구간 경계(화면 1~20 값) */
  level: number; tierName: string; cost1Max: number; cost2Max: number; coachComment: boolean;
  groups: { name: string; rows: AllocRowVM[] }[];
  /** 능력치 바둑판 (C.39): 이번 배분 변화, 누르면 [−]/[+] */
  attrs: AttrGroupVM[];
}

export function allocateVM(g: GameState, startExact: number, coachComment: boolean, snap?: FieldAttributes, raises: readonly FieldAttribute[] = []): AllocateVM {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const tier = costTier(p);
  const band = BALANCE.growth.costBands[tier];
  const vm: AllocateVM = {
    attrs: [],
    points: p.unspentPoints, position: p.position, startOvr: Math.round(startExact), startExact,
    ovr: playerOvr(p), exact: positionOvrExact(p.attributes, p.position),
    level: p.level, tierName: TIER_NAMES_KO[tier], cost1Max: attrDisplay(band.cost1Max), cost2Max: attrDisplay(band.cost2Max), coachComment,
    groups: DISPLAY_GROUPS.map((grp) => ({
      name: grp.name,
      rows: grp.attrs.map((a) => {
        const v = p.attributes[a];
        const maxed = isMaxed(v);
        const w = attributeOvrWeight(p.position, a);
        const gain = Math.min(BALANCE.growth.maxAttribute, v + BALANCE.growth.pointStep) - v;
        return {
          attr: a, label: ATTRIBUTE_NAMES_KO[a], value: v, raised: raises.filter((x) => x === a).length,
          cost: maxed ? null : pointCost(v, tier), ovrDelta: w > 0 && !maxed ? Math.round(w * gain * 10) / 10 : null,
          maxed, blocked: raiseBlock(p, a) !== null, key: keys.includes(a),
        };
      }),
    })),
  };
  // 찍기 한 번 = 화면 +1칸 (C.49): 비용 1·2·3P, 모자라면 "부족"
  vm.attrs = vm.groups.map((grp) => ({
    name: grp.name,
    cells: grp.rows.map((r) => ({
      attr: r.attr, label: r.label, value: r.value, ...(snap ? { base: snap[r.attr] } : {}), key: r.key,
      edit: {
        cost: r.cost, steps: 1, reach: r.blocked ? 0 : 1,
        ovrDelta: r.ovrDelta, maxed: r.maxed, blocked: r.blocked, short: r.blocked && !r.maxed, canLower: r.raised > 0,
      },
    })),
  }));
  return vm;
}

// ── 경기 재생 (I.4, 디자인 05·08·15·18) ──

export interface FeedVM { minute?: string; text: string; kind: FeedKind; mine: boolean; score?: string; /** 흐른 시간 (정렬용) */ e?: number }

/** 피드 종류 (디자인 FeedItem kind). 실점은 concede */
export function feedKind(x: ReplayEvent, side: 0 | 1): FeedKind {
  switch (x.type) {
    case 'goal': return x.team === side ? 'goal' : 'concede';
    case 'shot': return x.onTarget ? 'chance' : 'shot';
    case 'save': return 'save';
    case 'block': return 'shot';
    case 'card': return x.card === 'red' ? 'red' : 'yellow';
    case 'sub': return 'sub';
    case 'injury': return 'injury';
    case 'penalty': return 'penalty';
    case 'corner': return 'corner';
    case 'offside': return 'offside';
    case 'foul': return 'foul';
    case 'freeKick': return 'freekick';
    case 'kickoff': case 'halftime': case 'fulltime': return 'half';
    default: return 'normal';
  }
}

export function feedVM(r: Replay, x: ReplayEvent, myId: string | undefined): FeedVM {
  const mine = !!myId && x.players.includes(myId);
  const score = x.score ? `${x.score[0]}-${x.score[1]}` : undefined;
  const text = x.score ? x.text.replace(/ — \d+ : \d+$/, '') : x.text;
  return { e: x.e, minute: x.type === 'kickoff' || x.type === 'halftime' || x.type === 'fulltime' ? undefined : x.minute, text, kind: feedKind(x, r.side), mine, ...(score ? { score } : {}) };
}

const SCENE_NAMES: Record<Scene['kind'], string> = { goal: '골', chance: '결정적 기회', decision: '내 결정', me: '내 장면', opponent: '상대 공격', shot: '슈팅' };

/** 장면 이름 (I.19 1번: "23' 골"): 핵심 순간의 분 + 장면 종류 */
export function sceneName(r: Replay, sc: Scene): string {
  if (sc.kind === 'decision') return `${sc.minute ?? ''}' 내 결정 · ${sc.label}`;
  const ev = r.events.find((x) => x.e >= sc.key - 0.01 && (x.type === 'shot' || x.type === 'goal'));
  const kind = sc.kind === 'goal' && sc.team !== r.side ? '실점' : SCENE_NAMES[sc.kind];
  return ev ? `${ev.minute}' ${kind}` : kind;
}

export interface ReplayStaticVM {
  home: string; away: string; side: 0 | 1;
  homeTactic?: TacticVM; awayTactic?: TacticVM;
  me: { name: string; position: string } | null;
}

export function replayStaticVM(r: Replay, g: GameState): ReplayStaticVM {
  const me = r.players.find((p) => p.isMe);
  return {
    home: r.teams[0], away: r.teams[1], side: r.side,
    homeTactic: { tactic: tacticStyle(r.tactics[0].tendency), formation: r.tactics[0].formation },
    awayTactic: { tactic: tacticStyle(r.tactics[1].tendency), formation: r.tactics[1].formation },
    me: me ? { name: g.player.name, position: g.player.position } : null,
  };
}

/** 재생 중 바뀌는 값 (재생 컨트롤러가 매 프레임 읽는다) */
export interface ReplayLiveVM {
  restart: string | null;
  possession: number;
  feed: FeedVM[];
  my: { shots: number; goals: number; touches: number };
}

export function replayLiveVM(r: Replay, f: ReplayFrame, e: number, extra: FeedVM[]): ReplayLiveVM {
  const me = r.players.find((p) => p.isMe)?.id;
  const evs = r.events.filter((x) => x.e <= e);
  const teamOf = new Map(r.players.map((p) => [p.id, p.team]));
  let mine = 0;
  let total = 0;
  for (const fr of r.frames) {
    if (fr.e > e) break;
    const c = fr.carrier ? teamOf.get(fr.carrier) : undefined;
    if (c === undefined) continue;
    total++;
    if (c === 0) mine++;
  }
  const feed = evs.map((x) => feedVM(r, x, me));
  return {
    restart: restartLabel(r, f, e),
    possession: total ? Math.round((mine / total) * 100) : 50,
    feed: [...feed, ...extra],
    my: {
      shots: evs.filter((x) => x.type === 'shot' && x.players[0] === me).length,
      goals: evs.filter((x) => x.type === 'goal' && x.players[0] === me).length,
      touches: 0,
    },
  };
}

// ── 경기 후 (I.6, 디자인 38) ──

export interface MatchResultVM {
  /** 머리 줄 (부록 C.43): 우리 팀·상대 엠블럼, 내 얼굴 */
  myTeam: string; face: FaceRef;
  /** 팀 상세 링크와 득점자 (C.53): 득점자 id 'me' = 내 선수 */
  myTeamId: string; oppId: string;
  /** assistMe = 도움이 나 (C.72: "나" 칩을 도움에도) */
  goals: { minute: string; name: string; id: string | null; assist: string | null; assistMe?: boolean; mine: boolean }[];
  round: number;
  /** 대회 한 줄 (C.67): "리그 12R" / "FA컵 16강" */
  comp: string;
  opp: string; scoreLine: string; outcome: 'win' | 'draw' | 'loss'; outcomeKo: string;
  rating: number | null; appearance: string; formBonus: number;
  /** 엔진 경기였나 (C.79n): 폼 칩을 성공 확률 효과로. 빠른 경기·없음이면 평점 보정 */
  formEngine?: boolean;
  chips: string[];
  banners: BannerVM[];
  highlights: FeedVM[];
  report: (TacticalReport & { my: TacticVM; opp: TacticVM; possession: number }) | null;
  hasAvgMap: boolean;
  /** 경기 후 하이라이트 3개 (24.6, C.77o): 세이브에 남은 클립. 불러온 뒤에도 다시 볼 수 있다 */
  clips?: { kind: ClipKind; label: string; minute: string; text: string }[];
  my: { label: string; value: string }[];
  /** "전체 보기"에 펼치는 나머지 기록 (부록 C.30) */
  myMore: { label: string; value: string }[];
  xp: { gained: number; value: number; max: number; level: number; levelsGained: number };
  seasonOver: boolean;
  points: number;
  /** 내 결정 기록 (E.11, I.17 10번): 분, 장면, 고른 선택지, 확률, 결과, 평점 변화 */
  decisions: { minute: string; scene: string; choice: string; label: string; p: string; result: 'success' | 'fail' | 'neutral'; delta: string; flow: string }[];
  /** 결정 기록 줄을 누르면 그 장면 리플레이 (방금 치른 경기의 재생 데이터가 있을 때) */
  decisionReplay: boolean;
  /** 이 경기에 쓴 카드 (C.36) */
  cardUses: { text: string; result: 'success' | 'fail' | 'neutral'; /** C.70 (디자인 170): 분 · 카드 이름 · 자동 */ minute?: string; name?: string; auto?: boolean }[];
  /** 경기 환경 한 줄 (C.74a): "빗속 경기 · 심판 대니얼 후퍼". 기록 이전 경기면 null */
  env: { weather: WeatherKind; line: string; referee: string } | null;
  /** 대회 배너 (C.76j 디자인 214): 컵·챔스 경기면 하나 */
  cupBanner: CupBannerVM | null;
}

const CHOICE_KO = { safe: '안전', balanced: '균형', gamble: '도박', card: '카드', delegate: '맡김' } as const;

export function matchResultVM(g: GameState, r: Replay | null): MatchResultVM | null {
  const m = g.lastMatch;
  if (!m) return null;
  const res = m.result;
  const opp = teamById(g.league, m.opponentId).nameKo;
  const outcomeKo = res.outcome === 'win' ? '승' : res.outcome === 'loss' ? '패' : '무';
  const appearance = m.injured ? '부상으로 결장 (재활)'
    : m.suspended ? '출장 정지로 결장'
    : m.leave ? '가족 휴가로 결장'
    : res.minutes === 0 ? '결장 (벤치)' : res.started ? '선발 90분' : `교체 출전 ${res.minutes}분`;
  const chips: string[] = [];
  if (res.minutes > 0) {
    if (res.goals) chips.push(`골 ${res.goals}`);
    if (res.assists) chips.push(`도움 ${res.assists}`);
    if (res.mom) chips.push('MOM');
  }
  chips.push(appearance);
  const banners: BannerVM[] = [];
  if (m.injury) {
    const perm = Object.entries(m.injury.permanent) as [FieldAttribute, number][];
    banners.push({
      tone: 'injury', title: `부상 · ${INJURY_NAMES_KO[m.injury.grade]} ${m.injury.weeksTotal}주 결장`,
      ...(perm.length ? { body: `후유증: ${perm.map(([a, v]) => `${ATTRIBUTE_NAMES_KO[a]} ${displayDelta(v)}`).join(', ')}` } : {}),
    });
  }
  if (m.recovered) banners.push({ tone: 'success', title: '부상에서 회복했어요', body: '다음 경기부터 나설 수 있어요.' });
  // 포토카드 (C.75t): 이 경기로 새로 모은 장 수
  if (m.newPhotos) banners.push({ tone: 'info', icon: 'album', title: `새 포토카드 ${m.newPhotos}장`, body: '같은 경기에 뛴 실제 선수를 도감에 모았어요.', action: '도감 보기', act: 'go', to: 'dex' });
  // 컵 (C.67): 진출·탈락·우승 → C.76j 디자인 214 대회 배너(cupBanner, seasonVM)로 옮김
  if (m.nat) {
    const c = g.national?.career;
    banners.push({ tone: 'info', title: `${m.nat.label} · 대표팀 기록`, body: `A매치 ${c?.apps ?? 0}경기 ${c?.goals ?? 0}골. 리그 기록과 따로 쌓여요.`, action: '대표팀', act: 'go', to: 'national' });
  }
  if (m.cards?.red) banners.push({ tone: 'warning', title: '퇴장당했어요', body: '다음 경기에 나설 수 없어요.' });
  else if (g.player.suspended > 0 && g.phase === 'season') banners.push({ tone: 'warning', title: '다음 경기 출장 정지', body: `옐로카드 ${BALANCE.discipline.yellowBanEvery}장이 쌓였어요.` });
  const slump = slumpBanner(g);
  if (slump) banners.push(slump);
  if (m.levelsGained > 0) {
    // C.70 (디자인 162): "Lv n · 포인트 +n" + [찍기] (아래 [포인트 찍기] 단추 대신)
    banners.push({ tone: 'success', title: `Lv ${g.player.level} · 포인트 +${m.levelsGained * BALANCE.growth.pointsPerLevel}`, body: `찍을 포인트 ${g.player.unspentPoints}P · 지금 OVR ${playerOvr(g.player)}`, ...(visiblePoints(g) > 0 ? { action: '찍기', act: 'go', to: 'allocate' } : {}) });
  }
  const me = r?.players.find((p) => p.isMe)?.id;
  const highlights = r
    ? r.events.filter((x) => x.type === 'goal' || (x.type === 'card' && x.card === 'red') || (me && x.players[0] === me && x.type === 'shot' && x.onTarget))
      .slice(0, 6).map((x) => feedVM(r, x, me))
    : [];
  let report: MatchResultVM['report'] = null;
  if (r) {
    const side = r.side;
    const rep = tacticalReport(reportInput(r.stats, side, r.tactics[side].tendency));
    const t = (i: 0 | 1): TacticVM => ({ tactic: tacticStyle(r.tactics[i].tendency), formation: r.tactics[i].formation });
    report = { ...rep, my: t(side), opp: t(side === 0 ? 1 : 0), possession: m.engine?.possession ?? 50 };
  }
  const my: { label: string; value: string }[] = [];
  let myMore: { label: string; value: string }[] = [];
  if (m.rec && res.minutes > 0) {
    // 포지션별 6개 먼저, 나머지는 전체 보기 (D.22 4번 ①)
    const split = recordSplit(m.rec, g.player.position);
    my.push(...split.primary);
    myMore = split.more;
  } else if (m.engine?.my && res.minutes > 0) {
    // C.30 이전 세이브의 마지막 경기: 기존 6개
    const x = m.engine.my;
    my.push({ label: '패스', value: `${x.passesCompleted}/${x.passes}` }, { label: '슈팅', value: `${x.shots}` }, { label: '태클', value: `${x.tackles}` },
      { label: '인터셉트', value: `${x.interceptions}` }, { label: '드리블', value: `${x.dribbles}` }, { label: '거리', value: `${x.distance}km` });
  }
  if (m.cards) my.push({ label: m.cards.red ? '퇴장' : '경고', value: m.cards.red ? '1' : `${m.cards.yellows}` });
  const max = xpToLevel(g.player);
  const value = m.levelsGained > 0 ? g.player.xp : Math.max(0, g.player.xp - res.xp);
  // 컵 경기 (C.67): 득점 기록은 보고에 (홈 = 내 팀이 홈이면 나)
  const natMe = m.nat ? natId(ensureNational(g).nation) : null;
  const fx = m.nat ? { home: m.home ? natMe : m.opponentId, g: m.nat.g } : m.cup ? { home: m.home ? g.player.teamId : m.opponentId, g: m.cup.g } : g.league.schedule[m.round - 1]?.find((f) => f.home === g.player.teamId || f.away === g.player.teamId);
  const mySide = fx?.home === (natMe ?? g.player.teamId) ? 0 : 1;
  const who = (id: string | null): { name: string; id: string | null } | null => {
    if (!id) return null;
    if (id === MY_ID) return { name: g.player.name, id: 'me' };
    // 대표팀 경기 (C.76d): 두 대표팀 로스터에서 먼저
    const natP = natMe ? [...natRoster(g, nationFromId(natMe)).players, ...natRoster(g, nationFromId(m.opponentId)).players].find((x) => x.id === id) : undefined;
    if (natP) return { name: natP.nameKo, id: findRosterPlayer(g.rosters, id) ? id : null };
    const hit = findRosterPlayer(g.rosters, id);
    if (hit) return { name: hit.player.nameKo, id };
    const ext = m.cup ? cupRoster(g, m.opponentId).players.find((x) => x.id === id) : undefined;
    return ext ? { name: ext.nameKo, id: null } : { name: '—', id: null };
  };
  const goals = (fx?.g ?? []).map(([min, side, sc, as]) => ({ minute: `${min}'`, ...who(sc)!, assist: who(as)?.name ?? null, assistMe: as === MY_ID, mine: side === mySide }));
  return {
    myTeam: teamById(g.league, natMe ?? g.player.teamId).nameKo, face: myFace(g),
    myTeamId: natMe ?? g.player.teamId, oppId: m.opponentId, goals,
    cupBanner: cupBannerVM(g),
    env: m.cond ? { weather: m.cond.weather, line: WEATHER_LINE[m.cond.weather] ?? `${WEATHER_KO[m.cond.weather]} · 날씨 영향 없음`, referee: m.cond.referee } : null,
    round: m.round, comp: m.nat ? m.nat.label : m.cup ? `${compNameKo(m.cup.comp, g.league.id)} ${m.cup.stage}` : `리그 ${m.round}R`,
    opp, scoreLine: `${res.goalsFor}-${res.goalsAgainst}${m.nat?.pens ? ` (승부차기 ${m.nat.pens[0]}-${m.nat.pens[1]})` : ''}${m.cup?.pens ? ` (승부차기 ${m.home ? m.cup.pens[0] : m.cup.pens[1]}-${m.home ? m.cup.pens[1] : m.cup.pens[0]})` : ''}`, outcome: res.outcome, outcomeKo,
    rating: res.rating, appearance, formBonus: res.minutes > 0 ? m.formBonus : 0, ...(m.engine ? { formEngine: true } : {}), chips, banners, highlights, report,
    hasAvgMap: !!r, my, myMore,
    clips: (findClips(g.clips, m.season, m.round)?.clips ?? []).map((c) => ({ kind: c.kind, label: CLIP_KO[c.kind], minute: `${c.minute}'`, text: c.text })),
    xp: { gained: res.xp, value, max, level: g.player.level, levelsGained: m.levelsGained },
    seasonOver: g.phase !== 'season', points: visiblePoints(g),
    decisionReplay: !!r?.decisions?.length,
    cardUses: (m.cardUses ?? []).map((u) => ({ text: `${u.minute}' ${u.name}${u.auto ? ' (자동)' : ''}`, result: u.result, minute: `${u.minute}'`, name: u.name, auto: !!u.auto })),
    decisions: (m.decisions ?? []).map((d) => ({
      minute: `${d.minute}'`, scene: SCENE_LABEL[d.scene], choice: CHOICE_KO[d.choice], label: d.card ? (d.choice === 'card' ? `${d.card} · ${d.label}` : `${d.label} + 🃏 ${d.card}`) : d.label,
      p: d.p === null ? '-' : `${Math.round(d.p * 100)}%`, result: d.seen?.result ?? d.result, flow: d.seen?.flow ?? '',
      delta: `${d.delta > 0 ? '+' : d.delta < 0 ? '−' : '±'}${Math.abs(d.delta).toFixed(2)}`,
    })),
  };
}

/** 포지션별 6개 + 나머지 (부록 C.30) */
export function recordSplit(rec: MatchRecord, position: FieldPosition): { primary: RecordRowVM[]; more: RecordRowVM[] } {
  const first = primaryItems(position);
  return { primary: recordRows(rec, first), more: recordRows(rec, ALL_ITEMS.filter((i) => !first.includes(i))) };
}

// ── 시즌 경기 목록과 시즌 합계 (부록 C.30, D.22 4번 ②) ──

export interface MatchLogRowVM {
  round: number; opp: string; venue: string; score: string; outcome: 'win' | 'draw' | 'loss';
  rating: string; /** 출전·결장, 골·도움 */ head: string; /** 기록 한 줄 요약. 빠른 경기는 "기록 없음" */ line: string;
  /** 하이라이트 3줄과 결정 수 (25.4, C.41) */
  hl: string[];
  decisions: number;
  /** 리플레이 프레임이 남은 경기면 "시즌:라운드" (내 최근 5경기) */
  replay: string | null;
}

/** 리플레이 프레임이 남은 내 경기 "시즌:라운드" (화면이 채운다, C.41) */
export const replayIndex = new Set<string>();

export interface SeasonMatchesVM {
  rows: MatchLogRowVM[];
  /** 시즌 합계 (엔진 기록이 있는 출전만): 포지션별 6개 + 나머지 */
  total: { primary: RecordRowVM[]; more: RecordRowVM[] } | null;
  recApps: number;
}

function logRowVM(g: GameState, e: MatchLogEntry): MatchLogRowVM {
  const outcome = e.goalsFor > e.goalsAgainst ? 'win' : e.goalsFor < e.goalsAgainst ? 'loss' : 'draw';
  const head = e.minutes === 0
    ? e.absent === 'injured' ? '부상 결장' : e.absent === 'suspended' ? '출장 정지' : e.absent === 'leave' ? '가족 휴가' : '결장'
    : [e.started ? '선발' : `교체 ${e.minutes}분`, e.goals ? `골 ${e.goals}` : '', e.assists ? `도움 ${e.assists}` : '', e.mom ? 'MOM' : '']
      .filter(Boolean).join(' · ');
  return {
    round: e.round, opp: teamById(g.league, e.opponentId).nameKo, venue: e.home ? '홈' : '원정', score: `${e.goalsFor}-${e.goalsAgainst}`, outcome,
    rating: e.rating === null ? '-' : e.rating.toFixed(1), head,
    line: e.minutes === 0 ? '' : e.rec ? recordLine(e.rec, e.position) : '기록 없음',
    hl: e.hl ?? [], decisions: e.dec?.length ?? 0,
    replay: replayIndex.has(`${g.league.season}:${e.round}`) && g.phase === 'season' ? `${g.league.season}:${e.round}` : null,
  };
}

export function seasonMatchesVM(g: GameState): SeasonMatchesVM {
  const st = g.phase === 'season' ? g.player.season : g.player.history.at(-1) ?? g.player.season;
  const recApps = st.recApps ?? 0;
  return {
    rows: (g.matchLog ?? []).map((e) => logRowVM(g, e)).reverse(),
    total: st.rec && recApps > 0 ? recordSplit(st.rec, g.player.position) : null,
    recApps,
  };
}

// ── 월드: 순위표 · 리그 기록 · 리그 스타 (I.10 일부, 18.5 · C.64) ──

export type StarGroup = 'league' | 'world' | 'young';
export interface StarVM { id: string; face: FaceRef; name: string; position: string; age: number; club: string; ovr: number; change: number | null; standing: number; ga: string }

export interface WorldVM {
  league: string; season: string; round: number; rounds: number; myPos: number; teams: number;
  table: { pos: number; team: string; teamId: string; played: number; won: number; drawn: number; lost: number; gd: string; points: number; me: boolean; rating: number; tier: string }[];
  /** 리그 스타 (C.64 묶음 탭, 디자인 147): 리그 안 = 리그 팀 선수 위상 순 · 세계 = 리그 밖 실제 선수 OVR 순 · 21세 이하 = 리그 팀 21세 이하 OVR 순 */
  stars: StarVM[];
  starsWorld: StarVM[];
  starsYoung: StarVM[];
  /** 레전드 팩 선수 (C.47): 리그 팀에 있는 레전드, OVR 순 */
  legends: { id: string; face: FaceRef; name: string; position: string; age: number; club: string; ovr: number; peak: number; kind: string }[];
  /** 미래 스타 등장 예정 (C.75y): 구현 리그 첫 시즌 순 · 리그가 없어 기다리는 수 */
  upcoming: { name: string; debut: string }[];
  waiting: number;
  /** 레전드 팩 3판 (C.75w): 팀당 상한을 넘쳐 리그 밖에서 기다리는 레전드 (들어오는 시즌 순) */
  abroad: { name: string; club: string; season: string }[];
  retired: string[];
  /** 득점 순위 (부록 C.38): 모든 경기의 선수 기록 합계에서 */
  scorers: ScorerVM[];
  /** 리그 기록 순위 (C.64): 득점 · 도움 · 평점(자격 출전 ratingMin 이상) */
  boards: Record<BoardKind, ScorerVM[]>;
  ratingMin: number;
  /** 리그 고르기 (C.76c, 45b): 내 리그('') + 고른 다른 리그. 다른 리그가 없으면 빈 목록 */
  leagueTabs: { id: string; label: string }[];
  /** 지금 보는 리그 ('' = 내 리그) */
  leagueSel: string;
  /** 고른 다른 리그 순위·득점 (leagueSel 이 다른 리그일 때) */
  other: OtherLeagueVM | null;
  /** 컨퍼런스 순위 (MLS, C.76c): 내 리그가 컨퍼런스 리그면 묶음별 순위 */
  groups: TableGroupVM[] | null;
}

export type WorldRowVM = WorldVM['table'][number];
export interface TableGroupVM { title: string; rows: WorldRowVM[] }

/** 다른 리그 보기 (C.76c): 빠른 시뮬 순위·득점 순위·지난 시즌 */
export interface OtherLeagueVM {
  id: string; name: string; sub: string; season: string; round: number; rounds: number;
  /** 한 줄 상태: "개막 전 · 3월 3일 개막" / "12R / 33" / "시즌 종료 · 우승 ○○" */
  status: string;
  table: WorldRowVM[];
  groups: TableGroupVM[] | null;
  scorers: { id: string; name: string; teamId: string; team: string; goals: number; assists: number; apps: number | null; avg: string }[];
  /** 엔진 기록이 있는가 (출전·평점 열, 45b b) */
  engine: boolean;
  /** 지난 시즌 (우승 · 득점왕) */
  last: { season: string; champion: string; scorer: string } | null;
}

/** 컨퍼런스 (MLS 동·서부): 리그 id → 팀 id → 묶음 이름. 없으면 단일 순위 */
function conferenceOf(leagueId: string): Readonly<Record<string, string>> | null {
  return leagueId === 'mls' ? Object.fromEntries(Object.entries(MLS_CONFERENCE).map(([id, c]) => [id, c === 'east' ? '동부 컨퍼런스' : '서부 컨퍼런스'])) : null;
}

/** 순위 줄을 컨퍼런스별로 (순위 = 컨퍼런스 안 순위) */
function tableGroups(leagueId: string, rows: WorldRowVM[]): TableGroupVM[] | null {
  const conf = conferenceOf(leagueId);
  if (!conf) return null;
  const titles = [...new Set(Object.values(conf))];
  return titles.map((title) => ({ title, rows: rows.filter((r) => conf[r.teamId] === title).map((r, i) => ({ ...r, pos: i + 1 })) }));
}

function leagueRows(lg: LeagueState, me: string | null): WorldRowVM[] {
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return sortedTable(lg).map((r, i) => ({
    pos: i + 1, team: teamById(lg, r.teamId).nameKo, teamId: r.teamId, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
    gd: signed(r.gf - r.ga), points: r.points, me: r.teamId === me, rating: teamById(lg, r.teamId).rating, tier: tierLabel(r.teamId),
  }));
}

export function otherLeagueVM(g: GameState, lg: OtherLeague): OtherLeagueVM {
  const d = leagueData(lg.id);
  const months = { 'autumn-spring': '8월~5월', 'spring-autumn': '3월~12월' } as const;
  const rows = leagueRows(lg, null);
  const played = lg.table.reduce((t, r) => t + r.played, 0);
  const done = lg.round >= lg.schedule.length;
  const champ = done ? rows[0]?.team : undefined;
  const status = done ? `시즌 종료 · 우승 ${champ}` : played === 0 ? `개막 전 · ${dateLabel(otherLeagueCalendar(g.worldSeed, lg).opening)} 개막` : `${Math.min(lg.round + 1, lg.schedule.length)}R / ${lg.schedule.length}`;
  const last = lg.past?.at(-1);
  return {
    id: lg.id, name: d?.nameKo ?? lg.name, sub: d ? `${d.country === 'United States' ? '미국' : d.nameKo} · ${d.tier}부 · ${lg.teams.length}팀 · ${months[calendarKind(lg)]}` : '',
    season: seasonLabel(lg.season, calendarKind(lg)), round: lg.round, rounds: lg.schedule.length, status, table: rows, groups: tableGroups(lg.id, rows),
    scorers: otherScorers(lg, 20).map(([id, name, teamId, goals, assists]) => {
      const st = lg.stats?.[id];
      const apps = st?.[2] ?? null;
      return { id, name, teamId, team: teamId ? teamById(lg, teamId).nameKo : '', goals, assists, apps, avg: apps ? ((st![3] ?? 0) / apps / 10).toFixed(2) : '-' };
    }),
    engine: Object.values(lg.stats ?? {}).some((s) => s[2] !== undefined),
    last: last ? {
      season: seasonLabel(last.season, last.season === lg.season - 1 && lg.legacyCal ? 'spring-autumn' : 'autumn-spring'), champion: last.top[0] ? teamById(lg, last.top[0]).nameKo : '—',
      scorer: last.scorer ? `${last.scorer[0]}(${teamById(lg, last.scorer[1]).nameKo}) ${last.scorer[2]}골` : '',
    } : null,
  };
}

export interface ScorerVM { id: string; teamId?: string; face: FaceRef; name: string; team: string; apps: number; goals: number; assists: number; avg: string; me: boolean; rank?: number }

/** 리그 선수 얼굴 (id → 얼굴) */
function rosterFaces(g: GameState): Map<string, FaceRef> {
  const m = new Map<string, FaceRef>();
  for (const r of Object.values(g.rosters ?? {})) for (const p of r.players) m.set(p.id, { id: p.id, age: p.age, appearance: p.appearance });
  return m;
}

/** 리그 기록 순위 줄 (내 선수는 player.season 에서). 리그를 떠난 선수는 시즌 기록에 저장한 이름·팀 (C.62) */
export function boardVM(g: GameState, kind: BoardKind, limit?: number, faces = rosterFaces(g)): ScorerVM[] {
  return leaderboard(g, kind, limit).map((r) => ({
    id: r.id, ...(r.teamId ? { teamId: r.teamId } : {}), face: r.me ? myFace(g) : faces.get(r.id) ?? { id: r.id },
    name: r.name, team: g.league.teams.find((t) => t.id === r.teamId)?.nameKo ?? '', apps: r.apps, goals: r.goals, assists: r.assists,
    avg: r.apps ? r.avg.toFixed(2) : '-', me: r.me, rank: r.rank,
  }));
}

/** 득점 순위 (골 → 도움 → 출전 적은 순) */
export function scorersVM(g: GameState, limit = 15): ScorerVM[] {
  return boardVM(g, 'goals', limit);
}

const STAR_MAX = 40;

export function worldVM(g: GameState, leagueSel = ''): WorldVM {
  const rows = sortedTable(g.league);
  const others = g.otherLeagues ?? [];
  const otherLg = leagueSel ? others.find((o) => o.id === leagueSel) : undefined;
  const myRows = leagueRows(g.league, g.player.teamId);
  const faces = rosterFaces(g);
  const npcById = new Map(g.npcs.map((n) => [n.id, n]));
  const stats = g.playerStats ?? {};
  const ga = (id: string) => { const t = stats[id]; return t && t[1] + t[2] > 0 ? `${t[1]}골 ${t[2]}도움` : ''; };
  const inLeague: StarVM[] = [];
  for (const [teamId, r] of Object.entries(g.rosters ?? {})) {
    const club = teamById(g.league, teamId)?.nameKo ?? teamId;
    for (const p of r.players) {
      if (p.legend) continue;
      const ovr = naturalOvr(p);
      const npc = npcById.get(p.id);
      inLeague.push({ id: p.id, face: faces.get(p.id)!, name: p.nameKo, position: p.position, age: p.age, club, ovr, change: npc ? npc.lastChange : null, standing: 0, ga: ga(p.id) });
    }
  }
  // 위상 계산은 비싸서(시즌 기록·수상) OVR 상위 몇 배만 계산한다
  const byOvr = [...inLeague].sort((a, b) => b.ovr - a.ovr || (a.id < b.id ? -1 : 1));
  const top = byOvr.slice(0, STAR_MAX * 2);
  for (const s of top) s.standing = npcStanding(g, s.id, s.ovr);
  const leagueIds = new Set(inLeague.map((s) => s.id));
  return {
    league: g.league.name, season: seasonLabel(g.league.season), round: g.league.round, rounds: g.league.schedule.length,
    myPos: leaguePosition(g.league, g.player.teamId), teams: rows.length,
    table: myRows,
    stars: top.sort((a, b) => b.standing - a.standing || b.ovr - a.ovr || (a.id < b.id ? -1 : 1)).slice(0, STAR_MAX),
    starsWorld: g.npcs.filter((n) => !n.retired && !leagueIds.has(n.id)).sort((a, b) => npcOvr(b) - npcOvr(a)).slice(0, STAR_MAX)
      .map((n) => ({ id: n.id, face: { id: n.id, age: n.age, appearance: realAppearance(n.id, '') }, name: n.nameKo, position: n.position, age: n.age, club: clubKo(n.club), ovr: npcOvr(n), change: n.lastChange, standing: 0, ga: '' })),
    starsYoung: byOvr.filter((s) => isU21(s.age)).slice(0, STAR_MAX),
    retired: g.npcs.filter((n) => n.retired).map((n) => n.nameKo),
    legends: Object.entries(g.rosters ?? {}).flatMap(([teamId, r]) => r.players.filter((p) => p.legend).map((p) => ({
      id: p.id, face: { id: p.id, age: p.age, appearance: p.appearance }, name: p.nameKo, position: p.position, age: p.age,
      club: teamById(g.league, teamId).nameKo, ovr: naturalOvr(p), peak: p.peakOvr,
      kind: (({ bvb: '도르트문트', future: '미래 스타' }) as Record<string, string>)[LEGEND_BY_ID.get(p.id)?.group ?? ''] ?? '레전드',
    }))).sort((a, b) => b.ovr - a.ovr || b.peak - a.peak),
    upcoming: g.futureStars ? upcomingFutureStars(g.league.season, rosterLeagues(g)).map((l) => {
      const e = futureEntry(l, rosterLeagues(g));
      const where = e && e.league !== g.league.id ? ` (${clubKoOf(e.team)})` : '';
      return { name: `${l.nameKo}${where}`, debut: seasonLabel(futureDebut(l, rosterLeagues(g))!) };
    }) : [],
    waiting: g.futureStars ? waitingFutureStars(rosterLeagues(g)).length : 0,
    abroad: g.legends && (g.legendPack ?? 1) >= 3
      ? abroadLegends(g.worldSeed, g.league.season, g.player.legendId, g.league.id).map((a) => ({ name: a.legend.nameKo, club: OUTSIDE_BY_ID[a.club]?.nameKo ?? a.club, season: seasonLabel(a.season) }))
      : [],
    scorers: boardVM(g, 'goals', undefined, faces),
    boards: { goals: boardVM(g, 'goals', undefined, faces), assists: boardVM(g, 'assists', undefined, faces), rating: boardVM(g, 'rating', undefined, faces) },
    ratingMin: ratingMinApps(g),
    leagueTabs: others.length ? [{ id: '', label: `${leagueData(g.league.id)?.nameKo ?? g.league.name} · 내 리그` }, ...others.map((o) => ({ id: o.id, label: leagueData(o.id)?.nameKo ?? o.name }))] : [],
    leagueSel: otherLg ? otherLg.id : '',
    other: otherLg ? otherLeagueVM(g, otherLg) : null,
    groups: tableGroups(g.league.id, myRows),
  };
}

/** 팀 id → 한글 이름 (리그 팀·리그 밖 클럽) */
function clubKoOf(id: string): string {
  return OUTSIDE_BY_ID[id]?.nameKo ?? leagueTeamById(id)?.nameKo ?? id;
}

// ── 시즌 종료 (I.13 일부) ──

export interface DeltaVM { label: string; value: number }

const deltas = (d: AttributeDelta): DeltaVM[] =>
  (Object.entries(d) as [FieldAttribute, number][]).map(([a, v]) => ({ label: ATTRIBUTE_NAMES_KO[a], value: v }));

export interface SeasonVM {
  season: string; nextSeason: string; team: string; pos: number; apps: number; goals: number; assists: number; avg: string;
  injuries: number; injuredWeeks: number;
  achievements: { label: string; xp: number }[]; achievementXp: number; levelsGained: number;
  /** 시즌 목표 결과 (C.65). 옛 세이브 요약이면 null. cardPicks = 지금 받을 카드 선택권 수 */
  seasonGoals: { rows: { ok: boolean; source: string; tierKo: string; label: string; value: string; xp: number; trust: number }[]; awards: string[]; xp: number; picks: number } | null;
  cardPicks: number;
  /** 개인 시상 (C.76n): 발표 상황 한 줄 (시상이 없으면 null) */
  awardsLine: string | null;
  repBefore: number; repAfter: number; tierName: string; tier: DesignTier;
  /** 위상 내역 (부록 C.25): 시즌 중 부진 감점, 시즌 끝 순위 감점. 감점이 없으면 null */
  slumpPenalty: number; rankPenalty: { expected: number; pos: number; points: number } | null; badgeRep: number;
  /** 티어 하한 (부록 C.27): 위상 내역 줄(바닥에 막힌 감점은 "(○○ 티어 유지)"), 이번 시즌 처음 닿은 하한 티어 */
  repLines: { label: string; points: number; note: string }[];
  tierReached: string | null;
  next: { name: string; cut: number; from: number } | null;
  position: string; ovrBefore: number; ovrAfter: number;
  autoGrowth: DeltaVM[]; veteran: DeltaVM[]; aging: DeltaVM[];
  growthAges: string; ageFrom: number; ageTo: number;
  retired: boolean; forcedRetire: boolean; canRetire: boolean; points: number;
  /** 이번 시즌으로 끝난 챕터 이름 (챕터 리뷰를 아직 안 봤으면, C.73a) */
  chapter: string | null;
  injury: BannerVM | null;
  badges: { name: string; desc: string }[];
  /** 시즌 경기 목록과 합계 (부록 C.30) */
  matches: SeasonMatchesVM;
  /** 시즌 하이라이트 3 (22.2 끝, C.73b): 최고 평점 경기 · 골 · 위기 (해당 없으면 빠짐) */
  highlights: { kind: SeasonHighlightKind; label: string; text: string; card?: SeasonHighlight['card'] }[];
  /** 요약 카드 (C.44): MOM, 레벨 변화(시즌 시작 레벨을 모르면 null), 위상 티어 */
  moms: number; levelFrom: number | null; levelTo: number;
  /** 상세 보기 (C.44): 월별·포지션별 기록, 리그 시상 */
  months: SplitRowVM[];
  positions: SplitRowVM[];
  awards: { title: string; name: string; team: string; value: string; me: boolean }[];
}

/** 월별·포지션별 한 줄 */
export interface SplitRowVM { label: string; apps: number; goals: number; assists: number; avg: string; w: number; d: number; l: number }

/** 시즌 위상 내역 줄 (부록 C.25, C.27): 감점이 있거나 바닥에 막혔을 때만 */
function seasonRepLines(s: SeasonSummary): SeasonVM['repLines'] {
  const rep = s.reputationAfter;
  const out: SeasonVM['repLines'] = [];
  const add = (label: string, points: number, blocked: number | undefined): void => {
    if (points > 0 || (blocked ?? 0) > 0) out.push({ label, points, note: floorNote(blocked, rep) });
  };
  add('시즌 중 부진 감점', s.slumpPenalty ?? 0, s.slumpBlocked);
  if (s.decayBlocked) add(`시즌 감소 ${Math.round(BALANCE.reputation.seasonDecay * 100)}%`, 0, s.decayBlocked);
  if (s.rankPenalty) add(`순위 감점 (예상 ${s.rankPenalty.expected}위 → ${s.rankPenalty.pos}위)`, s.rankPenalty.points, s.rankPenalty.blocked);
  if (s.redPenalty) add(`레드카드 감점 (퇴장 ${s.redPenalty.reds}회)`, s.redPenalty.points, s.redPenalty.blocked);
  if (s.minutesPenalty) add(`출전 시간 부족 감점 (출전 ${Math.round(s.minutesPenalty.share * 100)}%)`, s.minutesPenalty.points, s.minutesPenalty.blocked);
  if (s.benchPenalty) add(`벤치 장기화 감점 (${BALANCE.reputation.benchStreak.seasons}시즌 연속 출전 ${Math.round(BALANCE.reputation.benchStreak.maxShare * 100)}% 미만)`, s.benchPenalty.points, s.benchPenalty.blocked);
  return out;
}

export function seasonVM(g: GameState): SeasonVM | null {
  const s = g.lastSeasonSummary;
  if (!s) return null;
  const rec = g.player.history.at(-1)!;
  const tier = reputationTier(s.reputationAfter, g.player.honors);
  const nx = nextReputationTier(s.reputationAfter, g.player.honors);
  const A = BALANCE.growth.autoGrowth;
  return {
    season: seasonLabel(s.season), nextSeason: seasonLabel(s.season + 1), team: teamById(g.league, rec.teamId).nameKo, pos: s.leaguePosition,
    apps: rec.apps, goals: rec.goals, assists: rec.assists, avg: rec.apps ? (rec.ratingSum / rec.apps).toFixed(2) : '-',
    injuries: rec.injuries, injuredWeeks: rec.injuredWeeks,
    achievements: s.achievements, achievementXp: s.achievementXp, levelsGained: s.levelsGained,
    seasonGoals: s.goals ? {
      rows: s.goals.results.map((r) => ({ ok: r.met, source: SOURCE_KO[r.source], tierKo: TIER_KO[r.tier], label: goalLabel(r), value: valueLabel(r.kind, r.value), xp: r.xp, trust: r.trust })),
      awards: s.goals.awards, xp: s.goals.xp, picks: s.goals.results.filter((r) => r.met).length + s.goals.awards.length,
    } : null,
    cardPicks: g.cards?.picks.length ?? 0,
    awardsLine: awardsTodo(g, s.season),
    repBefore: s.reputationBefore, repAfter: s.reputationAfter, tierName: TIER_NAMES_KO[tier], tier: designTier(tier),
    slumpPenalty: s.slumpPenalty ?? 0, rankPenalty: s.rankPenalty && s.rankPenalty.points > 0 ? s.rankPenalty : null,
    repLines: seasonRepLines(s),
    tierReached: s.tierReached ? TIER_NAMES_KO[s.tierReached] : null,
    badgeRep: BALANCE.badges.reputation,
    next: nx ? { name: TIER_NAMES_KO[nx.tier], cut: nx.cut, from: BALANCE.reputation.tierCuts[tier] } : null,
    position: g.player.position, ovrBefore: s.ovrBefore, ovrAfter: s.ovrAfter,
    autoGrowth: deltas(s.autoGrowth), veteran: deltas(s.veteranGrowth ?? {}), aging: deltas(s.aging),
    growthAges: `${A.minAge}~${A.maxAge}세`, ageFrom: s.age, ageTo: g.player.age,
    retired: g.phase === 'retired', forcedRetire: s.forcedRetire, canRetire: s.canRetire, points: visiblePoints(g),
    chapter: (() => { const c = pendingChapterReview(g); return c ? CHAPTER_KO[c.id] : null; })(),
    injury: g.phase === 'offseason' ? injuryBanner(g) : null,
    badges: (s.badges ?? []).map((b) => ({ name: BADGE_NAMES_KO[b.id], desc: BADGE_DESC_KO[b.id] })),
    matches: seasonMatchesVM(g),
    highlights: seasonHighlights3(g.matchLog ?? [], (id) => teamById(g.league, id).nameKo).map((h) => ({ kind: h.kind, label: SEASON_HL_KO[h.kind], text: h.text, ...(h.card ? { card: h.card } : {}) })),
    moms: rec.moms ?? 0,
    levelFrom: rec.startLevel ?? (g.player.history.length === 1 ? 0 : null), levelTo: g.player.level,
    ...seasonSplits(g),
    awards: seasonAwardsVM(g),
  };
}

/** 월별·포지션별 기록 (C.44): 이번 시즌 경기 목록에서. 결장 경기는 출전에 세지 않고 승무패에만 */
function seasonSplits(g: GameState): { months: SplitRowVM[]; positions: SplitRowVM[] } {
  const cal = calendarOf(g);
  const months = new Map<string, MatchLogEntry[]>();
  const positions = new Map<string, MatchLogEntry[]>();
  for (const e of g.matchLog ?? []) {
    const i = g.league.schedule[e.round - 1]?.findIndex((f) => (e.home ? f.away : f.home) === e.opponentId) ?? -1;
    const date = i >= 0 ? cal.fixtureDates[e.round - 1]?.[i] : undefined;
    const mk = date ? `${+date.slice(0, 4)}.${date.slice(5, 7)}` : '-';
    months.set(mk, [...(months.get(mk) ?? []), e]);
    if (e.minutes > 0) positions.set(e.position, [...(positions.get(e.position) ?? []), e]);
  }
  const row = (label: string, xs: MatchLogEntry[]): SplitRowVM => {
    const played = xs.filter((e) => e.minutes > 0);
    const rated = played.filter((e) => e.rating !== null);
    return {
      label, apps: played.length, goals: played.reduce((t, e) => t + e.goals, 0), assists: played.reduce((t, e) => t + e.assists, 0),
      avg: rated.length ? (rated.reduce((t, e) => t + e.rating!, 0) / rated.length).toFixed(2) : '-',
      w: xs.filter((e) => e.goalsFor > e.goalsAgainst).length, d: xs.filter((e) => e.goalsFor === e.goalsAgainst).length, l: xs.filter((e) => e.goalsFor < e.goalsAgainst).length,
    };
  };
  return {
    months: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, xs]) => row(k === '-' ? '-' : `${+k.slice(5)}월`, xs)),
    positions: [...positions.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, xs]) => row(k, xs)),
  };
}

/** 리그 시상 (C.44, C.64 영플레이어 추가): 우승 팀 + worldStats.seasonAwards. 다른 경기를 빠른 진행으로 계산했으면 선수 기록이 내 경기만 남는다 */
function seasonAwardsVM(g: GameState): SeasonVM['awards'] {
  const champ = sortedTable(g.league)[0];
  const out: SeasonVM['awards'] = [];
  if (champ) out.push({ title: '리그 우승', name: teamById(g.league, champ.teamId).nameKo, team: `승점 ${champ.points}`, value: '', me: champ.teamId === g.player.teamId });
  for (const a of seasonAwards(g)) {
    out.push({ title: AWARD_KO[a.kind], name: a.name, team: g.league.teams.find((t) => t.id === a.teamId)?.nameKo ?? '', value: awardValue(a), me: a.me });
  }
  return out;
}

// ── 은퇴 (I.14 일부) ──

export interface RetiredVM {
  card: PlayerCardVM; seasons: number; apps: number; goals: number; assists: number; avg: string; peakOvr: number; best: string;
  reputation: number; tierName: string; history: HistoryRowVM[];
  /** 엔딩 점수 (C.68b, 19.8 · 19.11): 순자산 · 자산 점수 · 누적 기부 · 자선가 */
  ending: { worth: string; asset: number; charity: string; philanthropist: boolean; career: string };
  /** 업적 · 배지 (18.11, C.73b): 트로피(챕터 기록) · 레전드 배지 */
  honors: { label: string; badge: boolean }[];
  /** 명예의 전당 (18.11, C.73b): 이 기기 상위 3, 이번 커리어 순위, 예약된 새 게임 보너스 등급. 저장소를 못 읽으면 null */
  hall: { list: { name: string; line: string; score: number; me: boolean; /** C.76j (디자인 225): 위상 · 배지 · 트로피 칩 */ chips?: string[] }[]; rank: number | null; bonus: string | null } | null;
}

export const RARITY_KO: Record<string, string> = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' };

export function retiredVM(g: GameState, legacy: { rank: number | null; legacy: LegacyStore } | null = null): RetiredVM {
  const t = careerTotals(g.player);
  const e = endingScores(g);
  const key = careerKey(g);
  const trophies = (g.chapters?.list ?? []).flatMap((c) => c.trophies);
  const honors = [
    ...trophies.map((x) => ({ label: x, badge: false })),
    ...(g.player.badges ?? []).map((b) => ({ label: `${b.season} 레전드 배지 · ${BADGE_NAMES_KO[b.id] ?? b.id}`, badge: true })),
  ];
  const hall = legacy ? {
    list: legacy.legacy.hall.map((h) => ({
      name: `${h.name} · ${h.position}`, score: h.score, me: h.key === key,
      chips: [`${TIER_NAMES_KO[h.tier]} ${h.reputation}`, ...(h.badges ? [`레전드 배지 ${h.badges}`] : []), ...(h.trophies ? [`트로피 ${h.trophies}`] : [])],
      line: `${h.seasons}시즌 · ${h.apps}경기 ${h.goals}골 ${h.assists}도움 · 최고 OVR ${h.peakOvr} · ${TIER_NAMES_KO[h.tier]} ${h.reputation}${h.badges ? ` · 배지 ${h.badges}` : ''}${h.trophies ? ` · 트로피 ${h.trophies}` : ''}`,
    })),
    rank: legacy.rank, bonus: legacy.legacy.bonus?.key === key ? RARITY_KO[legacy.legacy.bonus.rarity] ?? legacy.legacy.bonus.rarity : null,
  } : null;
  return {
    honors, hall,
    ending: { worth: moneyLabel(e.worth), asset: e.asset, charity: moneyLabel(e.charity), philanthropist: e.philanthropist, career: moneyLabel(careerNet(g), true) },
    card: playerCardVM(g), seasons: t.seasons, apps: t.apps, goals: t.goals, assists: t.assists,
    avg: t.avgRating === null ? '-' : t.avgRating.toFixed(2), peakOvr: t.peakOvr, best: t.bestFinish === null ? '-' : `${t.bestFinish}위`,
    reputation: g.player.reputation, tierName: TIER_NAMES_KO[reputationTier(g.player.reputation, g.player.honors)], history: historyVM(g),
  };
}

// ── 챕터 리뷰 (22.1 · I.13, C.73a, 디자인 없음) ──

export interface ChapterReviewVM {
  id: ChapterId; name: string; theme: string; years: string; ages: string; seasons: number;
  apps: number; goals: number; assists: number; avg: string; moms: number;
  ovrFrom: number; ovrTo: number; repFrom: number; repTo: number; tierFrom: string; tierTo: string; tier: DesignTier;
  highlights: { season: string; text: string }[];
  badges: string[]; trophies: string[];
  /** 챕터 끝 카드 선택권 이름 */
  pick: string | null;
  /** 다음 챕터 이름 (은퇴면 null) */
  next: string | null;
  retired: boolean;
}

export function chapterReviewVM(g: GameState): ChapterReviewVM | null {
  const c = pendingChapterReview(g);
  if (!c) return null;
  const retired = g.phase === 'retired';
  const nextId = CHAPTER_IDS[CHAPTER_IDS.indexOf(c.id) + 1];
  return {
    id: c.id, name: CHAPTER_KO[c.id], theme: CHAPTER_THEME_KO[c.id],
    years: c.startSeason === c.endSeason ? `${seasonLabel(c.startSeason)}` : `${seasonLabel(c.startSeason)} ~ ${seasonLabel(c.endSeason)}`,
    ages: c.startAge === c.endAge ? `${c.startAge}세` : `${c.startAge}~${c.endAge}세`, seasons: c.seasons,
    apps: c.apps, goals: c.goals, assists: c.assists, avg: c.apps ? (c.ratingSum / c.apps).toFixed(2) : '-', moms: c.moms,
    ovrFrom: c.startOvr, ovrTo: c.endOvr, repFrom: c.startRep, repTo: c.endRep, tierFrom: TIER_NAMES_KO[c.startTier], tierTo: TIER_NAMES_KO[c.endTier], tier: designTier(c.endTier),
    highlights: c.highlights.map((h) => ({ season: seasonLabel(h.season), text: h.text })),
    badges: c.badges.map((b) => BADGE_NAMES_KO[b as BadgeId] ?? b), trophies: c.trophies,
    pick: c.pick, next: retired || !nextId ? null : CHAPTER_KO[nextId], retired,
  };
}

// ── 세이브 (디자인 43) ──

export interface SaveSlotVM { slot: string; label: string; title: string; meta: string; start: string | null; empty: boolean; size: string | null }

export function savesVM(metas: (SaveMeta | null)[], slots: readonly string[]): { auto: SaveSlotVM; manual: SaveSlotVM[]; used: number } {
  const vm = (slot: string, i: number): SaveSlotVM => {
    const m = metas[i];
    const label = slot === 'auto' ? '자동 저장' : slot;
    if (!m) return { slot, label, title: '비어 있음', meta: '지금 진행 상황을 여기에 저장해요', start: null, empty: true, size: null };
    const at = new Date(m.savedAt);
    const when = `${at.getFullYear()}.${String(at.getMonth() + 1).padStart(2, '0')}.${String(at.getDate()).padStart(2, '0')} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    return {
      slot, label, title: `${seasonLabel(m.season)} 시즌 · ${m.date ? dateLabel(m.date) : `${m.round}라운드`}`, meta: `${m.name} ${m.age}세 · ${when}`,
      start: m.startPatch === undefined ? null : m.startPatch === null ? '시작 버전 기록 전' : `${m.startPatch}에서 시작`, empty: false,
      size: m.size ? `${(m.size / 1024).toFixed(0)} KB` : null,
    };
  };
  const all = slots.map(vm);
  const manual = all.slice(1);
  return { auto: all[0]!, manual, used: manual.filter((s) => !s.empty).length };
}

export type SavesVMOut = ReturnType<typeof savesVM>;

// ── 새 게임 (I.2, 디자인 52·53) ──

export interface NewGameForm {
  mode: 'prospect' | 'real' | 'custom'; name: string; position: string; seed: string; difficulty: string; realId: string;
  /** 레전드 팩 (C.47): 'on' | 'off' */
  legends?: string;
  /** 미래 스타 팩 (C.75y): 'on' | 'off' */
  futureStars?: string;
  /** 고른 리그 (C.75m 리그 고르기): 데이터 없는 리그(준비 중)는 시작할 때 빠진다 */
  leagues?: string[];
  /** 가상 유망주 시드 (입력 시드 또는 무작위, C.37) */
  roll: string;
  /** "다른 포지션에서 고르기" 펼침 */
  others: boolean;
  /** 랜덤 인종·기본 사진 (C.73c): '' = 시드 랜덤 / 인종 사진 */
  race?: string;
  photo?: string;
  /** 유망주 시작 팀 (45b b): '' = 랜덤 (리그 순위 범위) */
  startTeam?: string;
  /** 시작 팀 고르기 리그 탭 (화면 상태) */
  pickLeague?: string;
}

/** 리그 고르기 (C.75m): 카탈로그 순, 내 리그 필수, 데이터 없는 리그는 준비 중 */
export function leaguePickerVM(leagueIds: readonly string[], realMode = false): import('./views/screens').NewGameVM['leagues'] {
  // 모든 리그 8~5월 (C.76m)
  return leagueCatalog().map((e) => {
    const ready = !!leagueData(e.id);
    const on = ready && leagueIds.includes(e.id);
    return {
      id: e.id, name: e.nameKo, sub: `${e.countryKo} · ${e.tier}부 · ${e.teams}팀 · 8월~5월`,
      on, mine: e.id === leagueIds[0], ready,
      // 내 리그로 (C.76c) → 45b b: 내 리그는 시작 팀으로 정한다 (리그 고르기는 다른 리그 묶음만)
      canMine: false,
      group: leagueGroupOf(e.country, e.tier),
    };
  });
}

/** 클럽 영문 이름 → 리그 한글 이름 (실제 선수 목록의 리그 표시, C.76c) */
function clubLeagueKo(club: string): string {
  const id = leagueOfTeam(CLUB_TO_TEAM[club]);
  return id ? leagueData(id)?.nameKo ?? id : '';
}

/** 아직 리그 밖 표에 없는 미래 스타 첫 팀 이름 (C.75y) */
const FUTURE_TEAM_KO: Readonly<Record<string, string>> = { 'x:ren': '스타드 렌', 'x:bir': '버밍엄 시티' };

export function newGameVM(f: NewGameForm): import('./views/screens').NewGameVM {
  const seedForPreview = f.seed.trim() || 'preview';
  const formIds = normalizeLeagues(f.leagues ?? DEFAULT_LEAGUES);
  const realData = selectableRealPlayers(formIds);
  // 내 리그 (C.76c): 실제 선수를 고르면 그 선수 소속 리그, 아니면 고른 리그 맨 앞
  const realPick = f.mode === 'real' ? realData.find((p) => p.id === f.realId) : undefined;
  const leagueIds = normalizeLeagues(formIds, realPick ? leagueOfTeam(CLUB_TO_TEAM[realPick.club]) : formIds[0]);
  const many = formIds.length > 1;
  const reals = realData.map((p) => {
    const gen = generatePlayer(p, seedForPreview);
    return {
      id: p.id, name: p.nameKo, club: many ? `${clubKo(p.club)} · ${clubLeagueKo(p.club)}` : clubKo(p.club), age: BALANCE.newGame.startYear - p.birthYear, position: p.position,
      ovr: positionOvr(gen.attributes, p.position), tier: designTier(reputationTier(p.reputation)),
    };
  }).sort((a, b) => b.ovr - a.ovr);
  const legendsOn = f.legends === 'on';
  const myTeams = initialTeams(leagueIds[0]);
  const teams = myTeams.map((t) => ({ id: t.id, rating: t.baseRating }));
  // 3판 (C.75w): 다른 레전드의 소속은 팀당 상한 배치. 넘친 선수는 "리그 밖 구단 (이적 시즌)". 내 선수로 고르면 그 선수는 원래 규칙(legendClub) 팀으로 간다
  const placed = legendsOn && f.mode === 'real' ? legendPlacement(seedForPreview, teams) : undefined;
  const legendList = legendsOn && f.mode === 'real' ? selectableLegends().map((l) => {
    const p = legendRosterPlayer(l, seedForPreview, BALANCE.newGame.startYear);
    const club = teams.find((t) => t.id === (placed?.spawns.find((x) => x.legend.id === l.id)?.teamId ?? legendClub(l, seedForPreview, teams)))?.id ?? '';
    const away = placed?.abroad.find((x) => x.legend.id === l.id);
    return { id: l.id, name: l.nameKo, club: away ? `${OUTSIDE_BY_ID[away.club]?.nameKo ?? away.club} (${seasonLabel(away.season)} 이적)` : myTeams.find((t) => t.id === club)?.nameKo ?? club, age: p.age, position: l.position, ovr: naturalOvr(p), peak: legendPeak(l).ovr, youthKo: l.youthKo, ...(l.group === 'bvb' ? { bvb: true } : {}) };
  }).sort((a, b) => b.peak - a.peak || a.name.localeCompare(b.name)) : [];
  // 미래 스타 (C.75y): 구현 리그 첫 시즌 순, 그 리그가 없으면 "리그 추가 후 등장"
  const futureOn = f.futureStars === 'on';
  const futureList = futureOn && f.mode === 'real' ? FUTURE_STARS.map((l) => {
    // 로스터에 들어오는 것은 내 리그 첫 시즌 (C.76c)
    const mine = leagueIds.slice(0, 1);
    const d = futureDebut(l, mine);
    const e = futureEntry(l, mine);
    const p = legendRosterPlayer(l, seedForPreview, d ?? BALANCE.newGame.startYear);
    const club = e ? clubKoOf(e.team) : '';
    const first = [...(l.entries ?? [])].sort((a, b) => a.season - b.season)[0];
    return {
      id: l.id, name: l.nameKo, position: l.position, debut: d !== undefined ? seasonLabel(d) : '', age: p.age, club,
      realClub: d !== undefined ? '' : first ? `${seasonLabel(first.season)} ${clubKoOf(first.team) !== first.team ? clubKoOf(first.team) : FUTURE_TEAM_KO[first.team] ?? first.team}` : '',
      start: naturalOvr(p), peak: legendPeak(l).ovr, waiting: d === undefined,
    };
  }).sort((a, b) => Number(a.waiting) - Number(b.waiting) || a.debut.localeCompare(b.debut) || b.peak - a.peak) : [];
  const legendSel = legendList.find((r) => r.id === f.realId);
  const sel = reals.find((r) => r.id === f.realId) ?? legendSel;
  const D = BALANCE.difficulty;
  const pct = (x: number) => `${x >= 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)}%`;
  const N = BALANCE.newGame;
  // 시작 후보 4자리 (pending 31 01:03 개정): 적합도 상위 3 + 와일드카드 1, 코치 한 줄 평. 적성 수치는 보여 주지 않는다
  // 전체 랜덤 결과 (C.74d): 유망주 생성기 결과를 커스텀 예산 안으로 맞춘 값 (customRandom.rollCustom)
  const rc = f.mode === 'prospect' ? rollCustom(f.roll) : null;
  const prospect = rc ? { attributes: rc.form.attrs, candidates: rc.candidates } : null;
  const ovrs = prospect ? allPositionOvrs(prospect.attributes) : null;
  const candidates = prospect ? prospect.candidates.map((c) => ({
    id: c.pos, ko: POSITION_NAMES_KO[c.pos], ovr: c.ovr, line: c.line, wild: c.kind === 'wild',
  })) : [];
  const candSet = new Set(candidates.map((c) => c.id));
  const top = prospect ? [...FIELD_ATTRIBUTES].sort((a, b) => prospect.attributes[b] - prospect.attributes[a]).slice(0, 3).map((a) => ATTRIBUTE_NAMES_KO[a]) : [];
  return {
    mode: f.mode, name: f.name, position: f.position,
    positions: PLAYABLE_POSITIONS.map((p) => ({ id: p, ko: POSITION_NAMES_KO[p], ovr: ovrs?.[p] })),
    candidates, others: f.others || (!!prospect && !candidates.some((c) => c.id === f.position)),
    strengths: top.join(' · '),
    // 능력치 전체 바둑판과 포지션별 OVR 표 (C.39, pending 39 8번). 재능 타입 이름·숨은 적성은 보여 주지 않는다
    attrs: prospect ? attrGroupsVM(prospect.attributes, profileOf(f.position as FieldPosition).keys) : [],
    posTable: ovrs ? PLAYABLE_POSITIONS.map((pos) => ({ id: pos, ko: POSITION_NAMES_KO[pos], ovr: ovrs[pos], cand: candSet.has(pos), on: pos === f.position })) : [],
    selectedOvr: ovrs?.[f.position as PlayablePosition] ?? null,
    keyAttrs: profileOf(f.position as FieldPosition).keys.map((a) => ATTRIBUTE_NAMES_KO[a]).join(' · '),
    ageRange: `OVR ${N.startOvr.min}~${N.startOvr.max}에서 시작`,
    difficulty: f.difficulty,
    difficulties: (Object.keys(D) as (keyof typeof D)[]).map((d) => ({
      id: d, label: D[d].label,
      desc: d === 'normal' ? 'XP·평점·부상 모두 기본값' : `XP ${pct(D[d].xp)} · 평점 ${D[d].rating > 0 ? '+' : '−'}${Math.abs(D[d].rating)} · 부상 ${pct(D[d].injury)}`,
    })),
    seed: f.seed, reals, realId: f.realId, legends: legendsOn, futureStars: futureOn, legendList, futureList,
    leagues: leaguePickerVM(leagueIds, f.mode === 'real'),
    ...(f.mode === 'prospect' ? {
      teamPick: prospectTeamPick(pickLeagueOf(f.startTeam, f.pickLeague, leagueIds[0]!), f.startTeam ?? ''),
      ...(f.startTeam ? { startTeam: leagueTeamById(f.startTeam)?.nameKo ?? f.startTeam } : {}),
    } : {}),
    selected: sel ? { id: sel.id, name: sel.name, ovr: sel.ovr, club: sel.club, age: sel.age, position: sel.position, ...(legendSel ? { legend: true, peak: legendSel.peak, youthKo: legendSel.youthKo } : {}) } : null,
    // 능력치 접힘 줄 (디자인 130): 개수 · 평균(1~20) · 약점 3개
    attrSummary: prospect ? (() => {
      const xs = [...FIELD_ATTRIBUTES].sort((a, b) => prospect.attributes[a] - prospect.attributes[b]);
      const avg = xs.reduce((t, a) => t + attrDisplay(prospect.attributes[a]), 0) / xs.length;
      return { count: xs.length, avg: avg.toFixed(1), weak: xs.slice(0, 3).map((a) => `${ATTRIBUTE_NAMES_KO[a]} ${attrDisplay(prospect.attributes[a])}`).join(' · '), top: [...xs].reverse().slice(0, 2).map((a) => `${ATTRIBUTE_NAMES_KO[a]} ${attrDisplay(prospect.attributes[a])}`).join(' · ') };
    })() : null,
    teamHint: `리그 ${N.teamRankRange.min}~${N.teamRankRange.max}위 팀`,
    // 랜덤 인종·국적·이름·기본 사진 (C.73c): 시드 랜덤, 인종·사진은 고를 수 있다
    identity: f.mode === 'prospect' ? (() => {
      const who = rollIdentity(f.roll, isRace(f.race) ? f.race : undefined);
      return {
        race: who.race, races: RACES.map((id) => ({ id, ko: RACE_KO[id] })), photo: isFacePhoto(f.photo) ? f.photo : who.photo,
        photos: FACE_PHOTOS.map((id) => ({ id, ko: PHOTO_KO[id] })), nationalityKo: NATIONALITY_KO[who.nationality] ?? who.nationality, name: who.name,
        picked: isRace(f.race),
      };
    })() : null,
    // 랜덤 유망주의 신체·장단점 (C.45, 숨기지 않음)
    extras: rc ? (() => {
      const x = rc.form;
      return {
        height: x.height, weight: x.weight, foot: FOOT_KO[x.foot], side: x.foot, weakFoot: x.weakFoot,
        traits: x.tags.map((t) => ({ ko: TAGS[t.id].ko, desc: TAGS[t.id].desc, kind: TAGS[t.id].kind === 'pro' ? 'pro' as const : 'con' as const, ...(!t.perm && TAGS[t.id].removeDesc ? { release: `${TAGS[t.id].removeDesc}이면 사라짐` } : {}) })),
      };
    })() : null,
  };
}

// ── 전술 (I.16, 디자인 26~29, E.19, 부록 C.32) ──


export interface TacticsDraftUI {
  draft: MyTactics;
  /** "내 위치 지정" 중: 슬롯을 누르면 내 슬롯이 된다 */
  pickMe: boolean;
  /** 역할 고르기 바텀시트 (슬롯), 시트 안에서 고른 역할 (null = 자동) */
  sheet: number | null;
  sheetPick: string | null;
  /** 커스텀 포메이션 편집 중 (E.5.1): 슬롯을 끌어다 놓거나, 눌러 고른 뒤 피치를 누른다 */
  edit?: boolean;
  moving?: number | null;
}

export interface TacticsVM {
  opp: { name: string; tactic?: TacticVM; home: boolean; neutral?: boolean } | null;
  chips: string[];
  open: boolean;
  tendencies: { id: Tendency; style: TacticStyle; name: string; desc: string; fit: Fit; on: boolean }[];
  tendencyName: string;
  /** 고른 성향 한 줄 설명 (C.76k) */
  tendencyDesc: string;
  /** 게겐프레싱 비용 경고 한 줄 (C.78t). 다른 성향이면 없음 */
  tendencyWarn?: string;
  formations: { id: string; label: string }[];
  /** 탭 값 (커스텀이면 'custom') */
  formation: string;
  /** 표시 이름 (커스텀이면 "3-4-3 커스텀") */
  formationName: string;
  custom: boolean;
  edit: boolean;
  slots: FormationSlotProps[];
  pickMe: boolean;
  me: { pos: string; role: string; ovr: number; mainPos: string; mainOvr: number; off: boolean };
  details: { key: Detail; label: string; items: { id: string; label: string }[]; value: string; base: boolean }[];
  changed: { details: number; roles: number };
  dirty: boolean;
  sheet: null | {
    slot: number; pos: string; name: string; me: boolean;
    options: { id: string; name: string; desc: string; fit: Fit; on: boolean; rec: boolean }[];
    auto: { on: boolean; name: string };
    pick: string | null;
  };
}

const LEVEL_ID = ['0', '1', '2', '3'] as const;

/** 전술 적합도 리그 평균 (로스터는 시즌 안에서 바뀌지 않으므로 세계 시드·시즌으로 기억) */
let fitCache: { key: string; avg: Record<Tendency, number | null> } | null = null;
function leagueFit(g: GameState): Record<Tendency, number | null> {
  const key = `${g.worldSeed}:${g.league.season}:${g.roster.updates}`;
  if (fitCache?.key !== key) fitCache = { key, avg: leagueFitAverages(g.rosters) };
  return fitCache.avg;
}

/** 역할 적합도 배지: 그 선수에게 고를 수 있는 역할 중 가장 맞는 것과의 차이 (안내용) */
function roleFits(ids: string[], attrs: FieldAttributes | undefined): Fit[] {
  if (!attrs) return ids.map(() => 'ok');
  const xs = ids.map((id) => roleFit(id, attrs));
  const best = Math.max(...xs);
  return xs.map((v) => (v >= best - 1.5 ? 'good' : v <= best - 6 ? 'bad' : 'ok'));
}

export function tacticsVM(g: GameState, ui: TacticsDraftUI): TacticsVM {
  const t = ui.draft;
  const p = g.player;
  const roster = g.rosters[p.teamId]!;
  const lineup = previewLineup(t, roster, { name: p.name, attrs: p.attributes });
  const fitAvg = leagueFit(g);
  const fitLineup = lineup.map((s) => ({ pos: s.pos, ...(s.attrs ? { attrs: s.attrs } : {}) }));
  const fx = g.phase === 'season' ? nextFixture(g) : null;
  const opp = fx ? teamById(g.league, fx.opponentId) : null;
  const lv = (d: Detail) => LEVEL_NAMES_KO[d][t.levels[d]];
  const base = tendencyLevels(t.tendency);
  const myPos = slotPos(t, t.mySlot) as FieldPosition;
  const mainOvr = proficientOvr(p, p.position);
  const myOvr = proficientOvr(p, myPos);
  const slots: FormationSlotProps[] = lineup.map((s) => {
    const ovr = s.pos === 'GK' ? undefined : proficientOvr(p, s.pos as FieldPosition);
    return {
      pos: s.pos, x: Math.round(10 + s.y * 80), y: Math.round(8 + s.x * 95), name: s.name, role: ROLE_NAMES_KO[s.role] ?? s.role, me: s.me,
      selected: ui.edit ? ui.moving === s.slot : ui.sheet === s.slot, dim: (ui.pickMe || !!ui.edit) && s.pos === 'GK',
      ...(ovr != null ? { ovr, ovrDown: ovr < mainOvr } : {}),
      ...(ui.edit ? (s.pos === 'GK' ? {} : { drag: s.slot })
        : ui.pickMe ? (s.pos === 'GK' ? {} : { act: 'tac-me-slot', data: { v: s.slot } }) : { act: 'tac-role-open', data: { v: s.slot } }),
    };
  });
  let sheet: TacticsVM['sheet'] = null;
  if (ui.sheet !== null) {
    const s = lineup[ui.sheet]!;
    const ids = ROLE_OPTIONS[roleGroup(s.pos)] ?? [];
    const fits = roleFits(ids, s.attrs);
    const rec = s.attrs ? recommendedRole(t.tendency, s.pos, s.attrs).id : null;
    sheet = {
      slot: s.slot, pos: s.pos, name: s.name, me: s.me,
      options: ids.map((id, i) => ({ id, name: ROLE_NAMES_KO[id] ?? id, desc: ROLE_DESC_KO[id] ?? '', fit: fits[i]!, on: ui.sheetPick === id, rec: id === rec })),
      auto: { on: ui.sheetPick === null, name: rec ? ROLE_NAMES_KO[rec] ?? rec : '-' },
      pick: ui.sheetPick,
    };
  }
  return {
    opp: opp && fx ? { name: opp.nameKo, home: fx.home, neutral: isNeutralMatch(fx), ...(teamTactic(opp.id) ? { tactic: teamTactic(opp.id)! } : {}) } : null,
    chips: [TENDENCY_NAMES_KO[t.tendency], formationLabel(t), `라인 ${lv('lineHeight')}`, `압박 ${lv('pressing')}`, `빌드업 ${lv('style')}`, `폭 ${lv('width')}`],
    open: g.guide.tacticsDetailOpen,
    tendencies: TENDENCIES.map((id) => ({
      id, style: tacticStyle(id), name: TENDENCY_NAMES_KO[id], desc: TENDENCY_DESC_KO[id], fit: fitOf(fitScore(id, fitLineup), fitAvg[id]), on: id === t.tendency,
    })),
    tendencyName: TENDENCY_NAMES_KO[t.tendency],
    tendencyDesc: TENDENCY_DESC_KO[t.tendency],
    ...(BALANCE.gegenCost.on && t.tendency === BALANCE.gegenCost.tendency ? { tendencyWarn: '체력 소모 큼 · 오래 쓰면 선수 생명 단축' } : {}),
    formations: [...FORMATIONS.map((f) => ({ id: f, label: f })), { id: 'custom', label: '커스텀' }],
    formation: t.custom ? 'custom' : t.formation,
    formationName: formationLabel(t),
    custom: !!t.custom,
    edit: !!ui.edit,
    slots,
    pickMe: ui.pickMe,
    me: { pos: myPos, role: ROLE_NAMES_KO[lineup[t.mySlot]!.role] ?? '', ovr: myOvr, mainPos: p.position, mainOvr, off: myPos !== p.position },
    details: DETAILS.map((d) => ({
      key: d, label: DETAIL_NAMES_KO[d], items: LEVEL_NAMES_KO[d].map((label, i) => ({ id: LEVEL_ID[i]!, label })),
      value: LEVEL_ID[t.levels[d]]!, base: t.levels[d] === base[d],
    })),
    changed: customized(t),
    dirty: JSON.stringify(t) !== JSON.stringify(g.tactics),
    sheet,
  };
}

/** 하프타임 전술 초안 (C.75k, E.19): 성향·세부 전술만 (역할·포메이션은 다음 단계) */
export interface HalftimeDraft {
  tendency: Tendency;
  levels: Record<Detail, Level>;
  /** 고른 전술 세트 (없으면 직접 바꿈) */
  set: number | null;
}

export interface HalftimeVM {
  teams: [string, string];
  score: [number, number];
  side: 0 | 1;
  tendencies: { id: Tendency; style: TacticStyle; name: string; on: boolean }[];
  /** changed = 경기 전 전술과 다름 (237 "바뀜" 표시) */
  details: { key: Detail; label: string; items: { id: string; label: string }[]; value: string; changed: boolean }[];
  sets: { id: number; name: string; desc: string; on: boolean }[];
  changed: boolean;
  chips: string[];
}

/** 하프타임 전술 세트 3개 (C.75k): 경기 전 전술 / 리드 지키기(라인·압박 낮게) / 총공세(라인·압박 높게, 직선, 넓게) */
export function halftimeSets(base: Pick<HalftimeDraft, 'tendency' | 'levels'>): { name: string; desc: string; tendency: Tendency; levels: Record<Detail, Level> }[] {
  return [
    { name: '경기 전 전술', desc: '시작할 때 정한 그대로', tendency: base.tendency, levels: { ...base.levels } },
    { name: '리드 지키기', desc: '라인·압박 낮게, 폭 좁게', tendency: base.tendency, levels: { ...base.levels, lineHeight: 1, pressing: 0, width: 0 } },
    { name: '총공세', desc: '라인·압박 높게, 직선 빌드업, 넓게', tendency: base.tendency, levels: { lineHeight: 3, pressing: 2, style: 2, width: 2 } },
  ];
}

export function halftimeVM(draft: HalftimeDraft, base: Pick<HalftimeDraft, 'tendency' | 'levels'>, teams: [string, string], score: [number, number], side: 0 | 1): HalftimeVM {
  const lv = (d: Detail) => LEVEL_NAMES_KO[d][draft.levels[d]];
  return {
    teams, score, side,
    tendencies: TENDENCIES.map((id) => ({ id, style: tacticStyle(id), name: TENDENCY_NAMES_KO[id], on: id === draft.tendency })),
    details: DETAILS.map((d) => ({ key: d, label: DETAIL_NAMES_KO[d], items: LEVEL_NAMES_KO[d].map((label, i) => ({ id: LEVEL_ID[i]!, label })), value: LEVEL_ID[draft.levels[d]]!, changed: draft.levels[d] !== base.levels[d] })),
    sets: halftimeSets(base).map((x, i) => ({ id: i, name: x.name, desc: x.desc, on: draft.set === i })),
    changed: draft.tendency !== base.tendency || DETAILS.some((d) => draft.levels[d] !== base.levels[d]),
    chips: [TENDENCY_NAMES_KO[draft.tendency], `라인 ${lv('lineHeight')}`, `압박 ${lv('pressing')}`, `빌드업 ${lv('style')}`, `폭 ${lv('width')}`],
  };
}

/** 홈 "다음 경기" 카드의 우리 전술 (저장한 전술) */
export function myTacticVM(g: GameState): TacticVM {
  return { tactic: tacticStyle(g.tactics.tendency), formation: formationLabel(g.tactics) };
}

// ── 컵·챔스 (C.67b): 월드 탭 "컵·챔스" — 챔스 조 순위 · 녹아웃 대진 · FA컵 대진 ──

export interface CupTieVM {
  date: string; h: string; a: string; hId: string; aId: string; score: string | null; note: string; w: string | null; me: boolean;
  /** 홈·원정 두 경기 (C.76j 205 녹아웃 표): 1차전 홈 기준 [홈 골, 원정 골], 안 치렀으면 null */
  legs?: { l1: [number, number] | null; l2: [number, number] | null; agg: [number, number] | null; pens: [number, number] | null };
  /** 승부차기 (홈 기준) */
  pens?: [number, number] | null;
}
export interface CupsWorldVM {
  season: string;
  /** 내 팀 이름 (C.76j 녹아웃 결과 줄) */
  myTeam?: string;
  /** 국내 컵 이름 (C.76c: 내 리그 국가 컵). 없으면 FA컵 */
  cupName?: string;
  ucl: null | {
    my: string; winner: string | null;
    groups: { name: string; mine: boolean; rows: { team: string; teamId: string; p: number; w: number; d: number; l: number; gd: string; pts: number; me: boolean; through: boolean }[] }[];
    ko: { stage: string; ties: CupTieVM[] }[];
  };
  fa: null | { my: string; winner: string | null; rounds: { stage: string; date: string; ties: CupTieVM[] }[] };
}

export function cupsWorldVM(g: GameState): CupsWorldVM {
  const cups = g.cups?.season === g.league.season ? g.cups : null;
  const me = g.player.teamId;
  const name = (id: string) => teamById(g.league, id).nameKo;
  const tie = (t: CupTie, date: string, note = ''): CupTieVM => ({
    date: dateLabel(date), h: name(t.h), a: name(t.a), hId: t.h, aId: t.a, score: t.hg === undefined ? null : `${t.hg}-${t.ag}`,
    note: [note, t.p ? `승부차기 ${t.p[0]}-${t.p[1]}` : ''].filter(Boolean).join(' · '), w: t.w ? name(t.w) : null, me: t.h === me || t.a === me,
    pens: t.p ? [t.p[0], t.p[1]] : null,
  });
  const u = cups?.ucl ?? null;
  const fa = cups?.fa ?? null;
  const groupsDone = !!u && u.gs.every((r) => r.every((t) => t.hg !== undefined));
  return {
    cupName: cupNameKo(g.league.id),
    season: seasonLabel(g.league.season),
    myTeam: name(me),
    ucl: u ? {
      my: uclReachLabel(g, u, me), winner: u.winner ? name(u.winner) : null,
      groups: u.groups.map((_, k) => {
        const rows = groupTable(g, u, k);
        return {
          name: `${GROUP_LETTERS[k]}조`, mine: rows.some((r) => r.id === me),
          rows: rows.map((r, i) => ({ team: name(r.id), teamId: r.id, p: r.p, w: r.w, d: r.d, l: r.l, gd: `${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}`, pts: r.pts, me: r.id === me, through: groupsDone && i < 2 })),
        };
      }),
      ko: u.ko.map((st, s) => ({
        stage: KO_NAMES[s]!,
        ties: s === 3 ? [tie(st.l1[0]!, st.l1[0]!.d!, '단판')] : st.l1.map((t1, i) => {
          const t2 = st.l2[i]!;
          // 표시는 1차전 홈 기준: 합계 · 1차전 · 2차전(2차전 홈 = 1차전 원정이라 뒤집어 적음) · 승부차기
          const v = tie(t1, t1.d!);
          const leg2 = t2.hg === undefined ? dateLabel(t2.d!) : `${t2.ag}-${t2.hg}`;
          return {
            ...v, score: t2.hg === undefined ? null : `${t1.hg! + t2.ag!}-${t1.ag! + t2.hg!}`,
            note: [`1차전 ${t1.hg === undefined ? dateLabel(t1.d!) : `${t1.hg}-${t1.ag}`}`, `2차전 ${leg2}`, t2.p ? `승부차기 ${t2.p[1]}-${t2.p[0]}` : ''].filter(Boolean).join(' · '),
            w: t2.w ? name(t2.w) : null,
            legs: {
              l1: t1.hg === undefined ? null : [t1.hg, t1.ag!], l2: t2.hg === undefined ? null : [t2.ag!, t2.hg],
              agg: t2.hg === undefined ? null : [t1.hg! + t2.ag!, t1.ag! + t2.hg!], pens: t2.p ? [t2.p[1], t2.p[0]] : null,
            },
          };
        }),
      })),
    } : null,
    fa: fa ? {
      my: reachLabel(fa, me), winner: fa.winner ? name(fa.winner) : null,
      rounds: fa.rounds.map((r, s) => ({ stage: stageName(fa, s), date: dateLabel(fa.dates[s]!), ties: r.map((t) => tie(t, fa.dates[s]!)) })).reverse(),
    } : null,
  };
}

/** 부상 복귀 선택 시트 (C.74b, pending 77-5) */
export interface InjuryReturnVM { daysLeft: number; grade: string; back: string; risk: number; riskDays: number }

export function injuryReturnVM(g: GameState): InjuryReturnVM | null {
  const inj = g.player.injury;
  if (!inj || inj.ret !== 'ask' || g.phase !== 'season') return null;
  return { daysLeft: inj.daysLeft, grade: INJURY_NAMES_KO[inj.grade], back: returnLabel(g), risk: BALANCE.injuryReturn.reinjuryMul, riskDays: BALANCE.injuryReturn.reinjuryDays };
}

/** 기록 추적 (C.74b, pending 77-10): 홈·선수 화면 1~3줄 */
export interface RecordTrackVM { label: string; holder: string | null; left: string; value: string; ratio: number }

export function recordRowsVM(g: GameState): RecordTrackVM[] {
  return shownTracks(g).map((t) => ({
    label: t.label, holder: t.holder ?? null, left: `${t.target - t.cur}${t.unit === '경기' ? '경기' : t.unit} 남음`,
    value: `${t.cur}/${t.target}`, ratio: Math.max(0, Math.min(1, t.cur / Math.max(1, t.target))),
  }));
}
