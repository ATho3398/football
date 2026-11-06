// 지시 카드 (부록 F.4·D.11 6번, C.75i): 직접 모드 소유 결정 순간의 4번째 선택지와 "감독의 신뢰" 사용 조건.
// 엔진 판정식은 그대로다: 지시 이행 = 엔진 효용 1위 후보를 그대로, 독단 = 보이는 후보 중 개인 가치(슛·돌파) 최대 후보를 그대로 실행한다.
// 보상(신뢰도·평점·XP)은 경기 뒤 "카드 보상"으로만 붙는다 (adapter.ts toMatchResult · game.ts, E.15.1 밖). 자동 경기에서는 쓰지 않는다.

import { BALANCE } from '../config/balance';
import { cardById, type CardDef } from '../config/cards';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import { emptyMod, type CardReport, type Variant } from './cards';
import type { Candidate } from './onball';
import type { SimState } from './state';

const D = () => BALANCE.cards.directive;

export type DirectiveMode = 'follow' | 'solo' | 'trust';

function directiveMode(def: CardDef): DirectiveMode | null {
  const e = def.effects.find((x) => x.type === 'directive');
  return e && e.type === 'directive' ? e.mode : null;
}

/** 지시 카드를 지금 못 쓰는 이유 (지시 카드가 아니면 null): 직접 모드에서만, 감독의 신뢰는 신뢰도 trustMin 이상 */
export function directiveProblem(s: SimState, def: CardDef): string | null {
  const mode = directiveMode(def);
  if (!mode) return null;
  if (s.moments.control.mode !== 'direct') return '직접 모드에서만 써요';
  if (mode === 'trust' && (s.cards?.trust ?? 0) < D().trustMin) return `감독 신뢰도 ${D().trustMin} 이상일 때만`;
  return null;
}

/** 독단이 고르는 개인 플레이 (슛·돌파·몰고 가기) */
const SOLO_TYPES = new Set(['shoot', 'dribble', 'carry']);

/** 보이는 후보 (C.40 maxP 를 넘는 확실한 선택지는 결정 순간에서 빠진다): 슛은 골 확률, 그 밖은 성공 확률 기준 */
function visible(cands: Candidate[]): Candidate[] {
  return cands.filter((c) => c.p <= ENGINE.moments.maxP + 1e-9);
}

/** 엔진 효용 1위 후보 (지시 이행) */
export function followCand(cands: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const c of visible(cands)) if (!best || c.u > best.u) best = c;
  return best;
}

/** 독단 후보: 보이는 개인 플레이 중 위치 가치 최대. 그것이 효용 1위이면 없음 */
export function soloCand(cands: Candidate[]): Candidate | null {
  const top = followCand(cands);
  let best: Candidate | null = null;
  for (const c of visible(cands)) if (SOLO_TYPES.has(c.type) && (!best || c.value > best.value)) best = c;
  return best && best !== top ? best : null;
}

/** 패의 지시 이행·독단 카드가 여는 4번째 선택지 (onballVariants 끝에 붙는다). 직접 모드 소유 결정 순간만 */
export function directiveVariants(s: SimState, cands: Candidate[]): Variant[] {
  const cs = s.cards;
  if (!cs || s.moments.control.mode !== 'direct') return [];
  const out: Variant[] = [];
  cs.hand.forEach((id, hand) => {
    const def = cardById(id);
    const mode = def ? directiveMode(def) : null;
    if (!def || (mode !== 'follow' && mode !== 'solo')) return;
    const base = mode === 'follow' ? followCand(cands) : soloCand(cands);
    if (!base) return;
    out.push({ hand, def, eff: { type: 'addOption', base: 'pass', label: def.name }, cand: { ...base }, mod: emptyMod(def.id), p: base.p, baseCand: base });
  });
  return out;
}

/** 경기 뒤 지시 카드 보상 (C.75i): 신뢰도 변화, 평점 사후 가산, XP 배수 */
export interface DirectiveReward {
  follow: number;
  soloOk: number;
  soloFail: number;
  trust: number;
  rating: number;
  xpMul: number;
}

export function directiveReward(report: CardReport | undefined): DirectiveReward | null {
  if (!report) return null;
  const R = D();
  let follow = 0;
  let soloOk = 0;
  let soloFail = 0;
  for (const u of report.uses) {
    if (u.auto) continue;
    if (u.id === 'dirFollow') follow++;
    else if (u.id === 'dirSolo' && u.result === 'success') soloOk++;
    else if (u.id === 'dirSolo' && u.result === 'fail') soloFail++;
  }
  if (!follow && !soloOk && !soloFail) return null;
  const trust = Math.min(R.followMax, follow * R.followTrust) - soloFail * R.soloFailTrust;
  return { follow, soloOk, soloFail, trust, rating: soloOk * R.soloRating, xpMul: soloOk ? R.soloXpMul : 1 };
}
