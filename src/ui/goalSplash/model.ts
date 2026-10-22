// 골 "GOAL!" 날아오기 연출 (C.77p, docs/ui-requests/goal-splash-apply.md): DOM 없는 순수 규칙 — 설정, 우리 팀 골 감지, 시간표, 크기

import type { ReplayEvent } from '../../replay';

// ── 설정: 골 연출 켬/끔 (기기 설정, 세이브 밖 localStorage — 팩 개봉 연출과 같은 방식) ──

export type GoalSplashPref = 'on' | 'off';
export const GOAL_SPLASH_PREF_KO: Record<GoalSplashPref, string> = { on: '켬', off: '끔' };
const KEY = 'po-goal-splash';

export function loadGoalSplashPref(store?: Pick<Storage, 'getItem'> | null): GoalSplashPref {
  try {
    return (store === undefined ? globalThis.localStorage : store)?.getItem(KEY) === 'off' ? 'off' : 'on';
  } catch {
    return 'on';
  }
}

export function saveGoalSplashPref(p: GoalSplashPref, store?: Pick<Storage, 'setItem'> | null): void {
  try {
    (store === undefined ? globalThis.localStorage : store)?.setItem(KEY, p);
  } catch {
    // 저장 못 해도 이번 실행 동안은 유지
  }
}

// ── 언제: 재생 시점이 (from, to] 를 지나며 찍힌 우리 팀 골 수. 실점·건너뛰기(진행 없이 점프)는 0 ──

export function myGoalsBetween(events: readonly Pick<ReplayEvent, 'e' | 'type' | 'team'>[], side: 0 | 1, from: number, to: number): number {
  if (!(to > from)) return 0;
  return events.filter((x) => x.type === 'goal' && x.team === side && x.e > from && x.e <= to).length;
}

// ── 움직임 시간표 (ms) ──

export const GOAL_SPLASH = {
  /** 날아오기 0~280 · 멈춤·펄스 280~1200 · 빠져나가기 1200~1600 */
  flyIn: 280,
  exitAt: 1200,
  total: 1600,
  /** 펄스 1.0 → 1.06 → 1.0 */
  pulse: 200,
  pulseScale: 1.06,
  /** 피치 흔들기 */
  shakePx: 3,
  shakeMs: 150,
  /** prefers-reduced-motion: 가운데에서 페이드 인·아웃 */
  reducedTotal: 600,
  /** 배경 막 (검정 투명도) */
  dim: 0.3,
} as const;

export function splashDuration(reducedMotion: boolean): number {
  return reducedMotion ? GOAL_SPLASH.reducedTotal : GOAL_SPLASH.total;
}

/** 그림 폭 (px): 폰 = 화면 폭의 92%(최대 520), PC(2단) = 피치 폭의 55%(최대 720) */
export function splashWidth(wide: boolean, viewportW: number, pitchW: number): number {
  return Math.round(wide ? Math.min(720, pitchW * 0.55) : Math.min(520, viewportW * 0.92));
}
