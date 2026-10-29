// 신체·양발 (pending 47 1, 부록 C.45): 키·몸무게·주발·약발 생성과 엔진 실행 배율.
// 가상 선수 신체는 선수 id 시드(`body:<id>`)로 따로 뽑아 기존 시드 흐름(로스터·경기)을 건드리지 않는다

import { REAL_PLAYER_BY_ID } from '../data/players';
import { REAL_WEAK_FOOT } from '../data/players/weakFoot';
import { BALANCE } from './config/balance';
import { posGroup } from './roster';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { Position } from './types';

export type MainFoot = 'left' | 'right';
export type WeakFoot = 1 | 2 | 3 | 4 | 5;

export interface Body {
  /** cm */
  height: number;
  /** kg */
  weight: number;
  /** 주발 (주발은 늘 5) */
  foot: MainFoot;
  /** 약발 1~5. 5 = 양발잡이 */
  weakFoot: WeakFoot;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const FOOT_KO: Readonly<Record<MainFoot, string>> = { left: '왼발', right: '오른발' };

export function bmiOf(b: Pick<Body, 'height' | 'weight'>): number {
  const m = b.height / 100;
  return b.weight / (m * m);
}

export function clampWeakFoot(v: number): WeakFoot {
  return clamp(Math.round(v), 1, 5) as WeakFoot;
}

function pickWeighted(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((t, w) => t + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** 포지션별 분포에서 신체를 뽑는다 (rng 를 주지 않으면 `body:<id>` 시드) */
export function rollBody(id: string, position: Position, rng: Rng = createRng(hashSeed(`body:${id}`))): Body {
  const B = BALANCE.body;
  const g = B.byGroup[posGroup(position)];
  const height = Math.round(clamp(g.height + gaussian(rng) * g.sd, B.heightMin, B.heightMax));
  const bmi = g.bmi + gaussian(rng) * B.bmiSd;
  const weight = Math.round(bmi * (height / 100) ** 2);
  const foot: MainFoot = rng() < (B.leftFoot[position] ?? B.leftFoot.other!) ? 'left' : 'right';
  const weakFoot = (pickWeighted(rng, B.weakFootOdds) + 1) as WeakFoot;
  return { height, weight, foot, weakFoot };
}

const REAL_BY_ID = REAL_PLAYER_BY_ID;

/** 실제 선수 신체 (데이터의 2018-19 키·몸무게·주발 + 약발 표). 데이터가 없으면 undefined */
export function realBody(id: string): Body | undefined {
  const d = REAL_BY_ID.get(id);
  if (!d) return undefined;
  const both = d.foot === 'both';
  return {
    height: d.height, weight: d.weight, foot: d.foot === 'left' ? 'left' : 'right',
    weakFoot: both ? 5 : REAL_WEAK_FOOT[id] ?? 3,
  };
}

// ── 엔진 실행 배율 (판단은 그대로, 실행 판정에만) ──

/** 엔진 에이전트 신체 보정. 신체가 없는 선수는 모두 0 / 1 (측정 스크립트·옛 입력과 같은 경기) */
export interface BodyMods {
  /** 공중볼 점수 가산 (헤더·점프·근력 척도) */
  aerial: number;
  /** 몸싸움(버티기·수신 경합)의 근력 가산 */
  strength: number;
  /** 가속·민첩 감산 (능력치 점수) */
  quickness: number;
  /** GK 공중볼 잡기·선방 확률 가산 */
  gkClaim: number;
  gkSave: number;
  foot: MainFoot;
  weakFoot: WeakFoot;
}

export const NEUTRAL_MODS: BodyMods = { aerial: 0, strength: 0, quickness: 0, gkClaim: 0, gkSave: 0, foot: 'right', weakFoot: 5 };

export function bodyMods(b: Body | undefined): BodyMods {
  if (!b) return NEUTRAL_MODS;
  const B = BALANCE.body;
  const bmi = bmiOf(b) - B.refBmi;
  const reach = (b.height - B.gkRefHeight);
  return {
    aerial: clamp((b.height - B.refHeight) * B.aerialPerCm, -B.aerialMax, B.aerialMax),
    strength: clamp(bmi * B.strengthPerBmi, -B.strengthMax, B.strengthMax),
    quickness: clamp(bmi * B.quicknessPerBmi, -B.quicknessMax, B.quicknessMax),
    gkClaim: clamp(reach * B.gkClaimPerCm, -B.gkReachMax, B.gkReachMax),
    gkSave: clamp(reach * B.gkSavePerCm, -B.gkReachMax, B.gkReachMax),
    foot: b.foot,
    weakFoot: b.weakFoot,
  };
}

/**
 * 약발 정확도 배율: 공격 방향 dir(+1/−1)으로 (dx, dy) 만큼 찰 때. 좌우 성분이 작으면 아무 발이나(1),
 * 오른쪽(공격 방향 기준)으로 보내는 공은 왼발, 왼쪽은 오른발. 그 발이 약발이면 약발 배율을 섞는다.
 * pass 면 거리로도 섞는다 (짧은 패스는 몸을 돌려 차서 약발 영향 없음)
 */
export function weakFootMul(m: BodyMods, dir: 1 | -1, dx: number, dy: number, pass = false): number {
  if (m.weakFoot >= 5) return 1;
  const d = Math.hypot(dx, dy);
  const B0 = BALANCE.body;
  const near = pass ? clamp((d - B0.passFrom) / (B0.passFull - B0.passFrom), 0, 1) : 1;
  if (near <= 0) return 1;
  if (d < 1e-6) return 1;
  // 피치 y 0 = 공격 방향 왼쪽 (dir +1 기준). 오른쪽 성분 = dy × dir
  const lat = (dy * dir) / d;
  const need: MainFoot = lat > 0 ? 'left' : 'right';
  if (need === m.foot) return 1;
  const B = BALANCE.body;
  const share = clamp((Math.abs(lat) - B.weakFrom) / (B.weakFull - B.weakFrom), 0, 1);
  return 1 - near * share * (1 - B.weakFootMul[m.weakFoot - 1]!);
}

/**
 * 슛을 차는 발 (C.79q): 슛 방향 (dx, dy) 이 몸 방향 (hx, hy) 의 오른쪽이면 왼발(인사이드로 감아 차기), 왼쪽이면 오른발 —
 * 공격 방향이 아니라 몸 방향 기준이라, 안으로 치고 들어오는 인버티드 윙어(오른쪽 왼발잡이)는 파 포스트를 주발로 감아 찬다.
 * 몸 뒤쪽으로 차면 완전히 돌아 차야 한다(가로 1). 시간이 있으면(압박·원터치 rush 0~1 가 작을수록) 공을 주발 쪽으로 옮겨 놓고
 * 차므로 약발 몫이 shotSet 만큼 준다. 급할 때(rush 1)는 몸 방향 그대로의 발. 0 = 아무 발이나 ~ 1 = 완전히 약발
 */
export function shotWeakShare(m: BodyMods, hx: number, hy: number, dx: number, dy: number, rush: number): number {
  if (m.weakFoot >= 5) return 0;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return 0;
  // y 는 공격 방향 왼쪽이 0 이라, 몸 방향 × 슛 방향 > 0 = 몸 방향의 오른쪽
  const lat = (hx * dy - hy * dx) / d;
  const need: MainFoot = lat > 0 ? 'left' : 'right';
  if (need === m.foot) return 0;
  const B = BALANCE.body;
  const al = hx * dx + hy * dy < 0 ? 1 : Math.abs(lat);
  return clamp((al - B.weakFrom) / (B.weakFull - B.weakFrom), 0, 1) * (1 - B.shotSet * (1 - clamp(rush, 0, 1)));
}

/** 슛 약발 정확도 배율 (C.79q, shotWeakShare 를 약발 등급 배율로) — 판단 xG·실행·수비 슛 레인 읽기가 같은 함수 */
export function shotFootMul(m: BodyMods, hx: number, hy: number, dx: number, dy: number, rush: number): number {
  return 1 - shotWeakShare(m, hx, hy, dx, dy, rush) * (1 - BALANCE.body.weakFootMul[m.weakFoot - 1]!);
}
