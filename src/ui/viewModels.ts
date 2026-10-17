// 뷰모델 (부록 H.2): 게임 상태 → 화면에 필요한 값. 화면 모듈(src/ui/views/)은 이 값만 받아 그린다.
// 게임 로직(확률, 성장 계산)은 넣지 않고 기존 함수의 결과를 읽기만 한다

import { SCENE_LABEL } from '../engine/moments';
import { ATTRIBUTE_GROUPS, ATTRIBUTE_NAMES_KO, FIELD_ATTRIBUTES, GROUP_NAMES, type AttributeGroup, type FieldAttribute } from '../attributes';
import { adviceOpen, adviceText, rollProspect } from '../aptitude';
import { BALANCE } from '../config/balance';
import { TEAM_TACTICS } from '../engine/teamData';
import { formBonus, formLevel, type FormLevel } from '../form';
import { averageRating, calendarOf, careerTotals, myMatchDate, nextFixture, selectableRealPlayers, slumpThreshold, type GameState, type SeasonSummary } from '../game';
import { addDays, dateLabel, daysBetween, weekday as weekdayOf } from '../calendar';
import { isUnlocked } from '../unlocks';
import { generatePlayer } from '../generate';
import {
  attributeOvrWeight, allPositionOvrs, PLAYABLE_POSITIONS, POSITION_NAMES_KO, positionOvr, positionOvrExact, profileOf, type FieldPosition,
  type PlayablePosition,
} from '../positions';
import {
  costTier, legendaryConditions, nextReputationTier, playerOvr, pointCost, raiseBlock, reputationFloorTier, reputationTier, TIER_NAMES_KO, xpToLevel, type AttributeDelta,
} from '../growth';
import { possessionSummary, type Scene } from '../highlights';
import {
  ALL_ITEMS, primaryItems, recordLine, recordRows, type MatchLogEntry, type MatchRecord, type RecordRowVM,
} from '../matchRecord';
import { INJURY_NAMES_KO } from '../injury';
import { leaguePosition, sortedTable, teamById } from '../league';
import { npcOvr } from '../npc';
import { restartLabel, type Replay, type ReplayEvent, type ReplayFrame } from '../replay';
import type { SaveMeta } from '../save';
import { reportInput, tacticalReport, type TacticalReport, type Tendency } from '../tacticalReport';
import type { BadgeId, Tier } from '../types';
import { activeBadges, BADGE_DESC_KO, BADGE_NAMES_KO } from '../badges';
import { positionPenalty, proficiencyOf, proficientOvr } from '../proficiency';
import { saveStartNotice, versionLabel } from '../version';
import type { DesignTier, FeedKind, FormationSlotProps, TacticStyle } from './components';
import type { FieldAttributes } from '../attributes';
import type { AttrGroupVM } from './views/attrGrid';
import { FORMATIONS } from '../formations';
import {
  customized, fitOf, formationLabel, fitScore, leagueFitAverages, previewLineup, slotPos, type Fit, type MyTactics,
} from '../myTactics';
import {
  DETAIL_NAMES_KO, DETAILS, LEVEL_NAMES_KO, recommendedRole, ROLE_OPTIONS, roleFit, roleGroup, TENDENCIES, TENDENCY_NAMES_KO, tendencyLevels,
  type Detail,
} from '../engine/tactics';
import { ROLE_DESC_KO, ROLE_NAMES_KO } from '../engine/roles';
export { ROLE_DESC_KO };

// ── 공통 변환 ──

/** 성장(포인트 찍기)이 아직 안 열렸으면 포인트 버튼·배너를 숨긴다 (21.3 단계적 공개, 부록 C.23) */
export function visiblePoints(g: GameState): number {
  return isUnlocked(g.guide, 'growth') ? g.player.unspentPoints : 0;
}

export const seasonLabel = (y: number): string => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

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
}

