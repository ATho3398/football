// 듀얼 (E.8): 드리블 1대1, 태클, 공중볼

import { ENGINE } from './config';
import { L1 } from './pitch';
import type { Agent } from './state';

const PR = ENGINE.prob;

/** 드리블 성공 확률. space 는 공간 보정 (양수 = 여유) */
export function dribbleProb(att: Agent, def: Agent, space = 0): number {
  const a = att.attrs;
  const d = def.attrs;
  const atk = a.dribbling * 0.5 + a.agility * 0.2 + a.acceleration * 0.15 + a.ballControl * 0.15;
  const dfn = d.tackling * 0.45 + d.defensivePositioning * 0.25 + d.pace * 0.15 + d.marking * 0.15;
  return L1((atk - dfn) / PR.dribbleScale + PR.dribbleBias + space + att.duelEdge - def.duelEdge);
}

export function aerialScore(a: Agent): number {
  return a.attrs.heading * 0.5 + a.attrs.jumping * 0.3 + a.attrs.strength * 0.2;
}

/** a 가 b 를 이길 확률 */
export function aerialWin(a: Agent, b: Agent): number {
  return L1((aerialScore(a) - aerialScore(b)) / PR.aerialScale + a.duelEdge - b.duelEdge);
}
