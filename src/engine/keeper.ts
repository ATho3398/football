// 골키퍼 (E.9): 세이브, 캐치/쳐내기, 크로스 처리

import type { GkAttributes } from '../attributes';
import { BALANCE } from '../config/balance';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, L1, ownGoal, segDist } = pitch_;
import type { Agent, SimState } from './state';

const K = ENGINE.keeper;

/** 팀의 현재 GK (없으면 GK 를 맡은 필드 선수, 그것도 없으면 null) */
export function keeperOf(s: SimState, team: 0 | 1): Agent | null {
  return s.agents.find((a) => a.onPitch && a.team === team && a.line === 0) ?? null;
}

/** GK 능력치. 필드 선수가 GK 를 보면 낮은 고정값 (E.10) */
export function gkAttrs(a: Agent | null): GkAttributes {
  return a?.gk?.attrs ?? BALANCE.goalkeeper.fieldPlayerAsGk;
}

/** 세이브 난이도 δ (E.9). C.76a: 헤더가 아니면 근거리 항 closeW × max(0, 1 − d/closeRef) 를 더한다 (closeRef m 안 1대1 만 막기 어렵게) */
export function saveDifficulty(speed: number, corner: number, d: number, header = false): number {
  const close = header ? 0 : K.closeW * Math.max(0, 1 - d / K.closeRef);
  return K.speedW * (speed / 30) + K.cornerW * corner + K.distW * (1 - clamp(d / K.distRef, 0, 1)) + close;
}

export function saveProb(gk: Agent | null, speed: number, corner: number, d: number, header = false, base: number = K.saveBase): number {
  const g = gkAttrs(gk);
  // GK 리치 (C.45): 키 보정
  return clamp(base - K.saveDelta * saveDifficulty(speed, corner, d, header) + (K.saveSkill * (g.shotStopping - K.saveCenter)) / 100 + (gk?.body.gkSave ?? 0), 0.05, 0.95);
}

/** GK 반대편 구석 (C.77t): GK 가 골 가운데 gy 에서 farSideMin m 넘게 비켜 있으면 반대쪽(±1), 아니면 null (무작위) */
export function farSide(gk: Agent | null, gy: number): -1 | 1 | null {
  if (!gk || Math.abs(gk.y - gy) <= K.farSideMin) return null;
  return gk.y < gy ? 1 : -1;
}

/** GK 도달 항 cover 0~1 (C.77t): (kx, ky) GK, (fx, fy) → (tx, ty) 슛 선, 선방 능력치 stop. 선방 확률에 곱한다 */
export function keeperCover(kx: number, ky: number, fx: number, fy: number, tx: number, ty: number, speed: number, stop: number, lead = 0): number {
  const [e] = segDist(kx, ky, fx, fy, tx, ty);
  const tb = Math.max(0, dist(kx, ky, fx, fy) / Math.max(1, speed) - K.reactTime);
  // lead: 슛까지 남은 시간(초, 판단용 — 패스가 가는 동안 GK 가 자리를 옮긴다)
  const reach = K.reachBase + K.diveSpeed * tb * (stop / 80) + K.setSpeed * lead;
  return clamp(1 - (e - reach) / K.reachSpan, 0, 1);
}

/**
 * 슛 1건 자료 (C.77z, 공통 규칙 로드맵 4단계): 판단(onball shotModel — 인지한 값: 리그 GK 능력·기대 구석·기대 공 속도)과
 * 실행(actions shoot → shotArrives — 실제 값: 상대 GK 능력·뽑은 구석·뽑은 공 속도)이 같은 구조를 같은 식(saveChance)으로 읽는다.
 */
