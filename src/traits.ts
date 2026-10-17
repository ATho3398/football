// 장점·단점 (pending 47 2, 부록 C.45): 커스텀 생성에서 고르고(장점 포인트 −, 단점 포인트 +), 랜덤 생성도 0~2개 붙는다(숨기지 않음).
// 효과는 이미 있는 시스템(부상·폼·피로·XP·연봉·경고·약발·노화)에 바로 걸고, 아직 없는 시스템(감독 신뢰도 5-1, 생활·이벤트 5-2,
// 연봉 협상, 해외 적응 6단계)은 hook 만 둔다 — 그 단계에서 traitHas 로 연결한다

import { BALANCE } from './config/balance';
import type { Rng } from './rng';

export const TRAIT_IDS = [
  // 단점
  'glass', 'managerSensitive', 'poorNegotiator', 'lateBloomer', 'inconsistent', 'hotHead', 'homesick', 'slowRecovery', 'mediaShy', 'weakFootOne',
  // 장점
  'ironMan', 'star', 'bigGame', 'linguist', 'leader', 'consistent', 'professional', 'resilient', 'twoFooted', 'evergreen',
] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

export interface TraitDef {
  id: TraitId;
  kind: 'pro' | 'con';
  ko: string;
  desc: string;
  /** 아직 없는 시스템이라 효과가 그 단계에서 붙는 장단점 (표시: "5-1 단계부터") */
  hook?: string;
  /** 같이 고를 수 없는 장단점 */
  excludes?: TraitId[];
}

export const TRAITS: Readonly<Record<TraitId, TraitDef>> = {
  glass: { id: 'glass', kind: 'con', ko: '유리몸', desc: '부상 확률 ×1.5', excludes: ['ironMan'] },
  managerSensitive: { id: 'managerSensitive', kind: 'con', ko: '감독 불화 민감', desc: '감독 신뢰도가 떨어지면 컨디션이 크게 −', hook: '5-1 감독 신뢰도' },
  poorNegotiator: { id: 'poorNegotiator', kind: 'con', ko: '협상 서툼', desc: '연봉 협상 1회만', hook: '연봉 협상' },
  lateBloomer: { id: 'lateBloomer', kind: 'con', ko: '늦은 개화', desc: '21세 전 XP ×0.8, 21세부터 ×1.1' },
  inconsistent: { id: 'inconsistent', kind: 'con', ko: '기복', desc: '폼 변동 ×1.5', excludes: ['consistent'] },
  hotHead: { id: 'hotHead', kind: 'con', ko: '다혈질', desc: '경고·퇴장 ×1.4' },
  homesick: { id: 'homesick', kind: 'con', ko: '향수병', desc: '해외 적응 기간 ×2', hook: '5-2 생활·6단계 해외 이적', excludes: ['linguist'] },
  slowRecovery: { id: 'slowRecovery', kind: 'con', ko: '체력 회복 느림', desc: '피로 회복 −20%', excludes: ['resilient'] },
  mediaShy: { id: 'mediaShy', kind: 'con', ko: '언론 울렁증', desc: '인터뷰 이벤트 부정 결과 ↑', hook: '5-2 이벤트·인터뷰' },
  weakFootOne: { id: 'weakFootOne', kind: 'con', ko: '약발 1', desc: '약발 1로 시작 (훈련·포인트로 올릴 수 있음)', excludes: ['twoFooted'] },
  ironMan: { id: 'ironMan', kind: 'pro', ko: '철강왕', desc: '부상 확률 ×0.6', excludes: ['glass'] },
  star: { id: 'star', kind: 'pro', ko: '스타 플레이어', desc: '연봉·몸값 +10%' },
  bigGame: { id: 'bigGame', kind: 'pro', ko: '빅매치 체질', desc: '더비·큰 경기 폼 +0.1' },
  linguist: { id: 'linguist', kind: 'pro', ko: '언어 천재', desc: '해외 적응 기간 ×0.5', hook: '5-2 생활·6단계 해외 이적', excludes: ['homesick'] },
  leader: { id: 'leader', kind: 'pro', ko: '리더', desc: '팀 불화 이벤트 ↓', hook: '5-2 이벤트' },
  consistent: { id: 'consistent', kind: 'pro', ko: '꾸준함', desc: '폼 변동 ×0.7', excludes: ['inconsistent'] },
  professional: { id: 'professional', kind: 'pro', ko: '프로 정신', desc: '훈련 XP +10%' },
  resilient: { id: 'resilient', kind: 'pro', ko: '회복력', desc: '피로 회복 +20%', excludes: ['slowRecovery'] },
  twoFooted: { id: 'twoFooted', kind: 'pro', ko: '양발잡이', desc: '약발 4로 시작', excludes: ['weakFootOne'] },
  evergreen: { id: 'evergreen', kind: 'pro', ko: '노익장', desc: '노화 하락 ×0.6 (38세 이후 가속분 포함)' },
};

