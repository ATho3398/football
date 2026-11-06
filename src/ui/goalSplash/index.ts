// 골 "GOAL!" 날아오기 연출 (C.77p): 피치 위 DOM 한 겹. 경기 재생은 멈추지 않고, 탭하면 바로 닫힌다.
// 화면을 다시 그려도 지워지지 않게 body 에 붙이고 피치 위치는 시작할 때 잰다. 설정 '끔'이면 아무것도 하지 않는다

import './goalSplash.css';
import { GOAL_SPLASH, loadGoalSplashPref, splashDuration, splashWidth } from './model';
import { isWide } from '../skin';

export * from './model';

const BASE = (): string => (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
const reduced = (): boolean => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

let current: { el: HTMLElement; timer: number } | null = null;

export function closeGoalSplash(): void {
  if (!current) return;
  window.clearTimeout(current.timer);
  current.el.remove();
  current = null;
}

/** canvasId 피치 위에 연출을 띄운다. 띄웠으면 true (설정 끔·피치 없음·DOM 없음이면 false) */
export function playGoalSplash(canvasId: string): boolean {
  if (typeof document === 'undefined' || loadGoalSplashPref() === 'off') return false;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return false;
  closeGoalSplash();
  const rm = reduced();
  const r = canvas.getBoundingClientRect();
  const w = splashWidth(isWide(), window.innerWidth, r.width);
  const el = document.createElement('div');
  el.className = `gs-layer${rm ? ' gs-layer--reduced' : ''}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', '골!');
  el.style.setProperty('--gs-dur', `${splashDuration(rm)}ms`);
  el.innerHTML = `<div class="gs-dim" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--gs-dim:${GOAL_SPLASH.dim}"></div>
    <img class="gs-img" alt="GOAL!" decoding="async" draggable="false" width="${w}" style="width:${w}px;left:${Math.round(r.left + r.width / 2)}px;top:${Math.round(r.top + r.height / 2)}px"
      src="${BASE()}anim/goal/goal.webp" srcset="${BASE()}anim/goal/goal-887.webp 887w, ${BASE()}anim/goal/goal.webp 1774w" sizes="${w}px">`;
  el.addEventListener('pointerdown', closeGoalSplash, { once: true });
  document.body.append(el);
  if (!rm) {
    // 가운데 도착 순간 피치 3px 흔들기 (다시 그려지면 사라져도 된다)
    canvas.classList.remove('gs-shake');
    void canvas.getBoundingClientRect();
    canvas.classList.add('gs-shake');
    window.setTimeout(() => canvas.classList.remove('gs-shake'), GOAL_SPLASH.flyIn + GOAL_SPLASH.shakeMs + 50);
  }
  current = { el, timer: window.setTimeout(closeGoalSplash, splashDuration(rm)) };
  return true;
}
