// 동료 호흡·상대 분석·패스 받는 빈도 (부록 C.74c, pending 77-1·77-3·125 c). 날씨(C.74a env)와 같은 틀:
// 게임 쪽(src/rapport.ts)이 BALANCE.chemistry·scouting·passTarget 에서 배율을 만들어 넘기고, 엔진은 판단(후보 효용·판단용 P)을
// 건드리지 않고 실행 판정에 곱한다. 패스 받는 빈도만 softmax 선택 가중(효용은 그대로)에 곱한다 (C.74c 결정 1).
// 없으면(호흡 0·관계 보통·리포트 없음) s.rapport = null → 이전 엔진과 같은 경기

import type { ActionType } from './onball';
import type { Agent, SimState } from './state';

/** 상대 분석 약점 → 실행 성공률이 오르는 내 행동. header = 내가 공격 쪽인 공중볼 경합 */
export type ExploitAction = Extract<ActionType, 'pass' | 'through' | 'dribble' | 'shoot' | 'cross'> | 'header';

export interface RapportInput {
  /** 동료 id → 그 동료와 주고받는 패스 실행 성공 배율 (≥ 1) */
  chem?: Record<string, number>;
  /** 동료 id → 그 동료가 나에게 패스할 선택 가중 배율 (0.9~1.1) */
  toMe?: Record<string, number>;
  /** 상대 분석 리포트: 나를 맡을 수비수 id, 약점 행동, 실행 배율. 그 수비수가 뛰는 동안만 */
  scout?: { defender: string; actions: ExploitAction[]; mul: number };
}

export interface Rapport {
  chem: Map<string, number>;
  toMe: Map<string, number>;
  scout: { defender: string; actions: Set<ExploitAction>; mul: number } | null;
}

export function resolveRapport(r: RapportInput | undefined): Rapport | null {
  if (!r) return null;
  const chem = new Map(Object.entries(r.chem ?? {}).filter(([, v]) => v !== 1));
  const toMe = new Map(Object.entries(r.toMe ?? {}).filter(([, v]) => v !== 1));
  const scout = r.scout && r.scout.mul !== 1 && r.scout.actions.length ? { defender: r.scout.defender, actions: new Set(r.scout.actions), mul: r.scout.mul } : null;
  return chem.size || toMe.size || scout ? { chem, toMe, scout } : null;
}

/** 동료 호흡: 내가 주거나 받는 패스면 그 동료와의 실행 배율 */
export function chemMul(s: SimState, passer: Agent, receiver: Agent | undefined): number {
  const r = s.rapport;
  if (!r || !receiver || !r.chem.size) return 1;
  if (passer.spec.isMe) return r.chem.get(receiver.id) ?? 1;
  if (receiver.spec.isMe) return r.chem.get(passer.id) ?? 1;
  return 1;
}

/** 상대 분석: 내 행동이 리포트의 약점이고 그 수비수가 뛰고 있으면 실행 배율 */
export function exploitMul(s: SimState, a: Agent, action: ExploitAction): number {
  return isExploit(s, a, action) ? s.rapport!.scout!.mul : 1;
}

export function isExploit(s: SimState, a: Agent, action: string): boolean {
  const sc = s.rapport?.scout;
  if (!sc || !a.spec.isMe || !sc.actions.has(action as ExploitAction)) return false;
  return s.agents.some((x) => x.id === sc.defender && x.onPitch);
}

/** 패스 받는 빈도: 동료가 나에게 주는 후보의 선택 가중 배율 */
export function toMeMul(s: SimState, passer: Agent, receiver: number): number {
  const r = s.rapport;
  if (!r || !r.toMe.size || receiver < 0 || passer.spec.isMe) return 1;
  const rc = s.agents[receiver];
  return rc?.spec.isMe ? r.toMe.get(passer.id) ?? 1 : 1;
}
