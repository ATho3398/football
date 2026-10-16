// 듀얼 (E.8): 드리블 1대1, 태클, 공중볼

import { ENGINE } from './config';
import { L1 } from './pitch';
import type { Agent } from './state';

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
export function dribbleProb(att: Agent, def: Agent, space = 0): number {
  const a = att.attrs;
  const d = def.attrs;
  const atk = a.dribbling * 0.5 + a.agility * 0.2 + a.acceleration * 0.15 + a.ballControl * 0.15;
  const dfn = d.tackling * 0.45 + d.defensivePositioning * 0.25 + d.pace * 0.15 + d.marking * 0.15;
  return duelTail(L1((atk - dfn) / PR.dribbleScale + PR.dribbleBias + space + att.duelEdge - def.duelEdge));
}

/** 박스 안 땅볼 수신 경합 (C.29 fix2 가설 B): 받는 선수 a 가 contestDist 안 수비수 b 를 이기고 공을 받을 확률 (받는 쪽 유리, 공중볼과 같은 구조) */
export function receiveWin(a: Agent, b: Agent): number {
  const t = a.attrs;
  const d = b.attrs;
  const atk = t.ballControl * 0.5 + t.strength * 0.3 + t.agility * 0.2;
  const dfn = d.marking * 0.5 + d.tackling * 0.3 + d.defensivePositioning * 0.2;
  return duelTail(L1((atk - dfn) / PR.receiveScale + PR.receiveBias + a.duelEdge - b.duelEdge));
}

export function aerialScore(a: Agent): number {
  return a.attrs.heading * 0.5 + a.attrs.jumping * 0.3 + a.attrs.strength * 0.2;
}

/** a 가 b 를 이길 확률 */
export function aerialWin(a: Agent, b: Agent): number {
  return duelTail(L1((aerialScore(a) - aerialScore(b)) / PR.aerialScale + a.duelEdge - b.duelEdge));
}
