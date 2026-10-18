// 시즌 목표와 카드 해금 (18.9, 부록 C.65): 시즌 시작 목표 3개(감독 · 구단 · 개인, 쉬움/보통/어려움),
// 진행 표시(홈 · 인박스), 시즌 끝 판정 → XP · 카드 3택 1 · 감독 신뢰도, 업적(시상 · 리그 우승 · 레전드 배지) 카드 선택권.
// 목표 값은 내 위상·팀 수준(시즌 전 레이팅 순위)·지난 시즌 기록에서 정한다. 경기 결과에는 손대지 않는다 (엔진 밖)

import { BALANCE } from './config/balance';
import type { Rarity } from './config/cards';
import { grantTierPick } from './cardCollection';
import { addXp, reputationTier, veteranXpMultiplier } from './growth';
import { leaguePosition, teamById } from './league';
import { addTrust, startChance } from './manager';
import { pushInbox } from './inbox';
import { proficientOvr } from './proficiency';
import { posGroup } from './roster';
import { createRng, hashSeed } from './rng';
import { myRank, seasonAwards } from './worldStats';
import type { GameState } from './game';
import { BADGE_NAMES_KO } from './badges';
import type { Badge } from './types';

const G = () => BALANCE.goals;

export type GoalTier = 'easy' | 'normal' | 'hard';
export type GoalSource = 'manager' | 'club' | 'personal';
export type GoalKind = 'apps' | 'rating' | 'moms' | 'teamPos' | 'goals' | 'assists' | 'ga' | 'cleanSheets' | 'goalRank' | 'assistRank';

export const TIER_KO: Record<GoalTier, string> = { easy: '쉬움', normal: '보통', hard: '어려움' };
export const SOURCE_KO: Record<GoalSource, string> = { manager: '감독', club: '구단', personal: '개인' };
const TIER_PICK_KO: Record<GoalTier, string> = { easy: '일반', normal: '희귀', hard: '희귀·에픽' };

export interface SeasonGoal {
  source: GoalSource;
  tier: GoalTier;
  kind: GoalKind;
  /** 목표 값 (팀 순위·득점 순위는 "이 순위 안", 평점은 "이 값 이상", 나머지는 "이 수 이상") */
  target: number;
}

export interface GoalResult extends SeasonGoal {
  value: number | null;
  met: boolean;
  xp: number;
  trust: number;
}