export interface ShotCtx {
  /** 슈터 위치·속도 */
  fx: number;
  fy: number;
  svx: number;
  svy: number;
  /** 골 가운데까지 (m) */
  d: number;
  header: boolean;
  /** 3 m 안 상대 필드 선수 수 · 압박 0~1 (pressureAt) */
  press3: number;
  pressure: number;
  /** 노린 골라인 점 · 구석 0~1 */
  tx: number;
  ty: number;
  corner: number;
  /** 공 속도 (m/s) */
  speed: number;
  /** GK 위치·속도 (없으면 null — 덮는 정도 1) */
  gk: { x: number; y: number; vx: number; vy: number } | null;
  /** GK 선방 능력·키 보정 (판단 = 리그 GK, 키 0) */
  stop: number;
  body: number;
  /** 판단용: 슛까지 남은 시간 (초, 패스가 가는 동안 GK 가 자리를 옮긴다) */
  lead: number;
  /** GK 시야 가림 (C.79a): 슛 길 콘 안 골 쪽(선 위치 ≥ screenFrom) 상대 필드 선수가 1명 이상이면 가중(실행 1 · 판단 screenJudge) — 반응 + screenReact × 가중. 없으면 0 */
  screen?: number;
}

/** GK 반응 시간 (초, C.77z): reactBase − reactSkill × (선방 − saveCenter)/100, 0 아래는 0 */
export function reactOf(stop: number): number {
  return Math.max(0, K.reactBase - (K.reactSkill * (stop - K.saveCenter)) / 100);
}

/**
 * GK 가 슛 선을 덮는 정도 0~1 (C.77z 대응 시간 모델, keeper.timeModel 1): 공이 GK 대응 지점(GK 에서 슛 선에 내린 수선의 발)을 지날 때까지 남은 시간
 * tBall = 그 점까지 공 거리 / 공 속도. GK 는 반응 시간(reactOf) 동안은 지금 속도 그대로(슛 선 쪽 성분 — 반대로 움직이면 잃는다), 그 뒤 diveSpeed × 선방/80 으로 몸을 날린다.
 * 닿는 범위 reach = timeReach + 그 둘 + setSpeed × lead 대 슛 선까지 거리 e: cover = clamp(1 − (e − reach)/reachSpan, 0, 1).
 * timeModel 0 이면 C.77t 식(tb = |GK − 슈터|/속도 − reactTime, GK 속도 무시, 헤더는 headerCoverMin 하한) 그대로.
 */
export function coverOf(c: ShotCtx): number {
  const g = c.gk;
  if (!g) return 1;
  if (!K.timeModel) {
    const v = keeperCover(g.x, g.y, c.fx, c.fy, c.tx, c.ty, c.speed, c.stop, c.lead);
    return c.header ? Math.max(K.headerCoverMin, v) : v;
  }
  return timeTerms(c)[0];
}

/** 대응 시간 모델 (timeModel 1): [덮는 정도, 반응 뒤 남은 시간(초)] */
function timeTerms(c: ShotCtx): [number, number] {
  const g = c.gk;
  if (!g) return [1, K.availRef];
  const [e, k] = segDist(g.x, g.y, c.fx, c.fy, c.tx, c.ty);
  const tBall = (k * dist(c.fx, c.fy, c.tx, c.ty)) / Math.max(1, c.speed);
  // 가림 몫 (C.79e 실험): c.screen 은 가중 — 실행 1, 판단 screenJudge (판단 몫만 낮추기)
  const react = reactOf(c.stop) + (c.header ? K.headerReact : 0) + (c.screen ? K.screenReact * c.screen : 0);
  // 슛 선 쪽으로 움직이던 GK 는 반응 시간 동안 그만큼 더 간다 (반대로 움직이면 잃는다)
  let drift = 0;
  if (e > 1e-6) {
    const px = c.fx + (c.tx - c.fx) * k;
    const py = c.fy + (c.ty - c.fy) * k;
    drift = clamp(((px - g.x) * g.vx + (py - g.y) * g.vy) / e, -K.driftMax, K.driftMax) * Math.min(tBall, react);
  }
  const dive = Math.max(0, tBall - react);
  const reach = K.timeReach + K.diveSpeed * dive * (c.stop / 80) + drift + K.setSpeed * c.lead;
  return [clamp(1 - (e - reach) / K.reachSpan, 0, 1), dive + c.lead];
}