function conditionVM(g: GameState): ConditionVM {
  const p = g.player;
  const enough = p.recentRatings.length >= BALANCE.form.games;
  const b = formBonus(p.recentRatings);
  return {
    fatigue: Math.round(p.fatigue),
    form: FORM_STEP[formLevel(p.recentRatings)],
    formLabel: enough ? `평점 보정 ${b >= 0 ? '+' : '−'}${Math.abs(b).toFixed(2)}` : `${p.recentRatings.length}/${BALANCE.form.games}경기`,
    yellows: p.season.yellows % BALANCE.discipline.yellowBanEvery,
    yellowEvery: BALANCE.discipline.yellowBanEvery,
  };
}

export interface PlayerCardVM {
  name: string; age: number; position: string; ovr: number; tier: DesignTier; tierScore: number; level: number; xp: number; xpMax: number; team: string;
}

function playerCardVM(g: GameState): PlayerCardVM {
  const p = g.player;
  return {
    name: p.name, age: p.age, position: p.position, ovr: playerOvr(p), tier: designTier(reputationTier(p.reputation, p.honors)), tierScore: p.reputation,
    level: p.level, xp: p.xp, xpMax: xpToLevel(p), team: teamById(g.league, p.teamId).nameKo,
  };
}

/** 부상 복귀 예정 시점 (날짜, 부록 C.38). 비시즌에 BALANCE.injury.offseasonWeeks 주만큼 회복된다 */
function returnLabel(g: GameState): string {
  const inj = g.player.injury!;
  const off = BALANCE.injury.offseasonWeeks * 7;
  if (g.phase === 'season') {
    const cal = calendarOf(g);
    // 다친 날이면 다음 날부터 줄어든다
    const back = addDays(g.calendar.date, inj.daysLeft + (inj.date === g.calendar.date ? 1 : 0));
    if (daysBetween(back, cal.final) >= 0) return dateLabel(back);
    const carry = inj.daysLeft - daysBetween(g.calendar.date, cal.final) - off;
    return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 개막 ${Math.ceil(carry / 7)}주 뒤`;
  }
  const carry = inj.daysLeft - off;
  return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 개막 ${Math.ceil(carry / 7)}주 뒤`;
}

export interface BannerVM { tone: 'injury' | 'warning' | 'info' | 'success'; title: string; body?: string; action?: string; act?: string; to?: string }

function injuryBanner(g: GameState): BannerVM | null {
  const inj = g.player.injury;
  if (!inj) return null;
  return {
    tone: 'injury', title: `부상 (${INJURY_NAMES_KO[inj.grade]}) · ${inj.daysLeft}일 남음`,
    body: `복귀 예정 ${returnLabel(g)}. 부상 중에는 경기에 나가지 못하고 재활 XP(주 ${BALANCE.injury.rehabXp})만 받아요.`,
  };
}

function pointsBanner(g: GameState): BannerVM | null {
  const n = visiblePoints(g);
  return n > 0 ? { tone: 'success', title: `능력치 포인트 ${n}개`, body: '레벨업으로 얻은 포인트를 능력치에 써요.', action: '찍기', act: 'go', to: 'allocate' } : null;
}

// ── 홈 (I.3, 디자인 22·25) ──

export interface HomeVM {
  season: string;
  round: number;
  rounds: number;
  phase: GameState['phase'];
  banners: BannerVM[];
  next: null | {
    my: string; opp: string; home: boolean; myRating: number; oppRating: number;
    myTactic?: TacticVM; oppTactic?: TacticVM;
    /** 전술 화면이 열렸으면 "전술" 버튼 (21.3: 3경기 뒤) */
    tacticsOpen: boolean;
    /** 결장(부상·출장 정지)이면 경기 버튼은 "결장(관전)" */
    out: boolean;
    /** 내 선수 결정 (E.11): 직접/자동, 정지 빈도 */
    control: GameState['control'];
  };
  card: PlayerCardVM;
  condition: ConditionVM;
  stats: { apps: number; starts: number; goals: number; assists: number; avg: string };
  version: VersionVM;
  /** 캘린더 (부록 C.38): 오늘, 다음 일정, 이번 달 */
  day: DayVM | null;
  /** 남은 능력치 포인트 (C.39 홈 배지, 성장 기능이 열렸을 때만) */
  points: number;
}

export interface DayCellVM { d: number; date: string; today: boolean; past: boolean; kind: '' | 'home' | 'away' | 'league' | 'break'; title: string }

export interface DayVM {
  /** "8월 11일 (토)" */
  date: string;
  /** 큰 글씨 "8.11", "토요일" */
  short: string;
  weekdayKo: string;
  year: number;
  matchDay: boolean;
  /** 다음 내 경기까지 남은 날 (오늘이면 0) */
  daysTo: number | null;
  nextLabel: string | null;
  quick: boolean;
  upcoming: { date: string; text: string; kind: 'home' | 'away' | 'break' | 'end'; sub?: string }[];
  month: { title: string; lead: number; days: DayCellVM[] };
}

const BREAK_KO = { international: 'A매치 휴식기', cup: '컵 주간 (리그 없음)', winter: '휴식기' } as const;

export function dayVM(g: GameState): DayVM | null {
  if (g.phase !== 'season') return null;
  const cal = calendarOf(g);
  const today = g.calendar.date;
  const me = g.player.teamId;
  const myDates = new Map<string, { home: boolean; opp: string; r: number }>();
  const leagueDays = new Set<string>();
  g.league.schedule.forEach((round, r) => round.forEach((f, i) => {
    const d = cal.fixtureDates[r]![i]!;
    leagueDays.add(d);
    if (f.home === me || f.away === me) myDates.set(d, { home: f.home === me, opp: f.home === me ? f.away : f.home, r });
  }));
  const breakDays = new Map<string, keyof typeof BREAK_KO>();
  for (const b of cal.breaks) for (let k = -1; k <= 0; k++) breakDays.set(addDays(b.date, k + 1), b.kind);
  const next = myMatchDate(g);
  const daysTo = next ? daysBetween(today, next) : null;
  const upcoming: DayVM['upcoming'] = [];
  const brk = cal.breaks.filter((b) => daysBetween(today, b.date) >= -1);
  for (let r = g.league.round; r < g.league.schedule.length && upcoming.length < 6; r++) {
    const i = g.league.schedule[r]!.findIndex((f) => f.home === me || f.away === me);
    const f = g.league.schedule[r]![i]!;
    const d = cal.fixtureDates[r]![i]!;
    while (brk.length && daysBetween(brk[0]!.date, d) > 0 && upcoming.length < 6) {
      const b = brk.shift()!;
      upcoming.push({ date: dateLabel(b.date), text: BREAK_KO[b.kind], kind: 'break' });
    }
    if (upcoming.length >= 6) break;
    const home = f.home === me;
    upcoming.push({ date: dateLabel(d), text: `${r + 1}R ${teamById(g.league, home ? f.away : f.home).nameKo}`, kind: home ? 'home' : 'away', sub: home ? '홈' : '원정' });
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
    const kind: DayCellVM['kind'] = mine ? (mine.home ? 'home' : 'away') : breakDays.has(d) ? 'break' : leagueDays.has(d) ? 'league' : '';
    const title = mine ? `${mine.r + 1}R ${teamById(g.league, mine.opp).nameKo} ${mine.home ? '홈' : '원정'}` : kind === 'break' ? BREAK_KO[breakDays.get(d)!] : kind === 'league' ? '다른 팀 경기' : '';
    days.push({ d: k + 1, date: d, today: d === today, past: daysBetween(d, today) > 0, kind, title });
  }
  return {
    date: dateLabel(today), short: `${m}.${+today.slice(8, 10)}`, weekdayKo: `${'일월화수목금토'[weekdayOf(today)]}요일`, year: y, matchDay: daysTo === 0, daysTo, nextLabel: next ? dateLabel(next) : null, quick: g.options?.quickOthers ?? false,
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
      banners.push({ tone: 'warning', title: `출장 정지 ${p.suspended}경기`, body: `${opp.nameKo}전에 나설 수 없어요. 결장한 주에도 훈련 XP를 받아요.` });
    }
    next = {
      my: my.nameKo, opp: opp.nameKo, home: fx.home, myRating: my.rating, oppRating: opp.rating,
      myTactic: myTacticVM(g), oppTactic: teamTactic(opp.id), out: !!inj || p.suspended > 0,
      tacticsOpen: isUnlocked(g.guide, 'tactics'),
      control: g.control,
    };
  }
  const slump = g.phase === 'season' ? slumpBanner(g) : null;
  if (slump) banners.push(slump);
  const pts = pointsBanner(g);
  if (pts) banners.push(pts);
  const s = p.season;
  const avg = averageRating(s);
  return {
    season: seasonLabel(g.league.season), round: Math.min(g.league.round + 1, g.league.schedule.length), rounds: g.league.schedule.length,
    phase: g.phase, banners, next, card: playerCardVM(g), condition: conditionVM(g),
    stats: { apps: s.apps, starts: s.starts, goals: s.goals, assists: s.assists, avg: avg === null ? '-' : avg.toFixed(2) },
    version: versionVM(g),
    day: dayVM(g),
    points: visiblePoints(g),
  };
}