export interface GoalsState {
  season: number;
  teamId: string;
  list: SeasonGoal[];
  /** 시즌 끝 판정 (한 번만) */
  results?: GoalResult[];
  /** 이번 시즌 업적 카드 선택권 이름 (시즌 끝) */
  awards?: string[];
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** "이 순위 안"처럼 작을수록 좋은 목표 */
export const lowerIsBetter = (k: GoalKind) => k === 'teamPos' || k === 'goalRank' || k === 'assistRank';

/** 목표 글 (홈 · 인박스 · 시즌 요약) */
export function goalLabel(g: Pick<SeasonGoal, 'kind' | 'target'>): string {
  switch (g.kind) {
    case 'apps': return `리그 ${g.target}경기 출전`;
    case 'rating': return `평균 평점 ${g.target.toFixed(1)} 이상 (${G().ratingMinApps}경기 이상)`;
    case 'moms': return `MOM ${g.target}회`;
    case 'teamPos': return g.target === 1 ? '리그 우승' : `리그 ${g.target}위 안`;
    case 'goals': return `리그 ${g.target}골`;
    case 'assists': return `리그 ${g.target}도움`;
    case 'ga': return `골+도움 ${g.target}개`;
    case 'cleanSheets': return `클린시트 ${g.target}경기 (${G().csMinutes}분 이상)`;
    case 'goalRank': return g.target === 1 ? '리그 득점왕' : `리그 득점 순위 ${g.target}위 안`;
    case 'assistRank': return g.target === 1 ? '리그 도움왕' : `리그 도움 순위 ${g.target}위 안`;
  }
}

/** 지금 값 글 */
export function valueLabel(kind: GoalKind, v: number | null): string {
  if (v === null) return kind === 'rating' ? '평점 -' : '순위 밖';
  if (kind === 'rating') return v.toFixed(2);
  if (lowerIsBetter(kind)) return `${v}위`;
  return String(v);
}

// ── 기대값 ──

interface Expect { apps: number; start: number; goals: number; assists: number; moms: number; cs: number; rating: number; teamPos: number }

function expectations(state: GameState): Expect {
  const { player, league } = state;
  const C = G();
  const n = league.schedule.length;
  const team = teamById(league, player.teamId);
  const ovr = proficientOvr(player, player.position);
  const diff = ovr - team.rating;
  const start = startChance(state, ovr, team.rating, 0);
  const priorApps = n * (start + (1 - start) * BALANCE.match.subChance * 0.8);
  const last = player.history.at(-1);
  const w = last && last.apps > 0 ? last.apps : 0;
  const apps = Math.round((priorApps * C.priorApps + (last?.apps ?? priorApps) * w) / (C.priorApps + w));
  const mul = clamp(1 + diff * C.ovrK, 0.5, 1.8);
  const [rg, ra, rm] = C.rates[posGroup(player.position)] ?? [0.1, 0.1, 0.06];
  // 경기당 = (사전값 × priorApps + 지난 시즌 합) / (priorApps + 지난 시즌 출전)
  const per = (prior: number, lastTotal: number) => (prior * C.priorApps + (w ? lastTotal : 0)) / (C.priorApps + w);
  const ratingPrior = clamp(C.ratingBase + diff * C.ratingK, C.ratingMin, C.ratingMax);
  const lastAvg = last && last.apps > 0 ? last.ratingSum / last.apps : ratingPrior;
  const teams = league.teams.length;
  const teamPos = 1 + league.teams.filter((t) => t.rating > team.rating).length;
  const csRate = C.csBase + C.csTop * (teams - teamPos) / Math.max(1, teams - 1);
  return {
    apps, start,
    goals: apps * per(rg * mul, last?.goals ?? 0),
    assists: apps * per(ra * mul, last?.assists ?? 0),
    moms: apps * per(rm * mul, last?.moms ?? 0),
    cs: apps * csRate * (posGroup(player.position) === 'GK' || ['CB', 'FB', 'CDM'].includes(posGroup(player.position)) ? 1 : 0),
    rating: (ratingPrior * C.priorApps + lastAvg * w) / (C.priorApps + w),
    teamPos,
  };
}

function pickKind(state: GameState, source: GoalSource, tier: GoalTier, e: Expect, rng: () => number): GoalKind {
  if (source === 'club') return 'teamPos';
  if (source === 'manager') return e.start < G().appsBelow ? 'apps' : rng() < 0.6 ? 'rating' : 'moms';
  const grp = posGroup(state.player.position);
  // 득점·도움 순위 목표는 다른 경기 기록이 쌓일 때만 (빠른 진행이면 내 기록뿐이라 순위가 뜻이 없다)
  const star = !state.options.quickOthers && ['normal', 'special', 'topClass', 'worldClass', 'legendary'].indexOf(reputationTier(state.player.reputation, state.player.honors)) >= G().rankFromTier;
  if (grp === 'ST' || grp === 'WING') return tier === 'hard' && star ? 'goalRank' : 'goals';
  if (grp === 'CAM' || grp === 'CM') return tier === 'hard' && star ? 'assistRank' : grp === 'CAM' ? 'ga' : (e.assists >= e.goals ? 'assists' : 'ga');
  return 'cleanSheets';
}

function targetOf(state: GameState, kind: GoalKind, tier: GoalTier, e: Expect): number {
  const C = G();
  const d = C.difficulty[state.difficulty];
  const n = state.league.schedule.length;
  const teams = state.league.teams.length;
  const count = (v: number) => Math.max(1, Math.round(v * C.mult[tier] * d.mult));
  switch (kind) {
    case 'apps': return clamp(Math.round(e.apps * C.appsMul[tier] * d.mult), 3, n);
    case 'rating': return round1(clamp(e.rating + C.ratingAdd[tier] + (d.mult - 1), 5.8, 8.5));
    case 'moms': return count(e.moms);
    case 'teamPos': return clamp(e.teamPos + C.posAdd[tier] - d.pos, 1, teams - 3);
    case 'goals': return count(e.goals);
    case 'assists': return count(e.assists);
    case 'ga': return count(e.goals + e.assists);
    case 'cleanSheets': return count(e.cs);
    case 'goalRank': case 'assistRank': return C.rankTarget;
  }
}

/** 시즌 목표 3개 (결정적: 세계 시드 · 시즌 · 팀) */
export function makeGoals(state: GameState): SeasonGoal[] {
  const rng = createRng(hashSeed(`${state.worldSeed}:goals:${state.league.season}:${state.player.teamId}`));
  const tiers: GoalTier[] = ['easy', 'normal', 'hard'];
  for (let i = tiers.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiers[i], tiers[j]] = [tiers[j]!, tiers[i]!];
  }
  const e = expectations(state);
  return (['manager', 'club', 'personal'] as GoalSource[]).map((source, i) => {
    const tier = tiers[i]!;
    const kind = pickKind(state, source, tier, e, rng);
    return { source, tier, kind, target: targetOf(state, kind, tier, e) };
  });
}

