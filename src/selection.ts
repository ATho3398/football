// 감독 성향별 선수 기용 (부록 C.79i, pending 143): 선발 점수 = 슬롯 OVR + 성향 가중 항(OVR 단위).
// NPC 선발은 pickLineup 의 penalty(= −이 점수 보정)로, 내 선수는 startChance 의 선발 점수 보정으로 같은 항을 쓴다.
// 항: 오버롤 강조(자연 OVR − 팀 레이팅) · 최근 5경기 평점 · 직전 평점 · 피로(50 넘은 만큼) · 감독 관계 · 동료 케미(내 선수만) ·
// 유망주 가산 · 연속 선발 감점 · 직전 경기 선발 가산. 수치·성향 배율은 BALANCE.selection. 엔진 판단·실행과 무관(선발 입력만)

import { BALANCE } from './config/balance';
import { npcSelectPenalty, type NpcCond } from './npcFit';
import { naturalOvr, type RosterPlayer } from './roster';
import type { ManagerStyle } from '../data/managers';

const S = () => BALANCE.selection;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type StyleWeights = (typeof BALANCE.selection.styles)[string];

export function styleWeights(style: ManagerStyle | null | undefined): StyleWeights {
  const t = S().styles;
  return t[style ?? 'neutral'] ?? t.neutral!;
}

/** 최근 평점 평균 항 (평점 1점당 formPerPoint, ±formMax) × 성향 배율 */
export function formPart(avg: number | null, w: StyleWeights): number {
  if (avg === null) return 0;
  const X = S();
  return clamp((avg - BALANCE.form.pivot) * X.formPerPoint, -X.formMax, X.formMax) * w.form;
}

/** 직전 평점 항 × 성향 배율 */
export function lastPart(last: number | null, w: StyleWeights): number {
  if (last === null) return 0;
  const X = S();
  return clamp((last - BALANCE.form.pivot) * X.lastPerPoint, -X.lastMax, X.lastMax) * w.last;
}

/** 연속 선발 감점 (로테이션): streakFrom 경기째 선발이 될 때부터 1경기당 streak. 직전까지 연속 선발 수를 받는다 */
export function streakPart(streak: number, w: StyleWeights): number {
  const next = streak + 1;
  return next >= S().streakFrom ? -(next - S().streakFrom + 1) * w.streak : 0;
}

/** 유망주 가산: youthAge 이하 + 약한 상대(우리보다 youthWeakGap 이상 낮음) 더 */
export function youthPart(age: number, rating: number, oppRating: number | null, w: StyleWeights): number {
  if (!w.youth || age > S().youthAge) return 0;
  return w.youth + (oppRating !== null && rating - oppRating >= S().youthWeakGap ? S().youthWeakOpp : 0);
}

export interface NpcSelectCtx {
  style: ManagerStyle | null | undefined;
  /** 우리 팀 레이팅 · 상대 레이팅 */
  rating: number;
  oppRating: number;
}

/**
 * NPC 선수 선발 점수 보정 (OVR 단위, + = 유리). cond 는 그날 컨디션(없으면 쌩쌩·기록 없음).
 * 피로는 기존 NPC 선발 감점(npcSelectPenalty) × 성향 배율, 감독 관계는 NPC 가 모두 같아(npcTrust) 순서에 무관해 넣지 않는다
 */
export function npcSelectBonus(p: RosterPlayer, c: NpcCond[string] | undefined, ctx: NpcSelectCtx): number {
  const w = styleWeights(ctx.style);
  let v = w.ovr * (naturalOvr(p) - ctx.rating);
  v += youthPart(p.age, ctx.rating, ctx.oppRating, w);
  if (!c) return v;
  v -= npcSelectPenalty(c[0]) * w.fatigue;
  const last = c[2] ? c[2] / 10 : null;
  const avg = c[3] ? c[3] / 10 : null;
  v += formPart(avg, w) + lastPart(last, w);
  const streak = c[4] ?? 0;
  v += streakPart(streak, w);
  if (streak > 0) v += w.keep;
  return v;
}

/** pickLineup 의 penalty (점수에서 뺀다) */
export function npcSelectPenaltyFn(roster: { players: readonly RosterPlayer[] }, cond: NpcCond | undefined, ctx: NpcSelectCtx): (id: string) => number {
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  return (id) => {
    const p = byId.get(id);
    return p ? -npcSelectBonus(p, cond?.[id], ctx) : 0;
  };
}