/** 효과 수치는 BALANCE.traits */
export function traitHas(p: { traits?: readonly string[] } | null | undefined, id: TraitId): boolean {
  return !!p?.traits?.includes(id);
}

/** 커스텀 생성 포인트: 장점은 −, 단점은 + */
export function traitPoints(id: TraitId): number {
  const T = BALANCE.traits;
  return TRAITS[id].kind === 'pro' ? -T.proCost[id as keyof typeof T.proCost]! : T.conGain[id as keyof typeof T.conGain]!;
}

/** 고를 수 있는지 (최대 장점 2·단점 3, 서로 배타) */
export function canAddTrait(cur: readonly TraitId[], id: TraitId): boolean {
  if (cur.includes(id)) return false;
  const def = TRAITS[id];
  const T = BALANCE.traits;
  if (cur.filter((t) => TRAITS[t].kind === def.kind).length >= (def.kind === 'pro' ? T.maxPro : T.maxCon)) return false;
  return !cur.some((t) => TRAITS[t].excludes?.includes(id) || def.excludes?.includes(t));
}

/** 랜덤 생성 장단점 0~2개 (숨기지 않는다) */
export function rollTraits(rng: Rng): TraitId[] {
  const T = BALANCE.traits;
  const r = rng();
  let n = 0;
  for (let acc = 0; n < T.randomCountOdds.length; n++) {
    acc += T.randomCountOdds[n]!;
    if (r < acc) break;
  }
  const out: TraitId[] = [];
  for (let guard = 0; out.length < n && guard < 50; guard++) {
    const id = TRAIT_IDS[Math.floor(rng() * TRAIT_IDS.length)]!;
    if (canAddTrait(out, id)) out.push(id);
  }
  return out;
}

// ── 이미 있는 시스템에 거는 배율 ──

export function injuryMul(p: { traits?: readonly string[] }): number {
  const T = BALANCE.traits.effects;
  return (traitHas(p, 'glass') ? T.glassInjury : 1) * (traitHas(p, 'ironMan') ? T.ironManInjury : 1);
}

export function formMul(p: { traits?: readonly string[] }): number {
  const T = BALANCE.traits.effects;
  return (traitHas(p, 'inconsistent') ? T.inconsistentForm : 1) * (traitHas(p, 'consistent') ? T.consistentForm : 1);
}

/** 피로 회복 배율 (훈련·휴식의 회복량) */
export function recoveryMul(p: { traits?: readonly string[] }): number {
  const T = BALANCE.traits.effects;
  return (traitHas(p, 'slowRecovery') ? T.slowRecovery : 1) * (traitHas(p, 'resilient') ? T.resilient : 1);
}

/** XP 배율: 훈련이면 프로 정신, 나이에 따라 늦은 개화 */
export function xpMul(p: { traits?: readonly string[]; age: number }, training: boolean): number {
  const T = BALANCE.traits.effects;
  let m = 1;
  if (training && traitHas(p, 'professional')) m *= T.professionalXp;
  if (traitHas(p, 'lateBloomer')) m *= p.age < T.lateBloomerAge ? T.lateBloomerEarly : T.lateBloomerLate;
  return m;
}

export function wageMul(p: { traits?: readonly string[] }): number {
  return traitHas(p, 'star') ? BALANCE.traits.effects.starWage : 1;
}

export function cardMul(p: { traits?: readonly string[] }): number {
  return traitHas(p, 'hotHead') ? BALANCE.traits.effects.hotHeadCards : 1;
}

export function agingMul(p: { traits?: readonly string[] }): number {
  return traitHas(p, 'evergreen') ? BALANCE.traits.effects.evergreenAging : 1;
}

/** 큰 경기(더비) 폼 보정 */
export function bigGameForm(p: { traits?: readonly string[] }, big: boolean): number {
  return big && traitHas(p, 'bigGame') ? BALANCE.traits.effects.bigGameForm : 0;
}
