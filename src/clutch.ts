// 결정적 순간 점수 (C.76n 개인 시상 이력서): 한 경기 득점 기록에서 결승골 · 80분 뒤 동점/역전골 · 해트트릭 · 결승골 도움.
// 경기 무게(더비·상위 팀 상대·컵 단계)를 곱한다. 수치는 BALANCE.awards.resume.clutch

import { BALANCE } from './config/balance';
import type { GoalRec } from './engine/npcMatch';

/** 경기 하나의 선수별 결정적 순간 점수. w = [홈 선수 무게, 원정 선수 무게] */
export function matchClutch(goals: readonly GoalRec[], hg: number, ag: number, w: readonly [number, number], add: (id: string, pts: number) => void): void {
  if (!goals.length) return;
  const C = BALANCE.awards.resume.clutch;
  const win = hg > ag ? 0 : ag > hg ? 1 : -1;
  const need = Math.min(hg, ag) + 1;
  const sorted = [...goals].sort((a, b) => a[0] - b[0]);
  let h = 0;
  let a = 0;
  let wn = 0;
  const count = new Map<string, number>();
  for (const [min, side, scorer, assist] of sorted) {
    const lead = side === 0 ? h - a : a - h;
    if (side === 0) h++; else a++;
    if (!scorer) continue;
    const k = w[side];
    let pts = 0;
    if (side === win && ++wn === need) {
      pts += C.winner;
      if (assist) add(assist, C.winnerAssist * k);
    }
    if (min >= C.lateMin) pts += lead === -1 ? C.lateEqualizer : lead === 0 ? C.lateGoAhead : 0;
    const n = (count.get(scorer) ?? 0) + 1;
    count.set(scorer, n);
    if (n === 3) pts += C.hatTrick;
    if (pts) add(scorer, pts * k);
  }
}

/** 리그 경기 무게: 1 + 더비 + 상대가 레이팅 상위 topRank 팀 */
export function leagueWeight(derby: boolean, oppTop: boolean): number {
  const C = BALANCE.awards.resume.clutch;
  return 1 + (derby ? C.derby : 0) + (oppTop ? C.topOpp : 0);
}
