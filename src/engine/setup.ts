// 로스터 → 엔진 입력 (E.2 TeamSetup)

import { pickLineup, type RosterPlayer, type TeamRoster } from '../roster';
import { ENGINE } from './config';
import { gkFieldAttributes } from './sim';
import { createRng, hashSeed } from '../rng';
import { LEVELS, levelOf, recommendedRole, tacticsOf, teamPlan } from './tactics';
import type { PlayerSpec, Tactics, TeamSetup, Tendency } from './types';

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
  const taken = new Set(setup.lineup.map((p) => p.role).filter((r): r is string => !!r));
  for (const p of [...setup.lineup].sort((a, b) => a.slot - b.slot)) {
    if (p.role) continue;
    p.role = recommendedRole(setup.tactics.tendency, slotPos(p.slot), p.attrs, taken).id;
    taken.add(p.role);
  }
}

/**
 * 약팀의 상대별 대응 (E.20 9번, C.17 결정 4, AI 감독): 상대 레이팅이 underdogGap 이상 높으면 라인·압박을 한 단계 내리고,
 * underdogSwitch 확률(시드)로 성향을 수비 블록/역습으로 바꾼다. underdogBigGap 이상이면 수비 블록/역습을 확정하고 두 단계 내린다.
 * 내 팀(사용자 전술)에는 쓰지 않는다
 */
export function underdogPlan(teamId: string, rating: number, oppRating: number, tactics: Tactics, worldSeed: string): Tactics {
  const T = ENGINE.tactics;
  const gap = oppRating - rating;
  if (gap < T.underdogGap) return tactics;
  const big = gap >= T.underdogBigGap;
  const rng = createRng(hashSeed(`${worldSeed}:underdog:${teamId}:${Math.round(oppRating * 10)}`));
  const tendency: Tendency = big || rng() < T.underdogSwitch ? (rng() < 0.5 ? 'block' : 'counter') : tactics.tendency;
  const base = tendency === tactics.tendency ? tactics : { ...tacticsOf(tendency), style: tactics.style };
  const steps = big ? 2 : 1;
  const down = (d: 'lineHeight' | 'pressing') => LEVELS[d][Math.max(0, levelOf(d, base[d]) - steps)]!;
  return { ...base, lineHeight: down('lineHeight'), pressing: down('pressing') };
}

export function teamSetupFromRoster(
  roster: TeamRoster, rating: number, oppRating: number, worldSeed = '', exclude: ReadonlySet<string> = new Set(), leagueAvg?: number,
  aiAdapt = true,
): TeamSetup {
  const lu = pickLineup(roster, exclude);
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const plan = teamPlan(roster.teamId, rating, roster.formation, worldSeed, leagueAvg);
  if (aiAdapt) plan.tactics = underdogPlan(roster.teamId, rating, oppRating, plan.tactics, worldSeed);
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
