// 평점 (E.12): 6.0 + 행동 델타 합 + 팀 결과, 포지션별 평균이 6.5 가 되도록 정규화, 3.0~10.0

import { posGroup } from '../roster';
import { ENGINE } from './config';
import { clamp } from './pitch';
import type { Agent, SimState } from './state';

const R = ENGINE.rating;

export function actionDelta(a: Agent): number {
  const st = a.stats;
  const rt = a.rt;
  let d = 0;
  d += (st.passesCompleted - rt.forward) * R.pass + rt.forward * R.forwardPass;
  d += st.keyPasses * R.keyPass + st.shotsOnTarget * R.onTarget + st.goals * R.goal + st.assists * R.assist;
  d += st.dribblesWon * R.dribble + st.tacklesWon * R.tackle + st.interceptions * R.interception + st.aerialsWon * R.aerial;
  d += (rt.lost - rt.dangerLost) * R.lost + rt.dangerLost * R.dangerLost;
  d += st.fouls * R.foul + st.offsides * R.offside + st.yellows * R.yellow + (st.red ? R.red : 0);
  return d;
}

/** 경기 종료 후 출전한 모든 선수의 평점 */
export function computeRatings(s: SimState, players: Agent[], duration: number): void {
  const goals = [s.teams[0].stats.goals, s.teams[1].stats.goals];
  for (const a of players) {
    const team = a.team;
    const gf = goals[team]!;
    const ga = goals[1 - team]!;
    let d = actionDelta(a);
    const group = posGroup(a.spec.slot >= 0 ? a.pos : a.spec.position);
    if (a.line <= 2) d += a.rt.conceded * R.conceded;
    if (a.line === 0) d += (s.teams[team].stats.saves) * R.save * (a.leftAt !== null ? 0.5 : 1);
    const minutes = (((a.leftAt ?? s.elapsed) - a.enteredAt) / duration) * 90;
    if (a.line <= 1 && ga === 0 && minutes >= R.cleanSheetMinMinutes) d += R.cleanSheet;
    d += gf > ga ? R.win : gf < ga ? R.loss : R.draw;
    const rating = R.mean + R.scale * (d - (R.center[group] ?? 0.5));
    a.stats.rating = Math.round(clamp(rating, R.min, R.max) * 10) / 10;
  }
}
