// 경기 외 생활 (pending 47 4번, 부록 C.63 b): 숨은 생활 지표 4개 (0~100) — 가정 안정 · 적응도 · 팀 관계 · 멘탈 피로(높을수록 나쁨).
// 영향은 엔진 밖 (경기 입력 폼 lifeForm · 피로 회복 lifeRecoveryMul)에서만. 해결은 하루 행동(훈련 대신, LIFE_KINDS). 수치는 BALANCE.life
// 숨은 지표라 숫자는 화면에 보이지 않고, 홈 "내 상태"에 문장 힌트(lifeHints)만

import { BALANCE } from './config/balance';
import { createRng, hashSeed } from './rng';
import { tagAt, tagHas } from './tags';
import { addTag } from './startClub';
import { A_GRADE_PLAYERS } from '../data/players';
import { LEGEND_BY_ID } from './legends';
import type { GameState } from './game';
import type { DayPlan } from './training';

export type LifeKey = 'home' | 'adapt' | 'team' | 'mental';
export const LIFE_KEYS: readonly LifeKey[] = ['home', 'adapt', 'team', 'mental'];

/** 생활 하루 행동 (훈련과 같은 칸) */
export const LIFE_KINDS = ['family', 'language', 'teamMeal', 'therapy', 'trip', 'media'] as const;
export type LifeKind = (typeof LIFE_KINDS)[number];
export const isLifeKind = (k: string): k is LifeKind => (LIFE_KINDS as readonly string[]).includes(k);

export interface LifeState {
  home: number;
  adapt: number;
  team: number;
  mental: number;
  /** 지금 지표가 속한 팀 (팀이 바뀌면 적응도·팀 관계를 새로 시작) */
  teamId: string;
  /** 미디어 인터뷰 좋은 결과 / 나쁜 결과 수 (언론의 총아) */
  mediaGood: number;
  mediaBad: number;
  /** 이번 시즌 생활 이벤트 수 (시즌 상한) */
  events: number;
}

const L = () => BALANCE.life;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** 내 국적: 커스텀 선택 > 실제 선수·레전드 데이터 > 유망주 기본(한국) */
export function myNationality(p: GameState['player']): string {
  if (p.nationality) return p.nationality;
  const real = p.realPlayerId ? A_GRADE_PLAYERS.find((d) => d.id === p.realPlayerId)?.nationality : undefined;
  return real ?? (p.legendId ? LEGEND_BY_ID.get(p.legendId)?.nationality : undefined) ?? 'Korea Republic';
}

/** 외국인 선수: 내 리그 국가 국적이 아님 (C.75m, 옛 세이브·국가 없음 = 잉글랜드) */
export const isForeign = (state: Pick<GameState, 'player' | 'league'>): boolean => myNationality(state.player) !== (state.league.country ?? 'England');

/** 새 팀 적응도·팀 관계 시작값 */
function teamStart(state: GameState, first: boolean): { adapt: number; team: number } {
  const p = state.player;
  const A = L().adapt;
  const loyal = tagAt(p, 'loyalReturn', p.teamId);
  // 첫 시즌 실제 선수는 이미 그 구단에서 뛰던 선수
  const settled = first && !!(p.realPlayerId || p.legendId);
  const foreign = isForeign(state);
  const adapt = loyal || settled ? (loyal ? A.loyalStart : A.settledStart) : foreign ? A.foreignStart : A.domesticStart;
  const team = loyal ? L().team.loyalTeam : settled ? L().start.team : L().team.newTeam;
  return { adapt, team };
}

export function ensureLife(state: GameState): LifeState {
  const teamId = state.player.teamId;
  if (!state.life) {
    const t = teamStart(state, true);
    state.life = { home: L().start.home, adapt: t.adapt, team: t.team, mental: L().start.mental, teamId, mediaGood: 0, mediaBad: 0, events: 0 };
  } else if (state.life.teamId !== teamId) {
    const t = teamStart(state, false);
    Object.assign(state.life, { adapt: t.adapt, team: t.team, teamId });
  }
  return state.life;
}

export function lifeVar(state: GameState, k: LifeKey): number {
  return Math.round(ensureLife(state)[k]);
}

