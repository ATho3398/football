// 역할 파라미터 (E.6 표). dx, dy 는 정규화 오프셋, run/drop/press 는 0~1, pref 는 온더볼 효용 배수

import type { FieldAttributes } from '../attributes';
import type { Position } from '../types';

export interface RolePrefs {
  shoot: number;
  pass: number;
  dribble: number;
  cross: number;
  /** 안전 패스(뒤/옆) */
  safe: number;
  /** 전진 패스 */
  forward: number;
  clear: number;
  /** 크로스 수신/헤더 */
  header: number;
}

export interface Role {
  id: string;
  dx: number;
  dy: number;
  run: number;
  drop: number;
  press: number;
  pref: RolePrefs;
}

const p = (o: Partial<RolePrefs> = {}): RolePrefs => ({
  shoot: 1, pass: 1, dribble: 1, cross: 1, safe: 1, forward: 1, clear: 1, header: 1, ...o,
});
const r = (id: string, dx: number, dy: number, run: number, drop: number, press: number, pref: RolePrefs): Role => ({
  id, dx, dy, run, drop, press, pref,
});

export const ROLES: Record<string, Role> = {
  poacher: r('poacher', 0.03, 0, 0.8, 0.1, 0.4, p({ shoot: 1.3 })),
  targetMan: r('targetMan', 0, 0, 0.3, 0.3, 0.4, p({ header: 1.4 })),
  linkUp: r('linkUp', -0.08, 0, 0.4, 0.8, 0.5, p({ pass: 1.2, shoot: 0.8 })),
  winger: r('winger', 0, 0.3, 0.5, 0.2, 0.4, p({ cross: 1.4, dribble: 1.1 })),
  insideForward: r('insideForward', 0.04, -0.2, 0.7, 0.2, 0.4, p({ shoot: 1.3 })),
  playmaker: r('playmaker', -0.05, -0.1, 0.3, 0.7, 0.3, p({ pass: 1.3 })),
  shadowStriker: r('shadowStriker', 0.06, 0, 0.8, 0.1, 0.4, p({ shoot: 1.3 })),
  boxCrasher: r('boxCrasher', 0.04, 0, 0.7, 0.2, 0.4, p({ shoot: 1.1 })),
  boxToBox: r('boxToBox', 0, 0, 0.6, 0.4, 0.8, p()),
  deepPlaymaker: r('deepPlaymaker', -0.08, 0, 0.1, 0.8, 0.4, p({ pass: 1.4 })),
  advanced8: r('advanced8', 0.05, 0, 0.6, 0.2, 0.5, p({ shoot: 1.1 })),
  anchor: r('anchor', -0.04, 0, 0.1, 0.4, 0.6, p({ safe: 1.2 })),
  ballWinner: r('ballWinner', 0, 0, 0.2, 0.2, 0.9, p()),
  dlpDm: r('dlpDm', -0.06, 0, 0.1, 0.8, 0.4, p({ pass: 1.4 })),
  attackingFullback: r('attackingFullback', 0.1, 0.2, 0.7, 0.1, 0.5, p({ cross: 1.4 })),
  defensiveFullback: r('defensiveFullback', -0.04, 0, 0.2, 0.2, 0.7, p({ safe: 1.2 })),
  invertedFullback: r('invertedFullback', 0.02, -0.3, 0.3, 0.6, 0.5, p({ pass: 1.2 })),
  stopper: r('stopper', 0.02, 0, 0, 0, 0.7, p({ clear: 1.2 })),
  ballPlayingCB: r('ballPlayingCB', -0.02, 0, 0.1, 0.2, 0.5, p({ forward: 1.3 })),
  coverCB: r('coverCB', -0.06, 0, 0, 0, 0.4, p({ safe: 1.2 })),
  goalkeeper: r('goalkeeper', 0, 0, 0, 0, 0, p()),
};

/** 역할을 주지 않으면 포지션과 능력치로 고른다 */
export function defaultRole(pos: Position, a: FieldAttributes): Role {
  switch (pos) {
    case 'GK': return ROLES.goalkeeper!;
    case 'ST': return a.heading + a.strength > a.shooting + a.acceleration + 5 ? ROLES.targetMan! : ROLES.poacher!;
    case 'CF': return ROLES.linkUp!;
    case 'LW': case 'RW': return a.shooting >= a.crossing ? ROLES.insideForward! : ROLES.winger!;
    case 'LM': case 'RM': return ROLES.winger!;
    case 'CAM': return a.shooting > a.vision ? ROLES.shadowStriker! : ROLES.playmaker!;
    case 'CM': return a.shortPassing + a.vision >= 160 ? ROLES.deepPlaymaker! : ROLES.boxToBox!;
    case 'CDM': return a.tackling + a.interception >= 160 ? ROLES.ballWinner! : ROLES.anchor!;
    case 'LB': case 'RB': case 'LWB': case 'RWB': return ROLES.attackingFullback!;
    case 'CB': return a.longPassing >= 70 ? ROLES.ballPlayingCB! : ROLES.stopper!;
  }
}

export function roleById(id: string | undefined): Role | undefined {
  return id ? ROLES[id] : undefined;
}
