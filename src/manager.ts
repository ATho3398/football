// 감독 신뢰도·면담 (18.2·18.3, 부록 C.62). 감독 = 선수 기용 담당: 신뢰도가 선발 점수에 들어가고, 면담으로 오르내린다.
// 팀 전술은 사용자가 정하므로 전술 자체에는 신뢰도 보너스/벌점이 없다 (D.11 6번). 엔진(src/engine)은 건드리지 않고
// 선발 판정(roundMatch·빠른 경기)의 OVR 입력에만 신뢰도 항을 더한다. 수치는 BALANCE.manager

import { dayNum, npcFatigueOn, npcSelectPenalty } from './npcFit';
import { BALANCE } from './config/balance';
import { managerOf, type ManagerData } from '../data/managers';
import { addDays, daysBetween, type IsoDate } from './calendar';
import { formBonus } from './form';
import { teamById } from './league';
import { startProbability } from './match';
import { slotsOf } from './formations';
import { PLAYABLE_POSITIONS, type FieldPosition } from './positions';
import { proficientOvr } from './proficiency';
import { slotOvr } from './roster';
import { createRng, hashSeed } from './rng';
import { startBonus, tagAt, tagHas } from './tags';
import { grantMeetingPick } from './cardCollection';
import { captainDownMul, coachOf } from './club';
import { lastPart, streakPart, styleWeights, youthPart, type StyleWeights } from './selection';
import { chemFrac } from './rapport';
import { environmentFixed } from './weather';
import { npcSelectBonus } from './selection';
import { npcConditions } from './npcFit';
import type { GameState } from './game';

const B = () => BALANCE.manager;
const MM = () => BALANCE.manager.meeting;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type MeetingKind = 'low' | 'reward' | 'position';
export type MeetingChoice = 'effort' | 'request' | 'complain' | 'start' | 'slot' | 'card' | 'follow' | 'decline';

/** 신뢰도 변화 한 줄 (홈 "최근 신뢰도 변화") */
export interface TrustEntry { season: number; date: IsoDate; delta: number; why: string }

export interface ManagerState {
  /** 이 신뢰도가 속한 팀. 팀이 바뀌면 새로 시작한다 (임대 포함) */
  teamId: string;
  trust: number;
  log: TrustEntry[];
  /** 신뢰도가 lowBelow 미만이 된 날 (회복하면 null) */
  lowSince: IsoDate | null;
  /** 지금 열린 면담 (하루가 끝날 때 다시 판정) */
  meeting: MeetingKind | null;
  /** 면담별 마지막으로 연 날 (낮은 신뢰 쿨다운) / 보상 면담을 한 반 시즌 키 "시즌:0|1" */
  lastLow?: IsoDate;
  rewardKeys: string[];
  /** 시즌 중반 출전 부족 면담을 연 시즌 */
  shareSeason?: number;
  /** 고른 슬롯 OVR 이 최고 포지션 OVR 보다 posGap 이상 낮은 채로 뛴 연속 경기 */
  posStreak: number;
  /** 면담 보상·결과: 주전 보장·선호 슬롯 보장 남은 경기, 노력 XP 보너스 끝나는 날, 감독이 주는 기회 남은 경기 */
  perks: { start?: number; slot?: number; effortUntil?: IsoDate; chance?: number };
  /** 감독 불화 민감 (C.62): 신뢰도가 떨어진 경기 다음 경기 폼 − */
  upset?: boolean;
  /** 마지막 면담 결과 (홈 한 줄, 닫으면 null) */
  result?: { date: IsoDate; title: string; text: string } | null;
}

/** 그 팀 감독 (경질로 바뀌었으면 새 감독, C.63) */
export function managerData(teamId: string, state?: Pick<GameState, 'coaches'>): ManagerData | null {
  return state ? coachOf(state, teamId) : managerOf(teamId);
}

