// 리그 옐로 누적 출장 정지 (C.80d, 실제 PL 규칙 — BALANCE.discipline.yellowBans): 내 선수와 NPC 가 같이 쓴다

import { BALANCE } from './config/balance';

/** 리그 경기 진행 비율: round 번째(0부터) 경기 = (round + 1) ÷ 전체 라운드 */
export const seasonFrac = (round: number, rounds: number): number => (round + 1) / Math.max(1, rounds);

/** 이번 경기로 옐로 누적이 before → after 가 됐을 때 새 정지 경기 수 (그 기준을 진행 비율 frac 안에 채웠을 때만) */
export function yellowBanMatches(before: number, after: number, frac: number): number {
  let n = 0;
  for (const [at, until, matches] of BALANCE.discipline.yellowBans) if (before < at && after >= at && frac <= until + 1e-9) n += matches;
  return n;
}

/** 다음 정지 기준 장수 (frac 경기에 아직 채울 수 있는 것 중 가장 가까운 것). 없으면 0 */
export function nextYellowBan(yellows: number, frac: number): number {
  for (const [at, until] of BALANCE.discipline.yellowBans) if (yellows < at && frac <= until + 1e-9) return at;
  return 0;
}

/** 규칙 문구: "옐로 5장(19경기 안) 1경기 · 10장(32경기 안) 2경기 · 15장 3경기" */
export function yellowBanRule(rounds = 38): string {
  return BALANCE.discipline.yellowBans
    .map(([at, until, m]) => `${at}장${until < 1 ? `(${Math.round(until * rounds)}경기 안)` : ''} ${m}경기`)
    .join(' · ');
}
