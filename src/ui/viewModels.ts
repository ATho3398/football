// 뷰모델 (부록 H.2): 게임 상태 → 화면에 필요한 값. 화면 모듈(src/ui/views/)은 이 값만 받아 그린다.
// 게임 로직(확률, 성장 계산)은 넣지 않고 기존 함수의 결과를 읽기만 한다

import { ATTRIBUTE_GROUPS, ATTRIBUTE_NAMES_KO, GROUP_NAMES, type AttributeGroup, type FieldAttribute } from '../attributes';
import { BALANCE } from '../config/balance';
import { TEAM_TACTICS } from '../engine/teamData';
import { formBonus, formLevel, type FormLevel } from '../form';
import { averageRating, careerTotals, nextFixture, selectableRealPlayers, type GameState } from '../game';
import { generatePlayer } from '../generate';
import {
  attributeOvrWeight, allPositionOvrs, PLAYABLE_POSITIONS, POSITION_NAMES_KO, positionOvr, positionOvrExact, profileOf, type FieldPosition,
} from '../positions';
import {
  costTier, nextReputationTier, playerOvr, pointCost, raiseBlock, reputationTier, TIER_NAMES_KO, xpToLevel, type AttributeDelta,
} from '../growth';
import { possessionSummary, type Scene } from '../highlights';
import { INJURY_NAMES_KO } from '../injury';
import { leaguePosition, sortedTable, teamById } from '../league';
import { npcOvr } from '../npc';
import { restartLabel, type Replay, type ReplayEvent, type ReplayFrame } from '../replay';
import type { SaveMeta } from '../save';
import { reportInput, tacticalReport, type TacticalReport, type Tendency } from '../tacticalReport';
import type { BadgeId, Tier } from '../types';
import { activeBadges, BADGE_DESC_KO, BADGE_NAMES_KO } from '../badges';
import { proficiencyOf, proficiencyPenalty, proficientOvr } from '../proficiency';
import { saveStartNotice, versionLabel } from '../version';
import type { DesignTier, FeedKind, TacticStyle } from './components';

// ── 공통 변환 ──

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
    name: p.name, age: p.age, position: p.position, ovr: playerOvr(p), tier: designTier(reputationTier(p.reputation)), tierScore: p.reputation,
    level: p.level, xp: p.xp, xpMax: xpToLevel(p), team: teamById(g.league, p.teamId).nameKo,
  };
}