/** 시즌 시작 (newGame · startNextSeason): 목표를 정하고 인박스로 알린다 */
export function goalsSeasonStart(state: GameState): GoalsState {
  const gs: GoalsState = { season: state.league.season, teamId: state.player.teamId, list: makeGoals(state) };
  state.goals = gs;
  pushInbox(state, {
    cat: 'goal', key: `goals:${gs.season}`, title: `${gs.season} 시즌 목표 3개`,
    body: `${gs.list.map((g) => `${SOURCE_KO[g.source]}(${TIER_KO[g.tier]}): ${goalLabel(g)}`).join(' · ')}. 달성하면 XP와 카드 3택 1(쉬움 일반 · 보통 희귀 · 어려움 에픽까지)을 받아요.`,
    link: { to: 'home', label: '홈에서 진행 보기' },
  });
  return gs;
}

/** 시즌 중 목표 (옛 세이브 · 시즌 중 이적이면 이번 시즌 목표를 새로 만든다). 비시즌에는 지난 시즌 목표 */
export function ensureGoals(state: GameState): GoalsState | null {
  const gs = state.goals;
  if (state.phase !== 'season') return gs ?? null;
  if (gs && gs.season === state.league.season) return gs;
  return goalsSeasonStart(state);
}

/** 다른 팀 선수 기록이 있는가 (전체 엔진 진행). 없으면 득점 순위·시상은 내 기록뿐이라 순위 목표·시상 선택권을 판정하지 않는다 */
export function hasLeagueStats(state: GameState): boolean {
  const mine = new Set((state.rosters[state.player.teamId]?.players ?? []).map((p) => p.id));
  return Object.keys(state.playerStats).filter((id) => !mine.has(id)).length >= G().leagueStatsMin;
}

/** 클린시트: 60분 이상 뛴 경기 무실점 */
export function cleanSheets(state: GameState): number {
  return state.matchLog.filter((m) => m.minutes >= G().csMinutes && m.goalsAgainst === 0).length;
}

/** 지금 값 */
export function goalValue(state: GameState, kind: GoalKind): number | null {
  const s = state.player.season;
  switch (kind) {
    case 'apps': return s.apps;
    case 'rating': return s.apps > 0 ? s.ratingSum / s.apps : null;
    case 'moms': return s.moms;
    case 'teamPos': return leaguePosition(state.league, state.player.teamId);
    case 'goals': return s.goals;
    case 'assists': return s.assists;
    case 'ga': return s.goals + s.assists;
    case 'cleanSheets': return cleanSheets(state);
    case 'goalRank': return s.goals > 0 && hasLeagueStats(state) ? myRank(state, 'goals') : null;
    case 'assistRank': return s.assists > 0 && hasLeagueStats(state) ? myRank(state, 'assists') : null;
  }
}

