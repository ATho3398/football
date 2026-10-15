// 로스터 → 엔진 입력 (E.2 TeamSetup)

import { pickLineup, type RosterPlayer, type TeamRoster } from '../roster';
import { ENGINE } from './config';
import { gkFieldAttributes } from './sim';
import { recommendedRole, teamPlan } from './tactics';
import type { PlayerSpec, Tactics, TeamSetup } from './types';

export function specOf(p: RosterPlayer, slot: number, stamina = 100): PlayerSpec {
  return {
    id: p.id,
    name: p.nameKo,
    slot,
    position: p.position,
    attrs: p.attributes ? { ...p.attributes } : gkFieldAttributes(p.gk!.attrs),
    ...(p.gk ? { gk: { attrs: { ...p.gk.attrs }, type: p.gk.type } } : {}),
    stamina,
    form: 0,
    isMe: false,
  };
}

/** 팀 빌드업 성향 style (E.18 A5): 실제 팀은 팀 데이터, 없으면 clamp(0.5 + 0.04 × (팀 레이팅 − 리그 평균), 0.2, 0.8) */
export function teamStyle(teamId: string, rating: number, leagueAvg: number = ENGINE.tactics.leagueAvg): number {
  return teamPlan(teamId, rating, '4-4-2', '', leagueAvg).tactics.style;
}

/** 팀 데이터 전술 (E.19): 성향 기본값의 세부 전술, 빌드업은 A5 연속 값 */
export function defaultTactics(teamId: string, rating: number, _oppRating = rating, worldSeed = '', leagueAvg?: number): Tactics {
  return teamPlan(teamId, rating, '4-4-2', worldSeed, leagueAvg).tactics;
}

/** 슬롯 역할을 성향 추천 역할로 채운다 (E.19 ②). 이미 정한 역할은 둔다 */
export function fillRoles(setup: TeamSetup, slotPos: (slot: number) => PlayerSpec['position']): void {
  for (const p of setup.lineup) p.role ??= recommendedRole(setup.tactics.tendency, slotPos(p.slot), p.attrs).id;
}

export function teamSetupFromRoster(
  roster: TeamRoster, rating: number, oppRating: number, worldSeed = '', exclude: ReadonlySet<string> = new Set(), leagueAvg?: number,
): TeamSetup {
  const lu = pickLineup(roster, exclude);
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const plan = teamPlan(roster.teamId, rating, roster.formation, worldSeed, leagueAvg);
  void oppRating;
  const setup: TeamSetup = {
    teamId: roster.teamId,
    formation: roster.formation,
    lineup: lu.slots.map((s) => specOf(byId.get(s.playerId)!, s.slot)),
    bench: lu.bench.map((id) => specOf(byId.get(id)!, -1)),
    tactics: plan.tactics,
    rating,
  };
  const slotPos = new Map(lu.slots.map((s) => [s.slot, s.pos]));
  fillRoles(setup, (slot) => slotPos.get(slot) ?? 'CM');
  return setup;
}