/** 부상 복귀 예정 시점. 비시즌에 BALANCE.injury.offseasonWeeks 만큼 회복된다 */
function returnLabel(g: GameState): string {
  const inj = g.player.injury!;
  const { round, schedule } = g.league;
  if (g.phase === 'season') {
    const target = round + inj.weeksLeft;
    if (target < schedule.length) return `${target + 1}라운드`;
    const carry = inj.weeksLeft - (schedule.length - round) - BALANCE.injury.offseasonWeeks;
    return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 ${carry + 1}라운드`;
  }
  const carry = inj.weeksLeft - BALANCE.injury.offseasonWeeks;
  return carry <= 0 ? '다음 시즌 개막' : `다음 시즌 ${carry + 1}라운드`;
}

export interface BannerVM { tone: 'injury' | 'warning' | 'info' | 'success'; title: string; body?: string; action?: string; act?: string; to?: string }

function injuryBanner(g: GameState): BannerVM | null {
  const inj = g.player.injury;
  if (!inj) return null;
  return {
    tone: 'injury', title: `부상 (${INJURY_NAMES_KO[inj.grade]}) · ${inj.weeksLeft}주 남음`,
    body: `복귀 예정 ${returnLabel(g)}. 부상 중에는 경기에 나가지 못하고 재활 XP(주 ${BALANCE.injury.rehabXp})만 받아요.`,
  };
}

function pointsBanner(g: GameState): BannerVM | null {
  const n = g.player.unspentPoints;
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
    /** 결장(부상·출장 정지)이면 경기 버튼은 "결장(관전)" */
    out: boolean;
  };
  card: PlayerCardVM;
  condition: ConditionVM;
  stats: { apps: number; starts: number; goals: number; assists: number; avg: string };
  version: VersionVM;
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
      myTactic: teamTactic(my.id), oppTactic: teamTactic(opp.id), out: !!inj || p.suspended > 0,
    };
  }
  const pts = pointsBanner(g);
  if (pts) banners.push(pts);
  const s = p.season;
  const avg = averageRating(s);
  return {
    season: seasonLabel(g.league.season), round: Math.min(g.league.round + 1, g.league.schedule.length), rounds: g.league.schedule.length,
    phase: g.phase, banners, next, card: playerCardVM(g), condition: conditionVM(g),
    stats: { apps: s.apps, starts: s.starts, goals: s.goals, assists: s.assists, avg: avg === null ? '-' : avg.toFixed(2) },
    version: versionVM(g),
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
  groups: { name: string; rows: AttrRowVM[] }[];
  posOvrs: { pos: string; ovr: number; main: boolean; prof: number; penalty: number }[];
  badges: { id: string; name: string; desc: string; earned: string | null; progress: string }[];
  history: HistoryRowVM[];
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

export function positionOptionsVM(g: GameState): PositionOptionVM[] {
  const p = g.player;
  return PLAYABLE_POSITIONS.map((pos) => {
    const prof = Math.floor(proficiencyOf(p, pos));
    return { pos, ko: POSITION_NAMES_KO[pos], prof, ovr: proficientOvr(p, pos), penalty: Math.round(proficiencyPenalty(prof) * 10) / 10, current: pos === p.position };
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

export function playerVM(g: GameState): PlayerVM {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const ovrs = allPositionOvrs(p.attributes);
  const tier = reputationTier(p.reputation);
  const nx = nextReputationTier(p.reputation);
  const fx = g.phase === 'season' ? nextFixture(g) : null;
  return {
    name: p.name, position: p.position, positionKo: POSITION_NAMES_KO[p.position], age: p.age, ovr: playerOvr(p),
    team: teamById(g.league, p.teamId).nameKo,
    tier: designTier(tier), tierName: TIER_NAMES_KO[tier], reputation: p.reputation, repMax: BALANCE.reputation.max,
    next: nx ? { name: TIER_NAMES_KO[nx.tier], cut: nx.cut, from: BALANCE.reputation.tierCuts[tier] } : null,
    level: p.level, xp: p.xp, xpMax: xpToLevel(p), totalXp: p.totalXp,
    condition: conditionVM(g), suspended: p.suspended,
    nextOpp: fx ? teamById(g.league, fx.opponentId).nameKo : null,
    groups: GROUP_NAMES.map((grp) => ({
      name: GROUP_NAMES_KO[grp],
      rows: (ATTRIBUTE_GROUPS[grp] as readonly FieldAttribute[]).map((a) => ({ label: ATTRIBUTE_NAMES_KO[a], value: p.attributes[a], key: keys.includes(a) })),
    })),
    posOvrs: PLAYABLE_POSITIONS.map((pos) => {
      const prof = Math.floor(proficiencyOf(p, pos));
      return { pos, ovr: proficientOvr(p, pos), main: pos === p.position, prof, penalty: Math.round(proficiencyPenalty(prof) * 10) / 10 };
    }),
    badges: badgesVM(g),
    history: historyVM(g),
  };
}

// ── 포인트 찍기 (I.7) ──

export interface AllocRowVM { attr: FieldAttribute; label: string; value: number; raised: number; cost: number | null; ovrDelta: number | null; maxed: boolean; blocked: boolean; key: boolean }

export interface AllocateVM {
  points: number; position: string; startOvr: number; startExact: number; ovr: number; exact: number;
  cap: number; levels: number; tierName: string; cost1Max: number; cost2Max: number; coachComment: boolean;
  groups: { name: string; rows: AllocRowVM[] }[];
}

export function allocateVM(g: GameState, startExact: number, coachComment: boolean): AllocateVM {
  const p = g.player;
  const keys = profileOf(p.position).keys;
  const tier = costTier(p);
  const band = BALANCE.growth.costBands[tier];
  return {
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

const SCENE_NAMES: Record<Scene['kind'], string> = { goal: '골', chance: '결정적 기회', me: '내 장면', opponent: '상대 공격', shot: '슈팅' };

/** 장면 이름 (I.19 1번: "23' 골"): 핵심 순간의 분 + 장면 종류 */
export function sceneName(r: Replay, sc: Scene): string {
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
  xp: { gained: number; value: number; max: number; level: number; levelsGained: number };
  seasonOver: boolean;
  points: number;
}

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
  if (m.engine?.my && res.minutes > 0) {
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
    hasAvgMap: !!r, my,
    xp: { gained: res.xp, value, max, level: g.player.level, levelsGained: m.levelsGained },
    seasonOver: g.phase !== 'season', points: g.player.unspentPoints,
  };
}

// ── 월드: 순위표와 리그 스타 (I.10 일부) ──

export interface WorldVM {
  league: string; season: string; round: number; rounds: number; myPos: number; teams: number;
  table: { pos: number; team: string; played: number; won: number; drawn: number; lost: number; gd: string; points: number; me: boolean; rating: number }[];
  stars: { name: string; position: string; age: number; club: string; ovr: number; change: number }[];
  retired: string[];
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
  next: { name: string; cut: number; from: number; cost1Max: number; cost2Max: number } | null;
  position: string; ovrBefore: number; ovrAfter: number;
  autoGrowth: DeltaVM[]; veteran: DeltaVM[]; aging: DeltaVM[];
  growthAges: string; ageFrom: number; ageTo: number;
  retired: boolean; forcedRetire: boolean; canRetire: boolean; points: number;
  injury: BannerVM | null;
  badges: { name: string; desc: string }[];
}

export function seasonVM(g: GameState): SeasonVM | null {
  const s = g.lastSeasonSummary;
  if (!s) return null;
  const rec = g.player.history.at(-1)!;
  const tier = reputationTier(s.reputationAfter);
  const nx = nextReputationTier(s.reputationAfter);
  const A = BALANCE.growth.autoGrowth;
  return {
    season: seasonLabel(s.season), nextSeason: seasonLabel(s.season + 1), team: teamById(g.league, rec.teamId).nameKo, pos: s.leaguePosition,
    apps: rec.apps, goals: rec.goals, assists: rec.assists, avg: rec.apps ? (rec.ratingSum / rec.apps).toFixed(2) : '-',
    injuries: rec.injuries, injuredWeeks: rec.injuredWeeks,
    achievements: s.achievements, achievementXp: s.achievementXp, levelsGained: s.levelsGained,
    repBefore: s.reputationBefore, repAfter: s.reputationAfter, tierName: TIER_NAMES_KO[tier], tier: designTier(tier),
    next: nx ? { name: TIER_NAMES_KO[nx.tier], cut: nx.cut, from: BALANCE.reputation.tierCuts[tier], ...BALANCE.growth.costBands[nx.tier] } : null,
    position: g.player.position, ovrBefore: s.ovrBefore, ovrAfter: s.ovrAfter,
    autoGrowth: deltas(s.autoGrowth), veteran: deltas(s.veteranGrowth ?? {}), aging: deltas(s.aging),
    growthAges: `${A.minAge}~${A.maxAge}세`, ageFrom: s.age, ageTo: g.player.age,
    retired: g.phase === 'retired', forcedRetire: s.forcedRetire, canRetire: s.canRetire, points: g.player.unspentPoints,
    injury: g.phase === 'offseason' ? injuryBanner(g) : null,
    badges: (s.badges ?? []).map((b) => ({ name: BADGE_NAMES_KO[b.id], desc: BADGE_DESC_KO[b.id] })),
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
    reputation: g.player.reputation, tierName: TIER_NAMES_KO[reputationTier(g.player.reputation)], history: historyVM(g),
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

export interface NewGameForm { mode: 'prospect' | 'real'; name: string; position: string; seed: string; difficulty: string; realId: string }

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
  return {
    mode: f.mode, name: f.name, position: f.position,
    positions: PLAYABLE_POSITIONS.map((p) => ({ id: p, ko: POSITION_NAMES_KO[p] })),
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