/** 지금 기준 달성인가 (시즌 끝 판정과 같은 식) */
export function goalMet(state: GameState, g: SeasonGoal, value = goalValue(state, g.kind)): boolean {
  if (value === null) return false;
  if (g.kind === 'rating') return state.player.season.apps >= G().ratingMinApps && value >= g.target - 1e-9;
  return lowerIsBetter(g.kind) ? value <= g.target : value >= g.target;
}

export type GoalStatus = 'done' | 'track' | 'behind' | 'start';

export interface GoalProgress extends SeasonGoal { label: string; value: number | null; valueText: string; status: GoalStatus; ratio: number; reward: string }

/**
 * 진행 (홈 · 인박스 중간 점검): 셈 목표는 남은 경기 속도로, 순위·평점은 지금 값으로 판단.
 * done = 셈 목표를 이미 채움(시즌 끝까지 그대로), track = 지금 페이스면 달성, behind = 모자람, start = 아직 경기 전
 */
export function goalProgress(state: GameState, g: SeasonGoal): GoalProgress {
  const value = goalValue(state, g.kind);
  const n = state.league.schedule.length;
  const played = Math.max(1, state.league.round);
  const counting = !lowerIsBetter(g.kind) && g.kind !== 'rating';
  if (state.league.round === 0) return { ...g, label: goalLabel(g), value: null, valueText: '-', status: 'start', ratio: 0, reward: `XP ${xpOf(state, g.tier)} · ${TIER_PICK_KO[g.tier]} 카드 3택 1` };
  let status: GoalStatus;
  let ratio: number;
  if (counting) {
    const v = value ?? 0;
    ratio = clamp(v / g.target, 0, 1);
    status = v >= g.target ? 'done' : v / played * n >= g.target ? 'track' : 'behind';
  } else {
    const met = goalMet(state, g, value);
    status = met ? 'track' : 'behind';
    ratio = value === null ? 0 : g.kind === 'rating' ? clamp((value - 5.5) / Math.max(0.1, g.target - 5.5), 0, 1) : clamp((n / 2 + 1 - value) / Math.max(1, n / 2 + 1 - g.target), 0, 1);
  }
  return { ...g, label: goalLabel(g), value, valueText: valueLabel(g.kind, value), status, ratio, reward: `XP ${xpOf(state, g.tier)} · ${TIER_PICK_KO[g.tier]} 카드 3택 1` };
}

/** 목표 XP = 기본 × 게임 난이도 × 고령 감쇠 (6.1, 경기 XP와 같은 배율 — 노화 곡선을 덮지 않게) */
export function xpOf(state: GameState, tier: GoalTier): number {
  return Math.round(G().xp[tier] * BALANCE.difficulty[state.difficulty].xp * veteranXpMultiplier(state.player.age));
}

/** 경기 뒤 (playRound): 중간 점검 인박스 한 번 */
export function goalsAfterRound(state: GameState): void {
  const gs = ensureGoals(state);
  if (!gs || state.league.round !== G().midRound) return;
  const rows = gs.list.map((g) => goalProgress(state, g));
  const ok = rows.filter((r) => r.status === 'done' || r.status === 'track').length;
  pushInbox(state, {
    cat: 'goal', key: `goals-mid:${gs.season}`, title: `시즌 목표 중간 점검 · ${ok}/3 순항`,
    body: rows.map((r) => `${SOURCE_KO[r.source]} ${r.label} — 지금 ${r.valueText}${r.status === 'done' ? ' (달성)' : r.status === 'track' ? ' (순항)' : ' (모자람)'}`).join(' · '),
    link: { to: 'home', label: '홈에서 보기' },
  });
}

const AWARD_KO: Record<string, string> = { goals: '득점왕', assists: '도움왕', rating: '최고 평점', young: '영플레이어' };