/** 팀 관계 하한 (원클럽맨) */
function teamFloor(state: GameState): number {
  return tagAt(state.player, 'oneClubMan', state.player.teamId) || tagAt(state.player, 'eternal', state.player.teamId) ? L().team.oneClubFloor : 0;
}

/** 생활 지표 더하기 (0~100). 실제로 바뀐 값 (정수 반올림) */
export function addLife(state: GameState, k: LifeKey, d: number): number {
  const l = ensureLife(state);
  const before = l[k];
  l[k] = clamp(r1(l[k] + d), k === 'team' ? teamFloor(state) : 0, 100);
  return Math.round(l[k] - before);
}

/** 하루 끝 (dayStep 뒤): 기준값 쪽으로 · 적응 · 멘탈 피로 (그날 계획에 따라) */
export function lifeDayEnd(state: GameState, kind: DayPlan): void {
  const l = ensureLife(state);
  const D = L().drift;
  const p = state.player;
  l.home = r1(l.home + (D.homeTo - l.home) * D.homeRate);
  const lead = tagHas(p, 'leader') || tagHas(p, 'lockerLeader') || state.captain?.teamId === p.teamId ? D.leaderTo : 0;
  l.team = clamp(r1(l.team + (D.teamTo + lead - l.team) * D.teamRate), teamFloor(state), 100);
  if (l.adapt < 100) {
    const A = L().adapt;
    const mul = (tagHas(p, 'homesick') ? A.homesickMul : 1) * (tagHas(p, 'linguist') ? A.linguistMul : 1);
    l.adapt = clamp(r1(l.adapt + A.perDay * mul), 0, 100);
  }
  const M = L().mental;
  const d = kind === 'match' ? 0 : kind === 'rest' || kind === 'rehab' ? M.rest : kind === 'vacation' ? M.vacation : kind === 'recovery' ? M.recovery : M.other;
  l.mental = clamp(r1(l.mental + (M.baseTo - l.mental) * M.baseRate + d + (p.fatigue >= M.fatigueFrom ? M.fatigueAdd : 0)), 0, 100);
}

/** 내 경기 뒤: 출전했으면 멘탈 피로 + (큰 경기 더) */
export function lifeAfterMatch(state: GameState, played: boolean, big: boolean): void {
  if (!played) return;
  const M = L().mental;
  addLife(state, 'mental', M.match + (big ? M.big : 0));
}

/** 경기 입력 폼 보정 (엔진 밖): 지표가 낮으면 −, 높으면 + (합 ±formMax) */
export function lifeForm(state: GameState): number {
  if (!state.life) return 0;
  const E = L().effects;
  const l = ensureLife(state);
  let f = 0;
  for (const k of ['home', 'adapt', 'team'] as const) if (l[k] < E.low) f += E.lowForm[k];
  if (l.home >= E.high) f += E.highForm.home;
  if (l.team >= E.high) f += E.highForm.team;
  if (l.mental >= E.mentalMax) f += E.mentalMaxForm;
  else if (l.mental >= E.mentalHigh) f += E.mentalForm;
  else if (l.mental <= E.mentalLow) f += E.mentalLowForm;
  return Math.round(clamp(f, -E.formMax, E.formMax) * 100) / 100;
}

/** 피로 회복 배율: 멘탈 피로가 높으면 덜 회복 */
export function lifeRecoveryMul(state: Pick<GameState, 'life'>): number {
  const l = state.life;
  return l && l.mental >= L().effects.mentalHigh ? L().effects.mentalRecovery : 1;
}

/**
 * 판단 스탯 생활 페널티 (C.75i, BALANCE.life.judge): 엔진 입력의 내 시야·침착성에서 뺄 값 (0~99 척도, 0 이상).
 * 정신 상태(100 − 멘탈 피로)가 from 미만이면 비례, 외국인은 적응도도 같은 식, 합 최대 max. 엔진 코드는 그대로 (입력만)
 */
