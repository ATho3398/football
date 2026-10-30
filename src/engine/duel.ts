// 듀얼 (E.8): 드리블 1대1, 태클, 공중볼

// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as pitch_ from './pitch';
const { L1 } = pitch_;
import * as physics_ from './physics';
const { duelEdgeOf } = physics_;
import type { Agent } from './state';
import type { FieldAttributes } from '../attributes';

const PR = ENGINE.prob;

/** 1대1 경합 확률의 끝 눕히기 (E.24 4번): 능력치 차가 아주 커도 duelMax 를 넘지 않고, 1 − duelMax 아래로 내려가지 않는다 */
export function duelTail(p: number): number {
  if (!PR.duelTail) return p;
  const k = PR.duelKnee;
  const w = PR.duelMax - k;
  if (p > k) return k + w * Math.tanh((p - k) / w);
  if (p < 1 - k) return 1 - k - w * Math.tanh((1 - k - p) / w);
  return p;
}

/** 드리블 성공 확률. space 는 공간 보정 (양수 = 여유) */
export function dribbleProb(att: Agent, def: Agent, space = 0, fit = 0): number {
  const a = att.attrs;
  const d = def.attrs;
  // 전술 적합도 (C.80e): fit = 공격 쪽 돌파 보너스 − 수비 쪽 태클 보너스 (능력치 점수, fit.ts)
  const atk = a.dribbling * 0.5 + a.agility * 0.2 + a.acceleration * 0.15 + a.ballControl * 0.15 + fit;
  const dfn = d.tackling * 0.45 + d.defensivePositioning * 0.25 + d.pace * 0.15 + d.marking * 0.15;
  return duelTail(L1((atk - dfn) / PR.dribbleScale + PR.dribbleBias + space + duelEdgeOf(att) - duelEdgeOf(def)));
}

/** 박스 안 땅볼 수신 경합 (C.29 fix2 가설 B): 받는 선수 a 가 contestDist 안 수비수 b 를 이기고 공을 받을 확률 (받는 쪽 유리, 공중볼과 같은 구조) */
export function receiveWin(a: Agent, b: Agent): number {
  const t = a.attrs;
  const d = b.attrs;
  const atk = t.ballControl * 0.5 + (t.strength + a.body.strength) * 0.3 + t.agility * 0.2;
  const dfn = d.marking * 0.5 + d.tackling * 0.3 + d.defensivePositioning * 0.2;
  return duelTail(L1((atk - dfn) / PR.receiveScale + PR.receiveBias + duelEdgeOf(a) - duelEdgeOf(b)));
}

export function aerialScore(a: Agent): number {
  // 키 (C.45): 공중볼 점수 + (키 − 기준) × aerialPerCm, 몸무게: 근력 몫에 몸싸움 보정
  return a.attrs.heading * 0.5 + a.attrs.jumping * 0.3 + (a.attrs.strength + a.body.strength) * 0.2 + a.body.aerial;
}

/** a 가 b 를 이길 확률. fit = 전술 적합도 공중 보너스 차 (a − b, 능력치 점수, C.80e) */
export function aerialWin(a: Agent, b: Agent, fit = 0): number {
  return duelTail(L1((aerialScore(a) - aerialScore(b) + fit) / PR.aerialScale + duelEdgeOf(a) - duelEdgeOf(b)));
}

/**
 * 마무리 능력치 (E.20 7번): 슈팅(중거리는 중거리 슛, 헤더는 헤더, 프리킥은 프리킥) × 0.6 + 침착성 × 0.25 + 결정력 × 0.15.
 * C.76a: onball 과 offball(위협 가중 수비) 이 같이 쓰므로 순환 import 없는 이 모듈에 둔다 (onball 이 다시 내보낸다)
 */
export function finishSkill(t: FieldAttributes, kind: 'shot' | 'long' | 'header' | 'freeKick'): number {
  const main = kind === 'long' ? t.longShots : kind === 'header' ? t.heading : kind === 'freeKick' ? t.freeKick : t.shooting;
  return main * 0.6 + t.composure * 0.25 + t.bigMatch * 0.15;
}