/**
 * 시즌 끝 (endSeason, 기록 저장 전 · 시상 계산 가능할 때): 목표 판정 → XP · 카드 선택권 · 신뢰도, 업적 선택권, 인박스 결과.
 * 판정은 한 번만 (같은 시즌 결과가 있으면 그대로 돌려준다)
 */
export function goalsSeasonEnd(state: GameState, badges: readonly Badge[] = []): { results: GoalResult[]; awards: string[]; xp: number; levels: number } {
  const gs = ensureGoals(state);
  if (!gs) return { results: [], awards: [], xp: 0, levels: 0 };
  if (gs.results) return { results: gs.results, awards: gs.awards ?? [], xp: 0, levels: 0 };
  const C = G();
  const season = state.league.season;
  const pos = state.player.position;
  const sameTeam = gs.teamId === state.player.teamId;
  let xp = 0;
  const results: GoalResult[] = gs.list.map((g, i) => {
    const value = goalValue(state, g.kind);
    const met = goalMet(state, g, value);
    const gx = met ? xpOf(state, g.tier) : 0;
    xp += gx;
    if (met && state.cards) grantTierPick(state.cards, `goal:${season}:${i}`, pos, state.worldSeed, `${season} 시즌 목표 · ${TIER_KO[g.tier]} 달성`, C.pick[g.tier] as Partial<Record<Rarity, number>>, 'goal');
    const [up, down] = C.trust[g.source] ?? [0, 0];
    const trust = sameTeam ? addTrust(state, met ? up : down, `시즌 목표 ${met ? '달성' : '실패'} (${SOURCE_KO[g.source]} · ${goalLabel(g)})`, { scaled: false }) : 0;
    return { ...g, value, met, xp: gx, trust };
  });
  const levels = xp > 0 ? addXp(state.player, xp) : 0;

  // 업적 선택권 (18.9 큰 업적)
  const awards: string[] = [];
  const A = C.awardPick;
  const grant = (key: string, label: string, r: Rarity) => {
    if (state.cards && grantTierPick(state.cards, `award:${season}:${key}`, pos, state.worldSeed, label, { [r]: 1 }, 'award')) awards.push(label);
  };
  const won = hasLeagueStats(state) ? seasonAwards(state).filter((a) => a.me) : [];
  if (won[0]) grant('award', `${season} 시즌 ${won.map((a) => AWARD_KO[a.kind]).join(' · ')}`, A.award as Rarity);
  if (leaguePosition(state.league, state.player.teamId) === 1) grant('title', `${season} 시즌 리그 우승`, A.leagueTitle as Rarity);
  if (badges.length) grant('badge', `레전드 배지 · ${badges.map((b) => BADGE_NAMES_KO[b.id] ?? b.id).join(' · ')}`, A.legendBadge as Rarity);

  gs.results = results;
  gs.awards = awards;
  const met = results.filter((r) => r.met).length;
  pushInbox(state, {
    cat: 'goal', key: `goals-end:${season}`, title: `${season} 시즌 목표 ${met}/3 달성`,
    body: `${results.map((r) => `${r.met ? '달성' : '실패'} · ${SOURCE_KO[r.source]} ${goalLabel(r)} (${valueLabel(r.kind, r.value)})`).join(' · ')}.${xp ? ` XP +${xp}.` : ''}${met || awards.length ? ` 카드 선택권 ${met + awards.length}장 — 덱에서 골라요.` : ''}`,
    link: met || awards.length ? { to: 'deck', label: '카드 고르기' } : { to: 'season', label: '시즌 요약' },
  });
  return { results, awards, xp, levels };
}

/** 앞으로 챔스·발롱도르·월드컵(5-6·6단계)이 부르는 업적 선택권 훅 */
export function grantAchievementPick(state: GameState, kind: 'clWin' | 'ballonDor' | 'worldCup', label: string): boolean {
  if (!state.cards) return false;
  return grantTierPick(state.cards, `award:${state.league.season}:${kind}`, state.player.position, state.worldSeed, label, { [G().awardPick[kind] as Rarity]: 1 }, 'award');
}