function styleOf(state: Pick<GameState, 'coaches'>, teamId: string) {
  return coachOf(state, teamId)?.style ?? 'neutral';
}

/** 새 팀 시작 신뢰도 (18.2: 40~60) + 친정 선택(그 구단) + 유망주 중용 감독의 21세 이하 */
export function startTrust(state: GameState, teamId: string): number {
  const M = B();
  const p = state.player;
  const rating = teamById(state.league, teamId)?.rating ?? 70;
  let t = clamp(Math.round(M.start + (proficientOvr(p, p.position) - rating) * M.startPerOvr), M.startMin, M.startMax);
  if (tagAt(p, 'homeChoice', teamId)) t += M.tags.homeChoiceStart;
  if (styleOf(state, teamId) === 'youth' && p.age <= M.styles.youthAge) t += M.styles.youthStart;
  return clamp(t, 0, 100);
}

/** 지금 팀의 감독 상태 (없거나 팀이 바뀌었으면 새로 만든다) */
export function ensureManager(state: GameState): ManagerState {
  const teamId = state.player.teamId;
  if (!state.manager || state.manager.teamId !== teamId) {
    state.manager = { teamId, trust: startTrust(state, teamId), log: [], lowSince: null, meeting: null, rewardKeys: [], posStreak: 0, perks: {}, result: null };
  }
  return state.manager;
}

export function trustOf(state: GameState): number {
  return ensureManager(state).trust;
}

/** 신뢰도를 바꾼다 (태그·감독 성향 배율 뒤 반올림). 실제로 바뀐 값을 돌려준다 */
export function addTrust(state: GameState, raw: number, why: string, opts: { scaled?: boolean } = {}): number {
  const m = ensureManager(state);
  const d = opts.scaled === false ? raw : scaleDelta(state, raw);
  const before = m.trust;
  m.trust = clamp(Math.round((m.trust + d) * 10) / 10, 0, 100);
  const got = Math.round((m.trust - before) * 10) / 10;
  if (got !== 0) {
    m.log.push({ season: state.league.season, date: state.calendar.date, delta: got, why });
    if (m.log.length > B().logMax) m.log.splice(0, m.log.length - B().logMax);
  }
  return got;
}

/** 태그·감독 성향 배율 (18.2 + C.62 태그 표): 원클럽맨 하락 ×0.8(영원한 ×0.7), 문제아 하락 ×1.2, 컬트 히어로 상승 ×1.1, 엄격·주전 고정 감독 */
export function scaleDelta(state: GameState, d: number): number {
  const T = B().tags;
  const S = B().styles;
  const p = state.player;
  const teamId = p.teamId;
  let k = 1;
  if (d < 0) {
    if (tagAt(p, 'eternal', teamId)) k *= 1 - (1 - T.oneClubDown) * BALANCE.tags.story.eternalMul;
    else if (tagAt(p, 'oneClubMan', teamId)) k *= T.oneClubDown;
    if (tagHas(p, 'troublemaker')) k *= T.troublemakerDown;
    if (styleOf(state, teamId) === 'strict') k *= S.strictDown;
    k *= captainDownMul(state);
  } else if (tagAt(p, 'cultHero', teamId)) k *= T.cultHeroUp;
  if (styleOf(state, teamId) === 'steady') k *= S.steadyMul;
  return d * k;
}

// ── 선발 점수 (18.2 D.13) ──

/** 신뢰도 항 (OVR 단위) */
export function trustTerm(trust: number): number {
  return (trust - 50) * B().trustPerPoint;
}

/** 폼 항 (OVR 단위): 최근 평점 폼 × formScale, ±formMax */
export function formTerm(recent: readonly number[]): number {
  const M = B();
  return clamp(formBonus(recent) * M.formScale, -M.formMax, M.formMax);
}

