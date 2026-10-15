// 레전드 배지 (8.2, 부록 D.4): 1단계 리그 구조에서 판정 가능한 3개. 영구 부여, 부여 시 위상 +100.
// 발롱도르·월드컵·챔스는 대회가 생기는 단계에서, "주장 10시즌"은 주장 시스템(5단계)이 생기면 되돌린다

import { BALANCE } from './config/balance';
import type { Badge, BadgeId, PlayerState } from './types';

export const BADGE_NAMES_KO: Record<BadgeId, string> = {
  goals500: '통산 500골', titles5: '리그 우승 5회', oneClub10: '한 팀 10시즌',
};

export const BADGE_DESC_KO: Record<BadgeId, string> = {
  goals500: `리그 통산 ${BALANCE.badges.careerGoals}골을 넣었어요.`,
  titles5: `리그에서 ${BALANCE.badges.leagueTitles}번 우승했어요.`,
  oneClub10: `한 팀에서 ${BALANCE.badges.sameTeamSeasons}시즌 연속 뛰었어요.`,
};

/** 지금 판정하는 배지 (꺼 둔 배지는 화면에도 보이지 않는다) */
export function activeBadges(): BadgeId[] {
  return (Object.keys(BADGE_NAMES_KO) as BadgeId[]).filter((id) => id !== 'oneClub10' || BALANCE.badges.oneClubEnabled);
}

/** 끝난 시즌까지의 기록(history)으로 새로 받을 배지를 판정해 부여한다. 새로 받은 배지를 돌려준다 */
export function awardBadges(p: PlayerState, season: number): Badge[] {
  const B = BALANCE.badges;
  const h = p.history;
  const have = new Set(p.badges.map((b) => b.id));
  const met: Record<BadgeId, boolean> = {
    goals500: h.reduce((t, r) => t + r.goals, 0) >= B.careerGoals,
    titles5: h.filter((r) => r.leaguePosition === 1).length >= B.leagueTitles,
    oneClub10: B.oneClubEnabled && h.length >= B.sameTeamSeasons && h.slice(-B.sameTeamSeasons).every((r) => r.teamId === h.at(-1)!.teamId),
  };
  const out: Badge[] = [];
  for (const id of Object.keys(met) as BadgeId[]) {
    if (!met[id] || have.has(id)) continue;
    const b = { id, season };
    p.badges.push(b);
    out.push(b);
    p.reputation = Math.min(BALANCE.reputation.max, p.reputation + B.reputation);
  }
  return out;
}
