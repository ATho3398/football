// 로스터 → 엔진 입력 (E.2 TeamSetup)

import { ENGINE } from './config';
import { pickLineup, type RosterPlayer, type TeamRoster } from '../roster';
import { clamp } from './pitch';
import { gkFieldAttributes } from './sim';
import type { PlayerSpec, Tactics, TeamSetup } from './types';
import { createRng, hashSeed } from '../rng';
import { TEAM_STYLE } from './teamData';

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

/**
 * 팀 빌드업 성향 style (E.18 A5): 실제 팀은 팀 데이터, 없으면 clamp(0.5 + 0.04 × (팀 레이팅 − 리그 평균), 0.2, 0.8)
 */
export function teamStyle(teamId: string, rating: number, leagueAvg: number = ENGINE.tactics.leagueAvg): number {
  const T = ENGINE.tactics;
  return TEAM_STYLE[teamId] ?? clamp(0.5 + T.stylePerRating * (rating - leagueAvg), T.styleMin, T.styleMax);
}

/** 전술 초기값 (E.5): pressing = clamp(0.5 + 0.02 × 레이팅 차), lineHeight = 0.5 ± 0.1 (팀별 시드), style (A5) */
export function defaultTactics(teamId: string, rating: number, oppRating: number, worldSeed = '', leagueAvg?: number): Tactics {
  const F = ENGINE.formation;
  const rng = createRng(hashSeed(`${worldSeed}:tactics:${teamId}`));
  return {
    pressing: clamp(F.pressingBase + F.pressingPerRating * (rating - oppRating), F.pressingMin, F.pressingMax),
    lineHeight: F.lineHeightBase + (rng() * 2 - 1) * F.lineHeightSpread,
    style: teamStyle(teamId, rating, leagueAvg),
  };
}

export function teamSetupFromRoster(roster: TeamRoster, rating: number, oppRating: number, worldSeed = '', exclude: ReadonlySet<string> = new Set(), leagueAvg?: number): TeamSetup {
  const lu = pickLineup(roster, exclude);
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  return {
    teamId: roster.teamId,
    formation: roster.formation,
    lineup: lu.slots.map((s) => specOf(byId.get(s.playerId)!, s.slot)),
    bench: lu.bench.map((id) => specOf(byId.get(id)!, -1)),
    tactics: defaultTactics(roster.teamId, rating, oppRating, worldSeed, leagueAvg),
    rating,
  };
}