/** 피로 항 (화면 분해용, 실제 선발 확률은 startProbability 의 피로 곱을 쓴다) */
export function fatigueTerm(fatigue: number): number {
  return fatigue >= B().fatigueFrom ? -B().fatigueMinus : 0;
}

/** 지금 팀 감독 기용 성향 가중 (C.79i) */
export function myStyleWeights(state: GameState): StyleWeights {
  return styleWeights(coachOf(state, state.player.teamId)?.style);
}

/** 동료 케미 항 (C.79i, OVR 단위): 같이 뛴 분 상위 3명 호흡 평균 × chemMax. 측정 고정·다른 팀 기록이면 0 */
export function chemTerm(state: GameState): number {
  const c = state.chem;
  if (!c || c.teamId !== state.player.teamId || environmentFixed()) return 0;
  const top = Object.values(c.mins).sort((a, b) => b - a).slice(0, 3);
  return top.length ? (top.reduce((t, v) => t + chemFrac(v), 0) / 3) * BALANCE.selection.chemMax : 0;
}

/** 내 클럽 경기 연속 선발 수 (matchLog 끝에서부터) */
export function myStartStreak(state: GameState): number {
  let n = 0;
  for (let i = state.matchLog.length - 1; i >= 0 && state.matchLog[i]!.started; i--) n++;
  return n;
}

/**
 * 선발 판정에 넣는 OVR 보정: 태그(원클럽맨·아카데미) + 신뢰도 + 폼 — 감독 기용 성향(C.79i)이 신뢰도·폼 배율과 직전 평점·케미·연속 선발·주전 고정 항을 더한다
 */
export function selectionBonus(state: GameState): number {
  const p = state.player;
  const w = myStyleWeights(state);
  const last = p.recentRatings.length ? p.recentRatings[p.recentRatings.length - 1]! : null;
  const streak = myStartStreak(state);
  return startBonus(p, p.teamId) + trustTerm(trustOf(state)) * w.trust + formTerm(p.recentRatings) * w.form + lastPart(last, w) + chemTerm(state)
    + streakPart(streak, w) + (streak > 0 ? w.keep : 0);
}

/** 감독 성향의 OVR·나이·피로 항 (C.79i): 오버롤 강조 × (OVR − 팀 레이팅), 유망주 가산, 피로 배율(기본 피로는 startProbability 곱이 맡고 그 나머지 몫) */
export function styleOvrBonus(state: GameState, ovr: number, teamRating: number, fatigue: number, oppRating: number | null = null): number {
  const w = myStyleWeights(state);
  return w.ovr * (ovr - teamRating) + youthPart(state.player.age, teamRating, oppRating, w)
    - Math.max(0, fatigue - BALANCE.fatigue.penaltyFrom) * BALANCE.fatigue.npc.selectPerPoint * (w.fatigue - 1);
}

/**
 * 이번 경기 선발 확률 (18.2): 기존 B.4 곡선(팀 레이팅 기준)에 선발 점수 보정(감독 성향 C.79i 포함)을 넣고, 면담 보상(선호 슬롯 보장 = 1, 주전 보장 = 최소 startFloor,
 * 불만 표출로 얻은 기회 = 1)을 건다. 1군 테스트는 호출 쪽에서 따로 보장. oppRating 을 주면 유망주 성향의 약한 상대 가산
 */
export function startChance(state: GameState, ovr: number, teamRating: number, fatigue: number, oppRating: number | null = null): number {
  const m = ensureManager(state);
  if ((m.perks.slot ?? 0) > 0 || (m.perks.chance ?? 0) > 0) return 1;
  const p = startProbability(ovr + selectionBonus(state) + styleOvrBonus(state, ovr, teamRating, fatigue, oppRating), teamRating, fatigue);
  return (m.perks.start ?? 0) > 0 ? Math.max(p, MM().startFloor) : p;
}

export interface ScoreRow { name: string; me: boolean; age: number; ovr: number; trust: number; form: number; fatigue: number; total: number; detail: string }