/**
 * 선방 확률 (C.77z): 판단·실행 공용 = 막기 어려움 δ × 덮는 정도. 날씨·카드 보정은 실행 쪽에서 곱한다.
 * timeModel 1 이면 δ 의 거리 항 distW × (1 − 거리/distRef) 대신 시간 항 distW × (1 − 반응 뒤 남은 시간/availRef) — 같은 거리라도 GK 가 가깝거나 공이 빠르면 어렵다
 */
export function saveChance(c: ShotCtx): number {
  let cover: number;
  let delta: number;
  if (K.timeModel) {
    const [cv, avail] = timeTerms(c);
    cover = cv;
    delta = K.speedW * (c.speed / 30) + K.cornerW * c.corner + K.distW * (1 - clamp(avail / K.availRef, 0, 1));
  } else {
    delta = saveDifficulty(c.speed, c.corner, c.d, c.header);
    cover = coverOf(c);
  }
  return clamp(K.saveBase - K.saveDelta * delta + (K.saveSkill * (c.stop - K.saveCenter)) / 100 + c.body, 0.05, 0.95) * cover;
}

/**
 * 판단용 기대 선방 (C.77z, timeModel 1): 실행은 구석을 난수 × cornerRange(최대 1)로 뽑아 GK 반대편으로 차므로, 판단은 그 분포의 cornerQuad 점 평균으로 본다
 * (덮는 정도가 구석에 비선형이라 기대 구석 한 점이면 판단이 실제보다 GK 를 세게 본다). base = 압박 보정 전 구석 1 의 골라인 y 오프셋 방향(±1)
 */
export function expectedSave(c: ShotCtx, gy: number, side: number, cornerMul: number): number {
  const n = K.cornerQuad;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const corner = Math.min(1, ((i + 0.5) / n) * ENGINE.prob.cornerRange) * cornerMul;
    sum += saveChance({ ...c, corner, ty: gy + side * corner * (ENGINE.pitch.goalWidth / 2 - 0.3) });
  }
  return sum / n;
}

/** GK 자료 (실행: 실제 GK 위치·속도·능력·키) */
export function gkCtx(gk: Agent | null): Pick<ShotCtx, 'gk' | 'stop' | 'body'> {
  return { gk: gk ? { x: gk.x, y: gk.y, vx: gk.vx, vy: gk.vy } : null, stop: gkAttrs(gk).shotStopping, body: gk?.body.gkSave ?? 0 };
}

export function catchProb(gk: Agent | null): number {
  return clamp(K.catchBase + (K.catchSkill * gkAttrs(gk).handling) / 100, 0, 1);
}

/** 크로스/롱볼을 GK 가 처리할 확률 */
export function claimProb(gk: Agent | null): number {
  return clamp(L1((gkAttrs(gk).commandOfArea - 60) / 12 + K.claimBias) + (gk?.body.gkClaim ?? 0), 0, 1);
}

/** 스위퍼의 박스 밖 처리 범위 (m, C.28): 출전 범위·가속에 비례. 클래식은 0 */
export function sweepRange(gk: Agent): number {
  if (gk.gk?.type !== 'sweeper') return 0;
  const k = clamp((0.7 * (gkAttrs(gk).commandOfArea - 50) + 0.3 * (gk.attrs.acceleration - 50)) / 40, 0, 1);
  return K.sweepRange[0] + (K.sweepRange[1] - K.sweepRange[0]) * k;
}

/** (x, y)가 GK 의 처리 구역인가 (C.28): 자기 박스 안, 스위퍼는 박스 밖 sweepRange m 까지 */
export function keeperZone(s: SimState, gk: Agent, x: number, y: number, range = sweepRange(gk)): boolean {
  const [gx, gy] = ownGoal(attackDir(gk.team, s.half));
  const P = ENGINE.pitch;
  const dx = Math.max(0, Math.abs(x - gx) - P.boxDepth);
  const dy = Math.max(0, Math.abs(y - gy) - P.boxWidth / 2);
  return dx * dx + dy * dy <= range * range;
}
