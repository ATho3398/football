// 공격 몰빵 억제 (C.80q): 선발 대형의 공격 포지션(포지션군 윙·CAM·ST) 인원이 n 이상이면 ① 공격 진영 연계(패스·침투·크로스) 저하 ② 수비 전환 체력 소모 증가
import { posGroup } from '../roster';
import type { Position } from '../types';
import { ENGINE } from './config';
import { attackDir, toNorm, normX } from './pitch';
import type { Agent, SimState } from './state';

type StackCfg = { readonly n: number; readonly stN: number; readonly link: number; readonly linkBase: number; readonly stW: number; readonly drain: number; readonly groups: readonly string[] };

/** 공격 포지션 인원 (GK 포함 목록을 줘도 된다) */
export function stackCount(positions: readonly Position[], cfg: StackCfg = ENGINE.stackCap): number {
  return positions.filter((p) => cfg.groups.includes(posGroup(p))).length;
}

/** 초과 인원 m = max(공격 포지션 − n + 1, ST·CF − stN + 1, 0) */
export function stackOver(positions: readonly Position[], cfg: StackCfg = ENGINE.stackCap): number {
  const st = positions.filter((p) => posGroup(p) === 'ST').length;
  return Math.max(0, stackCount(positions, cfg) - cfg.n + 1, cfg.stW * (st - cfg.stN + 1));
}

/** 연계 배수 max(0, 1 − linkBase − link × m) · 수비 전환 체력 소모 배수 1 + drain × m (표시·테스트용 순수 함수) */
export function stackPenalty(positions: readonly Position[], cfg: StackCfg = ENGINE.stackCap): { over: number; link: number; drain: number } {
  const m = stackOver(positions, cfg);
  return { over: m, link: m > 0 ? Math.max(0, 1 - cfg.linkBase - cfg.link * m) : 1, drain: 1 + cfg.drain * m };
}

/** 경기 중 연계 배수: 패서 팀이 걸렸고 패서가 공격 진영(정규화 x ≥ linkFromX)이면 1 − linkBase − link × m, 아니면 1 */
export function stackLinkMul(s: SimState, a: Agent): number {
  const m = s.teams[a.team].stackOver;
  if (m <= 0) return 1;
  const C = ENGINE.stackCap;
  const nx = normX(a.x, attackDir(a.team, s.half));
  return nx >= C.linkFromX ? Math.max(0, 1 - C.linkBase - C.link * m) : 1;
}

/** 경기 중 체력 소모 배수: 걸린 팀의 공격 포지션 선수가 상대 소유 중 자기 골 쪽으로 움직이면 1 + drain × m, 아니면 1 */
export function stackDrainMul(s: SimState, a: Agent): number {
  const m = s.teams[a.team].stackOver;
  if (m <= 0 || a.gk) return 1;
  const C = ENGINE.stackCap;
  if (!C.groups.includes(posGroup(a.pos))) return 1;
  const b = s.ball;
  const poss = b.owner >= 0 ? s.agents[b.owner]!.team : s.possTeam;
  if (poss === a.team) return 1;
  return a.vx * attackDir(a.team, s.half) < 0 ? 1 + C.drain * m : 1;
}