/** 주전 경쟁 (홈 카드, 18.2): 나와 그 슬롯 경쟁자 상위 n명의 선발 점수 분해 */
export function competition(state: GameState, pos: FieldPosition, n = 2): ScoreRow[] {
  const p = state.player;
  const M = B();
  const w = myStyleWeights(state);
  const rating = teamById(state.league, p.teamId)?.rating ?? 70;
  const base = proficientOvr(p, pos);
  const ovr = base + startBonus(p, p.teamId);
  const trust = trustTerm(trustOf(state)) * w.trust;
  // 시즌 누적 피로 (C.78t, 게겐 비용)까지 — 경기 선발 판정(matchFatigue)과 같은 값
  const fatigue = Math.min(BALANCE.fatigue.max, p.fatigue + (p.seasonFatigue ?? 0));
  // 폼 칸 = 감독 성향 항(C.79i: 최근·직전 평점, 케미, 연속 선발, 오버롤 강조, 유망주, 피로 배율 몫) — 선발 확률과 같은 식
  const form = selectionBonus(state) - startBonus(p, p.teamId) - trustTerm(trustOf(state)) * w.trust + styleOvrBonus(state, base, rating, fatigue);
  const fat = fatigueTerm(fatigue);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const me: ScoreRow = { name: p.name, me: true, age: p.age, ovr, trust: r1(trust), form: r1(form), fatigue: fat, total: r1(ovr + trust + form + fat), detail: '' };
  const roster = state.rosters?.[p.teamId]?.players ?? [];
  const npcTrust = r1(trustTerm(M.npcTrust));
  // NPC (C.77m 피로 · C.79i 감독 성향): 그 선수의 오늘 선발 점수 보정 (NPC 선발과 같은 식) — 피로 칸 = 피로 감점 × 성향 배율, 폼 칸 = 나머지
  const today = dayNum(state.calendar.date);
  const team = state.rosters?.[p.teamId];
  const cond = team ? npcConditions(state.npcFit, [team], today) : undefined;
  const style = coachOf(state, p.teamId)?.style;
  const rivals = roster.filter((x) => !x.gk).map((x) => {
    const o = slotOvr(x, pos);
    const fat = 0 - r1(npcSelectPenalty(npcFatigueOn(state.npcFit?.[x.id], today)) * w.fatigue);
    const frm = r1(npcSelectBonus(x, cond?.[x.id], { style, rating, oppRating: rating }) - fat);
    return { name: x.nameKo, me: false, age: x.age, ovr: o, trust: npcTrust, form: frm, fatigue: fat, total: r1(o + npcTrust + frm + fat), detail: '' };
  }).sort((a, b) => b.total - a.total).slice(0, n);
  return [me, ...rivals].sort((a, b) => b.total - a.total);
}

// ── 경기 뒤 신뢰도 (18.2) ──

export interface MatchTrustInput {
  minutes: number; started: boolean; rating: number | null; goals: number; assists: number;
  outcome: 'win' | 'draw' | 'loss'; yellows: number; red: boolean; injured: boolean; suspended: boolean;
  /** 이번 경기 슬롯 OVR, 최고 포지션 OVR (포지션 제안 면담) */
  slotOvr: number; bestOvr: number;
}

