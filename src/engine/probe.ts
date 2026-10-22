// 측정 훅 (C.77w, 공통 규칙 로드맵 1단계): 진단 스크립트에서만 켜는 콜백. 기본은 비어 있고, 켜져 있어도 난수를 부르지 않고 상태를 바꾸지 않는다 (엔진 지문 불변).
// 슛: shoot()·직접 프리킥·PK 가 판정 직후 1건씩 기록한다 (블록 포함). 유효 슈팅은 GK 판정·골에서 결과를 고친다.
// 결정: choose() 가 고른 직후 후보·풀·효용 1위·gap 을 넘긴다 (침투 패스 안 함·백패스 이유는 진단 스크립트가 분류).

import type { Candidate } from './onball';
import type { Agent, SimState } from './state';

/** 슛 1건 (판정 순간) */
export interface ShotProbe {
  t: number;
  team: 0 | 1;
  shooter: number;
  /** foot 발 · header 머리 · fk 직접 프리킥 · pk 페널티킥 */
  kind: 'foot' | 'header' | 'fk' | 'pk';
  /** block · miss · onTarget(비행 중) → save · goal. 골대는 엔진에 없다 */
  outcome: 'block' | 'miss' | 'onTarget' | 'save' | 'goal';
  /** 판단 모델 xG (shotModel). 직접 프리킥은 판단 모델이 없어 null, PK 는 0.76 */
  xg: number | null;
  pOn: number;
  pBlock: number;
  d: number;
  x: number;
  y: number;
  /** 슈터 속도 (m/s) */
  speed: number;
  /** 3 m 안 상대 필드 선수 수 */
  press3: number;
  aimX: number;
  aimY: number;
  ballSpeed: number;
  gkX: number;
  gkY: number;
  gkSpeed: number;
}

/** 결정 1건 (choose 직후) */
export interface DecideProbe {
  a: Agent;
  /** 전체 후보 · 보이는 후보(없으면 전체) · 선택 풀(gap 안 + 실수 후보) */
  cands: Candidate[];
  vis: Candidate[];
  pool: Candidate[];
  chosen: Candidate;
  maxU: number;
  gap: number;
}

export const probe: {
  shot?: (s: SimState, p: ShotProbe) => void;
  decide?: (s: SimState, p: DecideProbe) => void;
} = {};

/** 유효 슈팅 비행의 shot 객체 → 기록 (결과를 save·goal 로 고친다) */
const open = new WeakMap<object, ShotProbe>();

/** 슛 기록 (probe.shot 이 있을 때만 부른다). key = 유효 슈팅 비행의 shot 객체 */
export function probeShot(
  s: SimState, a: Agent, kind: ShotProbe['kind'], outcome: ShotProbe['outcome'],
  m: { xg: number | null; pOn: number; pBlock: number; d: number }, aimX: number, aimY: number, ballSpeed: number, key?: object,
): void {
  let press3 = 0;
  let gk: Agent | null = null;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team) continue;
    if (o.line === 0) gk = o;
    else if (Math.hypot(o.x - a.x, o.y - a.y) <= 3) press3++;
  }
  const p: ShotProbe = {
    t: s.t, team: a.team, shooter: a.idx, kind, outcome, xg: m.xg, pOn: m.pOn, pBlock: m.pBlock, d: m.d, x: a.x, y: a.y,
    speed: Math.hypot(a.vx, a.vy), press3, aimX, aimY, ballSpeed,
    gkX: gk?.x ?? NaN, gkY: gk?.y ?? NaN, gkSpeed: gk ? Math.hypot(gk.vx, gk.vy) : NaN,
  };
  if (key) open.set(key, p);
  probe.shot!(s, p);
}

/** 유효 슈팅 결과 (GK 판정·골). 기록이 없으면 아무것도 안 한다 */
export function probeShotEnd(key: object | undefined, outcome: 'save' | 'goal'): void {
  const p = key && open.get(key);
  if (!p) return;
  p.outcome = outcome;
  open.delete(key);
}
