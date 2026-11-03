// 공격 몰빵 강제 억제 (C.80q): 선발 대형의 공격 포지션(포지션군 윙·CAM·ST) 인원이 n 이상이면 슛 유효 확률 배수
import { posGroup } from '../roster';
import type { Position } from '../types';
import { ENGINE } from './config';

type StackCfg = { readonly n: number; readonly k: number; readonly groups: readonly string[] };

/** 공격 포지션 인원 (GK 포함 목록을 줘도 된다) */
export function stackCount(positions: readonly Position[], cfg: StackCfg = ENGINE.stackCap): number {
  return positions.filter((p) => cfg.groups.includes(posGroup(p))).length;
}

/** 슛 유효 확률 배수: max(0, 1 − k × (인원 − n + 1)), n 미만이면 1 */
export function stackMul(positions: readonly Position[], cfg: StackCfg = ENGINE.stackCap): number {
  const c = stackCount(positions, cfg);
  if (cfg.k <= 0 || c < cfg.n) return 1;
  return Math.max(0, 1 - cfg.k * (c - cfg.n + 1));
}
