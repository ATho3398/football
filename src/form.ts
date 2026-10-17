// 폼 (7.2, 부록 D.1): 최근 출전 경기 평점으로 다음 경기 평점 보정

import { BALANCE } from './config/balance';

export type FormLevel = 'veryGood' | 'good' | 'normal' | 'bad' | 'veryBad';

export const FORM_NAMES_KO: Record<FormLevel, string> = {
  veryGood: '매우 좋음', good: '좋음', normal: '보통', bad: '나쁨', veryBad: '매우 나쁨',
};

export const FORM_ICONS: Record<FormLevel, string> = {
  veryGood: '⏫', good: '🔼', normal: '⏺', bad: '🔽', veryBad: '⏬',
};

/** 출전 경기 평점 기록. 최근 N경기만 남긴다 */
export function pushRating(recent: number[], rating: number): number[] {
  return [...recent, rating].slice(-BALANCE.form.games);
}

/** 다음 경기 평점 보정. N경기 미만이면 0 */
export function formBonus(recent: readonly number[], mul = 1): number {
  const F = BALANCE.form;
  if (recent.length < F.games) return 0;
  const avg = recent.slice(-F.games).reduce((t, r) => t + r, 0) / F.games;
  // 장단점 (C.45): 기복 ×1.5·꾸준함 ×0.7 이 변동 폭(기울기와 한도)에 곱해진다
  return Math.min(F.max * mul, Math.max(-F.max * mul, (avg - F.pivot) * F.perPoint * mul));
}

export function formLevel(recent: readonly number[]): FormLevel {
  const F = BALANCE.form;
  const b = formBonus(recent);
  if (b >= F.veryGood) return 'veryGood';
  if (b >= F.good) return 'good';
  if (b <= F.veryBad) return 'veryBad';
  if (b <= F.bad) return 'bad';
  return 'normal';
}