export function lifeJudgePenalty(state: GameState): number {
  if (!state.life) return 0;
  const J = L().judge;
  const l = state.life;
  let pen = Math.max(0, J.from - (100 - l.mental)) * J.per;
  if (isForeign(state)) pen += Math.max(0, J.from - l.adapt) * J.per;
  return Math.round(Math.min(J.max, pen) * 10) / 10;
}

/** 하루 행동 결과 (dayStep): 효과를 걸고 한 줄 */
export function lifeAction(state: GameState, kind: LifeKind, date: string): string {
  const A = L().actions;
  const p = state.player;
  switch (kind) {
    case 'family': addLife(state, 'home', A.family.home); addLife(state, 'mental', A.family.mental); return '가족과 저녁을 먹었어요. 마음이 편해요';
    case 'language': addLife(state, 'adapt', A.language.adapt); return '현지어 수업을 들었어요. 동료들 말이 조금 더 들려요';
    case 'teamMeal': addLife(state, 'team', A.teamMeal.team); addLife(state, 'mental', A.teamMeal.mental); return '동료들과 식사했어요. 라커룸이 가까워졌어요';
    case 'therapy': addLife(state, 'mental', A.therapy.mental); return '심리 상담을 받았어요. 머리가 가벼워졌어요';
    case 'trip': addLife(state, 'mental', A.trip.mental); addLife(state, 'home', A.trip.home); return '짧은 휴식 여행을 다녀왔어요';
    case 'media': {
      const M = A.media;
      const l = ensureLife(state);
      const chance = clamp(M.good * (tagHas(p, 'mediaShy') ? M.shyMul : 1) * (tagHas(p, 'mediaDarling') ? M.darlingMul : 1), 0.05, 0.95);
      addLife(state, 'mental', M.mental);
      if (createRng(hashSeed(`${state.worldSeed}:media:${date}`))() < chance) {
        l.mediaGood++;
        p.reputation += M.goodRep;
        return `인터뷰가 좋은 반응을 얻었어요 (위상 +${M.goodRep})`;
      }
      l.mediaBad++;
      p.reputation = Math.max(0, p.reputation + M.badRep);
      return `인터뷰에서 말이 꼬였어요 (위상 −${-M.badRep})`;
    }
  }
}

/** 생활 이벤트 시즌 상한에 닿았는지 */
export function lifeEventsFull(state: GameState): boolean {
  return ensureLife(state).events >= L().eventsPerSeason[state.difficulty];
}

/** 새 시즌: 생활 이벤트 수를 비운다 */
export function lifeSeasonStart(state: GameState): void {
  ensureLife(state).events = 0;
}

/** 홈 "내 상태" 힌트 문장 (숨은 지표를 숫자 없이) */
export function lifeHints(state: GameState): string[] {
  if (!state.life) return [];
  const E = L().effects;
  const l = state.life;
  const out: string[] = [];
  if (l.mental >= E.mentalHigh) out.push('머리가 무거워요 · 휴식 여행이나 심리 상담');
  if (l.home < E.low) out.push('집 생각이 많아요 · 가족과 시간');
  if (l.adapt < E.low) out.push('아직 낯설어요 · 외국어 공부');
  if (l.team < E.low) out.push('라커룸이 서먹해요 · 동료와 식사');
  if (lifeJudgePenalty(state) > 0) out.push('집중이 흐트러져요 · 경기 중 판단(시야·침착성)이 조금 무뎌져요');
  return out;
}

/** 시즌 끝: 플레이 태그 — 라커룸 리더(주장 n시즌째 또는 팀 관계 최고) · 언론의 총아(인터뷰 좋은 결과 n번) */
export function lifeSeasonEnd(state: GameState): void {
  const N = L().natural;
  const l = ensureLife(state);
  const p = state.player;
  const capSeasons = state.captain?.teamId === p.teamId ? state.league.season - state.captain.since + 1 : 0;
  if (!tagHas(p, 'lockerLeader') && (capSeasons >= N.lockerSeasons || l.team >= N.lockerTeam)) addTag(state, 'lockerLeader', '라커룸 리더');
  if (!tagHas(p, 'mediaDarling') && l.mediaGood >= N.darlingGood) addTag(state, 'mediaDarling', '언론의 총아');
}