// ── 선수 (I.8, 디자인 44) ──

export interface AttrRowVM { label: string; value: number; key: boolean }

export interface PlayerVM {
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
  if (!a || a.dismissed || g.phase === 'retired' || !adviceOpen(g.player, g.league.season, g.league.round)) return null;
  const left = g.league.season < a.untilSeason ? a.untilRound : a.untilRound - g.league.round;
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

const GROUP_NAMES_KO: Record<AttributeGroup, string> = {
  ballHandling: '볼 다루기', finishing: '마무리', passing: '패스·시야', defending: '수비',
  pace: '스피드·민첩', physical: '피지컬', mental: '멘탈',
};

function historyVM(g: GameState): HistoryRowVM[] {
  return g.player.history.map((r) => ({
    season: seasonLabel(r.season), age: r.age, ovr: r.ovr, apps: r.apps, goals: r.goals, assists: r.assists,
    avg: r.apps ? (r.ratingSum / r.apps).toFixed(2) : '-', pos: r.leaguePosition,
  }));
}

/** 능력치 바둑판 (C.39): 분류별 박스. base 가 있으면 변화 = 지금 − base */
export function attrGroupsVM(attrs: FieldAttributes, keys: readonly FieldAttribute[], base?: FieldAttributes): AttrGroupVM[] {
  return GROUP_NAMES.map((grp) => ({
    name: GROUP_NAMES_KO[grp],
    cells: (ATTRIBUTE_GROUPS[grp] as readonly FieldAttribute[]).map((a) => ({
      attr: a, label: ATTRIBUTE_NAMES_KO[a], value: attrs[a], delta: base ? attrs[a] - base[a] : 0, key: keys.includes(a),
    })),
  }));
}

export function playerVM(g: GameState): PlayerVM {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const ovrs = allPositionOvrs(p.attributes);
  const tier = reputationTier(p.reputation, p.honors);
  const nx = nextReputationTier(p.reputation, p.honors);
  const fx = g.phase === 'season' ? nextFixture(g) : null;
  return {
    name: p.name, position: p.position, positionKo: POSITION_NAMES_KO[p.position], age: p.age, ovr: playerOvr(p),
    team: teamById(g.league, p.teamId).nameKo,
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
    // 발롱도르·챔스·월드컵은 5단계 대회 기능이라 아직 얻을 수 없다 (위상 조건만 열림)
    legendary: legendaryConditions(p.reputation, p.honors).map((c, i) => ({ ...c, locked: i > 0 })),
    isLegendary: tier === 'legendary',
    history: historyVM(g),
    matches: seasonMatchesVM(g),
  };
}

// ── 포인트 찍기 (I.7) ──

export interface AllocRowVM { attr: FieldAttribute; label: string; value: number; raised: number; cost: number | null; ovrDelta: number | null; maxed: boolean; blocked: boolean; key: boolean }

export interface AllocateVM {
  points: number; position: string; startOvr: number; startExact: number; ovr: number; exact: number;
  cap: number; levels: number; tierName: string; cost1Max: number; cost2Max: number; coachComment: boolean;
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
    cap: p.allocation.levels * BALANCE.growth.maxRaisePerLevel, levels: p.allocation.levels,
    tierName: TIER_NAMES_KO[tier], cost1Max: band.cost1Max, cost2Max: band.cost2Max, coachComment,
    groups: GROUP_NAMES.map((grp) => ({
      name: GROUP_NAMES_KO[grp],
      rows: (ATTRIBUTE_GROUPS[grp] as readonly FieldAttribute[]).map((a) => {
        const v = p.attributes[a];
        const maxed = v >= BALANCE.growth.maxAttribute;
        const w = attributeOvrWeight(p.position, a);
        return {
          attr: a, label: ATTRIBUTE_NAMES_KO[a], value: v, raised: p.allocation.raised[a] ?? 0,
          cost: maxed ? null : pointCost(v, tier), ovrDelta: w > 0 ? Math.round(w * 100) / 100 : null,
          maxed, blocked: raiseBlock(p, a) !== null, key: keys.includes(a),
        };
      }),
    })),
  };
  vm.attrs = vm.groups.map((grp) => ({
    name: grp.name,
    cells: grp.rows.map((r) => ({
      attr: r.attr, label: r.label, value: r.value, delta: snap ? r.value - snap[r.attr] : 0, key: r.key,
      edit: { cost: r.cost, ovrDelta: r.ovrDelta, maxed: r.maxed, blocked: r.blocked, canLower: raises.includes(r.attr) },
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

export const transitionSummary = possessionSummary;

// ── 경기 후 (I.6, 디자인 38) ──

export interface MatchResultVM {
  round: number; opp: string; scoreLine: string; outcome: 'win' | 'draw' | 'loss'; outcomeKo: string;
  rating: number | null; appearance: string; formBonus: number;
  chips: string[];
  banners: BannerVM[];
  highlights: FeedVM[];
  report: (TacticalReport & { my: TacticVM; opp: TacticVM; possession: number }) | null;
  hasAvgMap: boolean;
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
  cardUses: { text: string; result: 'success' | 'fail' | 'neutral' }[];
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
      ...(perm.length ? { body: `후유증: ${perm.map(([a, v]) => `${ATTRIBUTE_NAMES_KO[a]} ${v}`).join(', ')}` } : {}),
    });
  }
  if (m.recovered) banners.push({ tone: 'success', title: '부상에서 회복했어요', body: '다음 경기부터 나설 수 있어요.' });
  if (m.cards?.red) banners.push({ tone: 'warning', title: '퇴장당했어요', body: '다음 경기에 나설 수 없어요.' });
  else if (g.player.suspended > 0 && g.phase === 'season') banners.push({ tone: 'warning', title: '다음 경기 출장 정지', body: `옐로카드 ${BALANCE.discipline.yellowBanEvery}장이 쌓였어요.` });
  const slump = slumpBanner(g);
  if (slump) banners.push(slump);
  if (m.levelsGained > 0) {
    banners.push({ tone: 'success', title: `레벨 업! Lv.${g.player.level}`, body: `능력치 포인트 +${m.levelsGained * BALANCE.growth.pointsPerLevel}개 · 지금 OVR ${playerOvr(g.player)}` });
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
  return {
    round: m.round, opp, scoreLine: `${res.goalsFor}-${res.goalsAgainst}`, outcome: res.outcome, outcomeKo,
    rating: res.rating, appearance, formBonus: res.minutes > 0 ? m.formBonus : 0, chips, banners, highlights, report,
    hasAvgMap: !!r, my, myMore,
    xp: { gained: res.xp, value, max, level: g.player.level, levelsGained: m.levelsGained },
    seasonOver: g.phase !== 'season', points: visiblePoints(g),
    decisionReplay: !!r?.decisions?.length,
    cardUses: (m.cardUses ?? []).map((u) => ({ text: `${u.minute}' ${u.name}${u.auto ? ' (자동)' : ''}`, result: u.result })),
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
}

export interface SeasonMatchesVM {
  rows: MatchLogRowVM[];
  /** 시즌 합계 (엔진 기록이 있는 출전만): 포지션별 6개 + 나머지 */
  total: { primary: RecordRowVM[]; more: RecordRowVM[] } | null;
  recApps: number;
}

function logRowVM(g: GameState, e: MatchLogEntry): MatchLogRowVM {
  const outcome = e.goalsFor > e.goalsAgainst ? 'win' : e.goalsFor < e.goalsAgainst ? 'loss' : 'draw';
  const head = e.minutes === 0
    ? e.absent === 'injured' ? '부상 결장' : e.absent === 'suspended' ? '출장 정지' : '결장'
    : [e.started ? '선발' : `교체 ${e.minutes}분`, e.goals ? `골 ${e.goals}` : '', e.assists ? `도움 ${e.assists}` : '', e.mom ? 'MOM' : '']
      .filter(Boolean).join(' · ');
  return {
    round: e.round, opp: teamById(g.league, e.opponentId).nameKo, venue: e.home ? '홈' : '원정', score: `${e.goalsFor}-${e.goalsAgainst}`, outcome,
    rating: e.rating === null ? '-' : e.rating.toFixed(1), head,
    line: e.minutes === 0 ? '' : e.rec ? recordLine(e.rec, e.position) : '기록 없음',
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

// ── 월드: 순위표와 리그 스타 (I.10 일부) ──

export interface WorldVM {
  league: string; season: string; round: number; rounds: number; myPos: number; teams: number;
  table: { pos: number; team: string; played: number; won: number; drawn: number; lost: number; gd: string; points: number; me: boolean; rating: number }[];
  stars: { name: string; position: string; age: number; club: string; ovr: number; change: number }[];
  retired: string[];
  /** 득점 순위 (부록 C.38): 모든 경기의 선수 기록 합계에서 */
  scorers: ScorerVM[];
}

export interface ScorerVM { name: string; team: string; apps: number; goals: number; assists: number; avg: string; me: boolean }

/** 득점 순위 (골 → 도움 → 출전 적은 순). 내 선수는 player.season 에서 */
export function scorersVM(g: GameState, limit = 15): ScorerVM[] {
  const names = new Map<string, { name: string; team: string }>();
  for (const [teamId, r] of Object.entries(g.rosters ?? {})) {
    const team = teamById(g.league, teamId)?.nameKo ?? teamId;
    for (const p of r.players) names.set(p.id, { name: p.nameKo, team });
  }
  const rows: ScorerVM[] = Object.entries(g.playerStats ?? {}).map(([id, [apps, goals, assists, r10]]) => ({
    name: names.get(id)?.name ?? id, team: names.get(id)?.team ?? '', apps, goals, assists, avg: apps ? (r10 / apps / 10).toFixed(2) : '-', me: false,
  }));
  const s = g.player.season;
  if (s.apps > 0) rows.push({ name: g.player.name, team: teamById(g.league, g.player.teamId).nameKo, apps: s.apps, goals: s.goals, assists: s.assists, avg: (s.ratingSum / s.apps).toFixed(2), me: true });
  return rows.filter((r) => r.goals > 0 || r.me).sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.apps - b.apps).slice(0, limit);
}

export function worldVM(g: GameState): WorldVM {
  const rows = sortedTable(g.league);
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  return {
    league: g.league.name, season: seasonLabel(g.league.season), round: g.league.round, rounds: g.league.schedule.length,
    myPos: leaguePosition(g.league, g.player.teamId), teams: rows.length,
    table: rows.map((r, i) => ({
      pos: i + 1, team: teamById(g.league, r.teamId).nameKo, played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
      gd: signed(r.gf - r.ga), points: r.points, me: r.teamId === g.player.teamId, rating: teamById(g.league, r.teamId).rating,
    })),
    stars: g.npcs.filter((n) => !n.retired).sort((a, b) => npcOvr(b) - npcOvr(a))
      .map((n) => ({ name: n.nameKo, position: n.position, age: n.age, club: n.club, ovr: npcOvr(n), change: n.lastChange })),
    retired: g.npcs.filter((n) => n.retired).map((n) => n.nameKo),
    scorers: scorersVM(g),
  };
}

// ── 시즌 종료 (I.13 일부) ──

export interface DeltaVM { label: string; value: number }

const deltas = (d: AttributeDelta): DeltaVM[] =>
  (Object.entries(d) as [FieldAttribute, number][]).map(([a, v]) => ({ label: ATTRIBUTE_NAMES_KO[a], value: v }));

export interface SeasonVM {
  season: string; nextSeason: string; team: string; pos: number; apps: number; goals: number; assists: number; avg: string;
  injuries: number; injuredWeeks: number;
  achievements: { label: string; xp: number }[]; achievementXp: number; levelsGained: number;
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
  injury: BannerVM | null;
  badges: { name: string; desc: string }[];
  /** 시즌 경기 목록과 합계 (부록 C.30) */
  matches: SeasonMatchesVM;
}

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
    injury: g.phase === 'offseason' ? injuryBanner(g) : null,
    badges: (s.badges ?? []).map((b) => ({ name: BADGE_NAMES_KO[b.id], desc: BADGE_DESC_KO[b.id] })),
    matches: seasonMatchesVM(g),
  };
}

// ── 은퇴 (I.14 일부) ──

export interface RetiredVM {
  card: PlayerCardVM; seasons: number; apps: number; goals: number; assists: number; avg: string; peakOvr: number; best: string;
  reputation: number; tierName: string; history: HistoryRowVM[];
}

export function retiredVM(g: GameState): RetiredVM {
  const t = careerTotals(g.player);
  return {
    card: playerCardVM(g), seasons: t.seasons, apps: t.apps, goals: t.goals, assists: t.assists,
    avg: t.avgRating === null ? '-' : t.avgRating.toFixed(2), peakOvr: t.peakOvr, best: t.bestFinish === null ? '-' : `${t.bestFinish}위`,
    reputation: g.player.reputation, tierName: TIER_NAMES_KO[reputationTier(g.player.reputation, g.player.honors)], history: historyVM(g),
  };
}

// ── 세이브 (디자인 43) ──

export interface SaveSlotVM { slot: string; label: string; title: string; meta: string; start: string | null; empty: boolean }

export function savesVM(metas: (SaveMeta | null)[], slots: readonly string[]): { auto: SaveSlotVM; manual: SaveSlotVM[]; used: number } {
  const vm = (slot: string, i: number): SaveSlotVM => {
    const m = metas[i];
    const label = slot === 'auto' ? '자동 저장' : slot;
    if (!m) return { slot, label, title: '비어 있음', meta: '지금 진행 상황을 여기에 저장해요', start: null, empty: true };
    const at = new Date(m.savedAt);
    const when = `${at.getFullYear()}.${String(at.getMonth() + 1).padStart(2, '0')}.${String(at.getDate()).padStart(2, '0')} ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    return {
      slot, label, title: `${seasonLabel(m.season)} 시즌 · ${m.round}라운드`, meta: `${m.name} ${m.age}세 · ${when}`,
      start: m.startPatch === undefined ? null : m.startPatch === null ? '시작 버전 기록 전' : `${m.startPatch}에서 시작`, empty: false,
    };
  };
  const all = slots.map(vm);
  const manual = all.slice(1);
  return { auto: all[0]!, manual, used: manual.filter((s) => !s.empty).length };
}

export type SavesVMOut = ReturnType<typeof savesVM>;

// ── 새 게임 (I.2, 디자인 52·53) ──

export interface NewGameForm {
  mode: 'prospect' | 'real'; name: string; position: string; seed: string; difficulty: string; realId: string;
  /** 가상 유망주 시드 (입력 시드 또는 무작위, C.37) */
  roll: string;
  /** "다른 포지션에서 고르기" 펼침 */
  others: boolean;
}

export function newGameVM(f: NewGameForm): import('./views/screens').NewGameVM {
  const seedForPreview = f.seed.trim() || 'preview';
  const reals = selectableRealPlayers().map((p) => {
    const gen = generatePlayer(p, seedForPreview);
    return {
      id: p.id, name: p.nameKo, club: p.club, age: BALANCE.newGame.startYear - p.birthYear, position: p.position,
      ovr: positionOvr(gen.attributes, p.position), tier: designTier(reputationTier(p.reputation)),
    };
  }).sort((a, b) => b.ovr - a.ovr);
  const sel = reals.find((r) => r.id === f.realId);
  const D = BALANCE.difficulty;
  const pct = (x: number) => `${x >= 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)}%`;
  const N = BALANCE.newGame;
  // 시작 후보 4자리 (pending 31 01:03 개정): 적합도 상위 3 + 와일드카드 1, 코치 한 줄 평. 적성 수치는 보여 주지 않는다
  const prospect = f.mode === 'prospect' ? rollProspect(f.roll) : null;
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
      desc: d === 'normal' ? '기획서 기준 수치 그대로' : `XP ${pct(D[d].xp)} · 평점 ${D[d].rating > 0 ? '+' : '−'}${Math.abs(D[d].rating)} · 부상 ${pct(D[d].injury)}`,
    })),
    seed: f.seed, reals, realId: f.realId, selected: sel ? { name: sel.name, ovr: sel.ovr } : null,
    teamHint: `리그 ${N.teamRankRange.min}~${N.teamRankRange.max}위 팀`,
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
  opp: { name: string; tactic?: TacticVM; home: boolean } | null;
  chips: string[];
  open: boolean;
  tendencies: { id: Tendency; style: TacticStyle; name: string; fit: Fit; on: boolean }[];
  tendencyName: string;
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

const LEVEL_ID = ['0', '1', '2'] as const;

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
    opp: opp && fx ? { name: opp.nameKo, home: fx.home, ...(teamTactic(opp.id) ? { tactic: teamTactic(opp.id)! } : {}) } : null,
    chips: [TENDENCY_NAMES_KO[t.tendency], formationLabel(t), `라인 ${lv('lineHeight')}`, `압박 ${lv('pressing')}`, `빌드업 ${lv('style')}`, `폭 ${lv('width')}`],
    open: g.guide.tacticsDetailOpen,
    tendencies: TENDENCIES.map((id) => ({
      id, style: tacticStyle(id), name: TENDENCY_NAMES_KO[id], fit: fitOf(fitScore(id, fitLineup), fitAvg[id]), on: id === t.tendency,
    })),
    tendencyName: TENDENCY_NAMES_KO[t.tendency],
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

/** 홈 "다음 경기" 카드의 우리 전술 (저장한 전술) */
export function myTacticVM(g: GameState): TacticVM {
  return { tactic: tacticStyle(g.tactics.tendency), formation: formationLabel(g.tactics) };
}
