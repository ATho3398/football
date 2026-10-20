// 팀 전술 층 (E.5): 슬롯 위치 + phase 시프트 + 블록 쏠림 + 역할 오프셋

import type { Position } from '../types';
import { ENGINE } from './config';
import { attackDir, clamp, toNorm } from './pitch';
import type { Agent, Line, SimState } from './state';

export function lineOf(pos: Position): Line {
  switch (pos) {
    case 'GK': return 0;
    case 'CB': case 'LB': case 'RB': return 1;
    case 'LWB': case 'RWB': case 'CDM': case 'CM': case 'LM': case 'RM': case 'CAM': return 2;
    case 'LW': case 'RW': case 'ST': case 'CF': return 3;
  }
}

/** 팀 phase: 소유 팀은 attackPhaseDelay 에 걸쳐 0 → +1, 수비 팀은 −1 */
export function teamPhase(s: SimState, team: 0 | 1): number {
  if (s.possTeam !== team) return -1;
  return clamp((s.t - s.possSince) / ENGINE.formation.attackPhaseDelay, 0, 1);
}

/** 수적 열세/우세 보정 (E.10). 퇴장으로 인원이 다르면 */
export function manDiff(s: SimState, team: 0 | 1): number {
  let own = 0;
  let opp = 0;
  for (const a of s.agents) if (a.onPitch) (a.team === team ? own++ : opp++);
  return own - opp;
}

/** 공 위치 (팀 기준 정규화) */
export function ballNorm(s: SimState, team: 0 | 1): [number, number] {
  return toNorm(s.ball.x, s.ball.y, attackDir(team, s.half));
}

/** 대형 쏠림용 공 위치 (부드럽게 따라감) */
export function smoothBallNorm(s: SimState, team: 0 | 1): [number, number] {
  return toNorm(s.bsx, s.bsy, attackDir(team, s.half));
}

/**
 * 슬롯 목표 (팀 기준 정규화). phase 보간, 블록 쏠림, 역할 오프셋(공격 시)을 더한다
 */
export function slotTarget(s: SimState, a: Agent, attackShiftScale = 1): [number, number] {
  const F = ENGINE.formation;
  const phase = teamPhase(s, a.team);
  const [bx, by] = smoothBallNorm(s, a.team);
  let x = a.sx;
  let y = a.sy;
  if (phase >= 0) x += F.attackShift[a.line] * phase * attackShiftScale;
  else {
    x += F.defendShift[a.line] * -phase;
    // 압박 전술: 수비 시 중원·공격 줄을 올리거나 내린다 (E.19 ③)
    if (a.line >= 2) x += F.pressBlock * (s.teams[a.team].tactics.pressing - 0.55) * -phase;
  }
  // 압박 전술 (C.76s): 수비 시 블록이 공을 더 따라간다 (pressFollow)
  const follow = phase < 0 ? 1 + F.pressFollow * (s.teams[a.team].tactics.pressing - 0.55) * -phase : 1;
  x += F.blockX * follow * (bx - 0.5);
  if (phase < 0 && a.line !== 0) {
    // 수비 블록: 가로로 좁히고 공 쪽으로 쏠린다
    const k = -phase;
    y = 0.5 + (y - 0.5) * (1 - (1 - F.defendWidth) * k) + (F.blockY + (F.defendBlockY - F.blockY) * k) * follow * (by - 0.5);
  } else y += F.blockY * (by - 0.5);
  if (phase > 0 && a.line !== 0) {
    // 공격 폭 (E.19 ③): 슬롯 y 의 중앙 기준 간격 배수
    y = 0.5 + (y - 0.5) * (1 + (s.teams[a.team].tactics.width - 1) * phase);
    x += a.role.dx * phase;
    // dy: 측면 선호(+) / 중앙(−). 슬롯이 있는 쪽 터치라인 방향
    const side = a.sy < 0.5 ? -1 : a.sy > 0.5 ? 1 : 0;
    y += a.role.dy * F.roleDyScale * side * phase;
  }
  // 공 반대쪽 측면은 좁힌다
  if (Math.abs(a.sy - 0.5) > 0.25 && Math.sign(a.sy - 0.5) !== Math.sign(by - 0.5)) {
    y += (0.5 - a.sy) * F.narrowFar * Math.abs(by - 0.5) * 2;
  }
  return [clamp(x, 0.01, 0.99), clamp(y, 0.03, 0.97)];
}