/** 내 경기 뒤: 신뢰도 변화(출전 경기만, 부상·정지·벤치 결장은 변화 없음), 면담 보상 경기 수, 포지션 연속, 감독 불화 민감. 바뀐 값 합 */
export function afterMyMatch(state: GameState, x: MatchTrustInput): number {
  const M = B();
  const m = ensureManager(state);
  const p = state.player;
  m.upset = false;
  if (x.injured || x.suspended || x.minutes <= 0) return 0;
  // 면담 보상은 출전 가능 경기마다 1씩 줄어든다
  for (const k of ['start', 'slot', 'chance'] as const) if ((m.perks[k] ?? 0) > 0) m.perks[k]! -= 1;
  const half = x.started ? 1 : 0.5;
  const parts: [number, string][] = [];
  if (x.rating !== null && x.rating >= M.ratingHigh) parts.push([M.ratingDelta * half, `평점 ${x.rating.toFixed(1)}`]);
  else if (x.rating !== null && x.rating < M.ratingLow) parts.push([-M.ratingDelta * half, `평점 ${x.rating.toFixed(1)}`]);
  const inv = Math.min(M.involvementMax, x.goals * M.goal + x.assists * M.assist);
  if (inv > 0) parts.push([inv, x.goals && x.assists ? `${x.goals}골 ${x.assists}도움` : x.goals ? `${x.goals}골` : `${x.assists}도움`]);
  if (x.outcome === 'win') parts.push([M.win, '승리']);
  else if (x.outcome === 'loss') parts.push([-M.loss, '패배']);
  if (x.red) parts.push([-M.red, '퇴장']);
  else if (x.yellows > 0) parts.push([-M.yellow, '경고']);
  const raw = parts.reduce((t, [d]) => t + d, 0);
  // 감독 기억 감쇠: 50 쪽으로 조금 (추천안)
  const back = (50 - m.trust) * M.reversion;
  const why = parts.length ? parts.map(([, w]) => w).join(' · ') : '무난한 경기';
  // 경기 한 줄로 (감쇠 포함)
  const got = addTrust(state, scaleDelta(state, raw) + back, why, { scaled: false });
  if (got < 0 && tagHas(p, 'managerSensitive')) m.upset = true;
  // 포지션 제안 (18.3): 고른 슬롯 OVR 이 최고 포지션보다 posGap 이상 낮은 채로 뛴 경기
  m.posStreak = x.slotOvr <= x.bestOvr - MM().posGap ? m.posStreak + 1 : 0;
  return got;
}

/** 감독 불화 민감: 신뢰도가 떨어진 경기 다음 경기 폼 − (matchForm 에서 뺀다) */
export function upsetForm(state: GameState): number {
  return state.manager?.upset && state.manager.teamId === state.player.teamId ? B().tags.sensitiveForm : 0;
}

/** 최고 포지션과 그 OVR (숙련도 반영) */
export function bestPosition(state: GameState): { pos: FieldPosition; ovr: number } {
  const p = state.player;
  let best: { pos: FieldPosition; ovr: number } = { pos: p.position as FieldPosition, ovr: proficientOvr(p, p.position as FieldPosition) };
  for (const pos of PLAYABLE_POSITIONS) {
    const o = proficientOvr(p, pos);
    if (o > best.ovr) best = { pos, ovr: o };
  }
  return best;
}

// ── 면담 (18.3) ──

function teamShare(state: GameState): number | null {
  const games = state.matchLog.length;
  if (games < 1) return null;
  const s = state.player.season;
  return Math.min(s.starts / games, s.minutes / (games * 90));
}

const halfKey = (state: GameState) => `${state.league.season}:${state.league.round >= MM().midRound ? 1 : 0}`;

/** 지금 열 수 있는 면담 (우선순위: 낮은 신뢰 > 포지션 제안 > 보상) */
export function meetingDue(state: GameState): MeetingKind | null {
  if (state.phase !== 'season' || state.trial) return null;
  const m = ensureManager(state);
  const date = state.calendar.date;
  const lowLong = m.lowSince !== null && daysBetween(m.lowSince, date) >= MM().lowDays;
  const share = teamShare(state);
  const shareLow = state.league.round >= MM().midRound && m.shareSeason !== state.league.season && share !== null && share < MM().minShare;
  const lowCool = !m.lastLow || daysBetween(m.lastLow, date) >= MM().lowCooldown;
  if ((lowLong && lowCool) || shareLow) return 'low';
  if (m.posStreak >= MM().posGames && bestPosition(state).pos !== myPos(state)) return 'position';
  if (m.trust >= MM().rewardFrom && !m.rewardKeys.includes(halfKey(state))) return 'reward';
  return null;
}

