// 경기 외 생활 (pending 47 4번, 부록 C.63): 숨은 생활 지표 4개 (0~100) — 가정 안정 · 적응도 · 팀 관계 · 멘탈 피로(높을수록 나쁨).
// 영향은 엔진 밖 (경기 입력 폼·피로 회복)에서만. 해결은 하루 행동. 수치는 BALANCE.life

import { BALANCE } from './config/balance';
import type { GameState } from './game';

export type LifeKey = 'home' | 'adapt' | 'team' | 'mental';
export const LIFE_KEYS: readonly LifeKey[] = ['home', 'adapt', 'team', 'mental'];

export interface LifeState {
  home: number;
  adapt: number;
  team: number;
  mental: number;
  /** 지금 지표가 속한 팀 (팀이 바뀌면 적응도·팀 관계를 새로 시작) */
  teamId: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ensureLife(state: GameState): LifeState {
  const L = BALANCE.life;
  const teamId = state.player.teamId;
  if (!state.life) state.life = { home: L.start.home, adapt: L.start.adapt, team: L.start.team, mental: L.start.mental, teamId };
  return state.life;
}

export function lifeVar(state: GameState, k: LifeKey): number {
  return Math.round(ensureLife(state)[k]);
}

/** 생활 지표 더하기 (0~100). 실제로 바뀐 값 (정수 반올림) */
export function addLife(state: GameState, k: LifeKey, d: number): number {
  const l = ensureLife(state);
  const before = l[k];
  l[k] = clamp(Math.round((l[k] + d) * 10) / 10, 0, 100);
  return Math.round(l[k] - before);
}