function myPos(state: GameState): FieldPosition {
  return slotsOf(state.tactics.formation, state.tactics.custom)[state.tactics.mySlot]!.pos as FieldPosition;
}

/** 하루가 끝날 때 (endDay): 낮은 신뢰 기간, 열린 면담 다시 판정 */
export function managerDayEnd(state: GameState): void {
  if (state.phase !== 'season') return;
  const m = ensureManager(state);
  if (m.trust < MM().lowBelow) m.lowSince ??= state.calendar.date;
  else m.lowSince = null;
  m.meeting = meetingDue(state);
}

/** 오늘 면담할 수 있는지 (하루 행동: 경기 날·휴가에는 안 됨) */
export function meetingBlocked(state: GameState, dayKind: string): string | null {
  if (!ensureManager(state).meeting) return '지금은 열린 면담이 없어요';
  if (dayKind === 'match') return '경기 날에는 면담할 수 없어요';
  if (dayKind === 'vacation') return '휴가 중에는 면담할 수 없어요';
  return null;
}

export interface MeetingOption { id: MeetingChoice; icon: 'player' | 'card' | 'star' | 'train' | 'swap' | 'danger' | 'check' | 'close'; title: string; desc: string; tag?: string; disabled?: string }

/** 면담 선택지 (18.3). request 는 이적 요청 가능 여부(호출 쪽에서 계산)를 받는다 */
export function meetingOptions(state: GameState, kind: MeetingKind, request: { ok: boolean; reason: string }): MeetingOption[] {
  const X = MM();
  if (kind === 'low') {
    return [
      { id: 'effort', icon: 'train', title: '더 노력하겠다', desc: `신뢰도 +${X.effortTrust}, ${X.effortDays}일 동안 훈련 XP ×${X.effortXp}` },
      { id: 'request', icon: 'swap', title: '이적을 요청한다', desc: '구단이 놓아주면 이적 명단에 올라요 (시즌에 한 번)', ...(request.ok ? {} : { disabled: request.reason }) },
      { id: 'complain', icon: 'danger', title: '불만을 표출한다', desc: `신뢰도 −${X.complainTrust}. 감독이 마음을 바꿔 기회를 줄 수도 있어요 (${Math.round(X.complainChance * 100)}%)` },
    ];
  }
  if (kind === 'reward') {
    return [
      { id: 'slot', icon: 'player', title: '선호 슬롯 보장', desc: `다음 ${X.slotGames}경기 동안 내가 고른 위치(${myPos(state)})에서 선발로 나가요.`, tag: `신뢰도 ${X.rewardFrom}+` },
      { id: 'card', icon: 'card', title: '카드 선택권 +1', desc: '희귀 카드 3장 중 1장을 골라요. (덱은 이미 최대 14장이라 덱 슬롯 대신)' },
      { id: 'start', icon: 'star', title: '주전 보장', desc: `다음 ${X.startGames}경기 동안 주전 경쟁 점수와 상관없이 선발 확률 ${Math.round(X.startFloor * 100)}% 이상.` },
    ];
  }
  const best = bestPosition(state);
  const has = slotsOf(state.tactics.formation, state.tactics.custom).some((s) => s.pos === best.pos);
  return [
    { id: 'follow', icon: 'check', title: `${best.pos}로 뛰겠다`, desc: `전술의 내 위치를 ${best.pos} 자리로 옮겨요. 신뢰도 +${X.posTrust}`, ...(has ? {} : { disabled: `지금 포메이션에 ${best.pos} 자리가 없어요 (전술에서 포메이션을 바꿔요)` }) },
    { id: 'decline', icon: 'close', title: '지금 자리가 좋다', desc: '변화 없음 (강제하지 않아요)' },
  ];
}

/** 감독 대사 (디자인 45 말풍선) */
export function meetingLine(state: GameState, kind: MeetingKind): string {
  const m = ensureManager(state);
  if (kind === 'reward') return '"요즘 경기력 좋다. 팀에 잘 녹아들고 있어. 원하는 게 있으면 하나 말해 봐."';
  if (kind === 'position') return `"${bestPosition(state).pos}에서 뛸 때 더 좋아 보이던데. 그 자리로 옮겨 보는 건 어때?"`;
  return m.trust < MM().lowBelow ? '"요즘 기대만큼 못 하고 있어. 할 말 있으면 해 봐."' : '"출전이 적어서 답답하지? 네 생각을 듣고 싶다."';
}

export interface MeetingResult { title: string; text: string; request?: boolean }

/**
 * 면담을 한다 (하루 행동): 그날 훈련 대신 면담(오늘 계획 = 휴식). 결과 문구를 돌려준다.
 * request 는 호출 쪽(transfer.requestTransfer)이 이어서 처리한다
 */
export function holdMeeting(state: GameState, choice: MeetingChoice, ctx: { requestOk?: boolean; position?: string; seed?: string } = {}): MeetingResult {
  const m = ensureManager(state);
  const kind = m.meeting;
  if (!kind) throw new Error('열린 면담이 없음');
  const X = MM();
  const date = state.calendar.date;
  const t = state.training;
  if (t && !t.overrides[date]) t.overrides[date] = 'rest';
  let r: MeetingResult;
  if (kind === 'low') {
    m.lastLow = date;
    if (teamShare(state) !== null && state.league.round >= X.midRound) m.shareSeason = state.league.season;
    if (choice === 'effort') {
      const d = addTrust(state, X.effortTrust, '면담 · 더 노력하겠다', { scaled: false });
      m.perks.effortUntil = addDays(date, X.effortDays - 1);
      r = { title: '감독이 고개를 끄덕였어요', text: `신뢰도 +${d}. ${X.effortDays}일 동안 훈련 XP ×${X.effortXp}.` };
    } else if (choice === 'request') {
      if (!ctx.requestOk) throw new Error('이적 요청 불가');
      r = { title: '이적을 요청했어요', text: '구단의 답을 기다려요.', request: true };
    } else if (choice === 'complain') {
      const d = addTrust(state, -X.complainTrust, '면담 · 불만 표출');
      const lucky = createRng(hashSeed(`${state.worldSeed}:complain:${date}`))() < X.complainChance;
      if (lucky) m.perks.chance = X.complainGames;
      r = lucky
        ? { title: '"좋아, 기회를 주지."', text: `신뢰도 ${d}. 감독이 다음 ${X.complainGames}경기 선발 기회를 줬어요.` }
        : { title: '감독이 언짢아해요', text: `신뢰도 ${d}. 출전은 경기력으로 보여 줘야 해요.` };
    } else throw new Error('없는 선택');
  } else if (kind === 'reward') {
    m.rewardKeys.push(halfKey(state));
    if (choice === 'slot') {
      m.perks.slot = X.slotGames;
      r = { title: '선호 슬롯 보장', text: `다음 ${X.slotGames}경기 ${myPos(state)} 자리에서 선발로 나가요.` };
    } else if (choice === 'start') {
      m.perks.start = X.startGames;
      r = { title: '주전 보장', text: `다음 ${X.startGames}경기 선발 확률 ${Math.round(X.startFloor * 100)}% 이상.` };
    } else if (choice === 'card') {
      if (state.cards) grantMeetingPick(state.cards, `${halfKey(state)}`, ctx.position ?? state.player.position, ctx.seed ?? state.worldSeed, '감독 면담 보상');
      r = { title: '카드 선택권 +1', text: '덱 화면에서 희귀 카드 3장 중 1장을 골라요.' };
    } else throw new Error('없는 선택');
  } else {
    m.posStreak = 0;
    if (choice === 'follow') {
      const best = bestPosition(state);
      const i = slotsOf(state.tactics.formation, state.tactics.custom).findIndex((s) => s.pos === best.pos);
      if (i < 0) throw new Error('그 자리가 없음');
      state.tactics = { ...state.tactics, mySlot: i };
      const d = addTrust(state, X.posTrust, `면담 · ${best.pos} 제안 수락`, { scaled: false });
      r = { title: `${best.pos}로 옮겼어요`, text: `신뢰도 +${d}. 전술의 내 위치가 ${best.pos}로 바뀌었어요.` };
    } else if (choice === 'decline') {
      r = { title: '지금 자리를 지켜요', text: '감독은 강요하지 않았어요. 신뢰도 변화 없음.' };
    } else throw new Error('없는 선택');
  }
  m.meeting = null;
  m.result = { date, title: r.title, text: r.text };
  return r;
}

/** 훈련 XP 배율 (더 노력하겠다 기간) */
export function trainingXpMul(state: GameState, date: IsoDate): number {
  const m = state.manager;
  if (!m || m.teamId !== state.player.teamId || !m.perks.effortUntil) return 1;
  return daysBetween(date, m.perks.effortUntil) >= 0 ? MM().effortXp : 1;
}

/** 다음 면담 조건 한 줄 (홈 카드 맨 아래) */
export function nextMeetingHint(state: GameState): string {
  const m = ensureManager(state);
  const X = MM();
  if (m.meeting === 'reward') return `보상 면담이 열렸어요 · 신뢰도 ${Math.round(m.trust)}`;
  if (m.meeting === 'low') return '감독 면담이 열렸어요 · 출전·신뢰 문제';
  if (m.meeting === 'position') return `포지션 제안 면담이 열렸어요 · ${bestPosition(state).pos}`;
  if (m.trust >= X.rewardFrom) return `보상 면담 · 이번 반 시즌은 이미 했어요 (다음: ${state.league.round >= X.midRound ? '다음 시즌' : `${X.midRound + 1}R부터`})`;
  if (m.trust < X.lowBelow) return `신뢰도 ${X.lowBelow} 미만 ${X.lowDays}일이면 면담이 열려요${m.lowSince ? ` (${daysBetween(m.lowSince, state.calendar.date)}일째)` : ''}`;
  return `보상 면담 · 신뢰도 ${X.rewardFrom} 이상 (지금 ${Math.round(m.trust)}, ${Math.ceil(X.rewardFrom - m.trust)} 남음)`;
}

/**
 * 재계약 판정 보정 (C.62, 재계약 판정을 받는 선수만 — C.46 커스텀): 저니맨 실패 +journeyRenew, 신뢰도 낮음 실패 +lowRenew,
 * 신뢰도 높음이면 실패를 highKeep 확률로 뒤집는다. 실패 여부를 돌려준다
 */
export function renewalTrust(state: GameState, fails: boolean): boolean {
  const T = B().tags;
  const m = state.manager && state.manager.teamId === state.player.teamId ? state.manager : null;
  const trust = m?.trust ?? 50;
  const rng = createRng(hashSeed(`${state.worldSeed}:renew-trust:${state.league.season}`));
  if (fails) return !(trust >= MM().rewardFrom && rng() < T.highKeep);
  const extra = (tagHas(state.player, 'journeyman') ? T.journeyRenew : 0) + (trust < MM().lowBelow ? T.lowRenew : 0);
  return extra > 0 && rng() < extra;
}

/** 영원한 <구단> 주장 후보 (C.62, 표시만): 그 구단 영원한 태그 + 신뢰도 rewardFrom 이상 */
export function captainCandidate(state: GameState): boolean {
  const p = state.player;
  return !!tagAt(p, 'eternal', p.teamId) && trustOf(state) >= MM().rewardFrom;
}
