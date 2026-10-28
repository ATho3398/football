// 로스터 → 엔진 입력 (E.2 TeamSetup)

import { BALANCE } from '../config/balance';
import { pickLineup, type RosterPlayer, type TeamRoster } from '../roster';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import { gkFieldAttributes } from './sim';
import { createRng, hashSeed } from '../rng';
import { npcSelectPenalty, type NpcCond } from '../npcFit';
import * as roles_ from './roles';
const { ROLES } = roles_;
import * as tactics_ from './tactics';
const { LEVELS, levelOf, recommendedRole, tacticsOf, teamPlan } = tactics_;
import type { PlayerSpec, Tactics, TeamSetup, Tendency } from './types';

/** 경기 시작 스태미나 = 100 − 피로 × staminaPerFatigue (E.16). 내 선수(adapter)와 NPC(C.77m) 공통 */
export function startStamina(fatigue: number): number {
  return Math.max(30, 100 - fatigue * ENGINE.match.staminaPerFatigue);
}

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
    ...(p.body ? { body: p.body } : {}),
    ...(p.shirt !== undefined ? { shirt: p.shirt } : {}),
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
  const filled: PlayerSpec[] = [];
  for (const p of [...setup.lineup].sort((a, b) => a.slot - b.slot)) {
    if (p.role) continue;
    p.role = recommendedRole(setup.tactics.tendency, slotPos(p.slot), p.attrs, taken).id;
    taken.add(p.role);
    filled.push(p);
  }
  // 펄스 나인 짝 (C.77d 가설 0): 펄스 나인이 있는데 공격형 CM/CAM(run ≥ nineMateRun)이 없으면 이번에 채운 마지막 CM 을 박스투박스로
  const mid = (p: PlayerSpec) => slotPos(p.slot) === 'CM' || slotPos(p.slot) === 'CAM';
  if (taken.has('falseNine') && !setup.lineup.some((p) => mid(p) && (ROLES[p.role ?? '']?.run ?? 0) >= ENGINE.roles.nineMateRun)) {
    const last = filled.filter((p) => slotPos(p.slot) === 'CM').pop();
    if (last) last.role = 'boxToBox';
  }
}

/** 큰 레이팅 차에서 약팀이 고르는 성향과 라인 단계 (C.76k 사용자 확정 ①③, C.78s H1: 버스 = 블록의 라인 매우 낮음, H2: 높은 라인 역습은 큰 차에서 고르지 않는다) */
const UNDERDOG_BIG: readonly [Tendency, number][] = [['block', 0], ['block', 1]];

/**
 * 약팀의 상대별 대응 (E.20 9번, C.17 결정 4, AI 감독): 상대 레이팅이 underdogGap 이상 높으면 라인·압박을 한 단계 내리고,
 * underdogSwitch 확률(시드)로 성향을 수비 블록/역습으로 바꾼다.
 * underdogBigGap 이상이면(C.76k 사용자 확정 ①) 블록@라인 매우 낮음(버스)/블록@낮음 중 하나를 확정하고 라인은 그 단계, 압박은 두 단계 내린다.
 * 역습(C.78s H2, 라인 보통에서 하프라인 부근 압박)은 작은 차에서만 고르고 라인은 내리지 않는다(뒷공간을 덮는 라인 높이가 성향의 일부)
 * 내 팀(사용자 전술)에는 쓰지 않는다
 */
export function underdogPlan(teamId: string, rating: number, oppRating: number, tactics: Tactics, worldSeed: string): Tactics {
  const T = ENGINE.tactics;
  const gap = oppRating - rating;
  if (gap < T.underdogGap) return tactics;
  const big = gap >= T.underdogBigGap;
  const rng = createRng(hashSeed(`${worldSeed}:underdog:${teamId}:${Math.round(oppRating * 10)}`));
  const pick = big ? UNDERDOG_BIG[Math.min(UNDERDOG_BIG.length - 1, Math.floor(rng() * UNDERDOG_BIG.length))]! : null;
  const tendency: Tendency = pick ? pick[0]
    : rng() < T.underdogSwitch ? (rng() < 0.5 ? 'block' : 'counter') : tactics.tendency;
  const base = tendency === tactics.tendency ? tactics : { ...tacticsOf(tendency), style: tactics.style };
  const steps = big ? 2 : 1;
  const down = (d: 'lineHeight' | 'pressing') => LEVELS[d][Math.max(0, levelOf(d, base[d]) - steps)]!;
  return { ...base, lineHeight: pick ? LEVELS.lineHeight[pick[1]]! : tendency === 'counter' ? base.lineHeight : down('lineHeight'), pressing: down('pressing') };
}

/**
 * NPC 결장 추첨 (C.77c, 엔진관리자8 §9.15.9 권장 A): 로스터 선수마다 경기당 BALANCE.roster.npcAbsentP(부상 + 로테이션) 확률로
 * (worldSeed, 경기 시드, 선수 id) 결정적 추첨. 결장 선수는 pickLineup 의 exclude 로 빠지고 벤치가 대신 선발된다.
 * NPC 누적 피로(경기 사이 피로·회복·선발 페널티)는 미구현이라 그 임시 대체 — pending 142 에서 교체. 내 선수·내 팀 출전 규칙과 무관.
 * 안전: 남는 인원이 npcAbsentMin 아래로 가는 결장과 마지막 남은 GK 의 결장은 하지 않는다 (결과 할당이 아니라 인원 보장)
 */
export function npcAbsences(roster: TeamRoster, worldSeed: string, matchSeed: number, p: number = BALANCE.roster.npcAbsentP): Set<string> {
  const out = new Set<string>();
  if (p <= 0) return out;
  const players = roster.players;
  let gks = players.filter((x) => x.position === 'GK').length;
  let left = players.length;
  for (const x of players) {
    if (left <= BALANCE.roster.npcAbsentMin) break;
    const gk = x.position === 'GK';
    if (gk && gks <= 1) continue;
    if (createRng(hashSeed(`${worldSeed}:absent:${matchSeed}:${x.id}`))() < p) {
      out.add(x.id);
      left--;
      if (gk) gks--;
    }
  }
  return out;
}

/**
 * NPC 부상 결장 (C.77m): cond 의 부상 선수를 뺀다. 안전은 npcAbsences 와 같다 — 남는 인원이 npcAbsentMin 아래로 가거나
 * 마지막 남은 GK 면 빼지 않는다 (부상 중이라도 명단을 채운다)
 */
export function npcInjuredOut(roster: TeamRoster, cond: NpcCond | undefined, into: Set<string> = new Set()): Set<string> {
  if (!cond) return into;
  const players = roster.players;
  let gks = players.filter((x) => x.position === 'GK' && !into.has(x.id)).length;
  let left = players.length - players.filter((x) => into.has(x.id)).length;
  for (const x of players) {
    if (into.has(x.id) || cond[x.id]?.[1] !== 1) continue;
    if (left <= BALANCE.roster.npcAbsentMin) break;
    const gk = x.position === 'GK';
    if (gk && gks <= 1) continue;
    into.add(x.id);
    left--;
    if (gk) gks--;
  }
  return into;
}

/**
 * NPC 팀 엔진 입력: 결장 추첨(C.77c npcAbsentP) + 피로·부상(C.77m cond — 부상 결장, 선발 점수 피로 감점, 시작 스태미나)을 거친 teamSetupFromRoster.
 * 측정(runLeagueSeasonJob)과 본편(playNpcMatch)이 같이 쓴다
 */
export function npcTeamSetup(
  roster: TeamRoster, rating: number, oppRating: number, worldSeed: string, matchSeed: number, leagueAvg?: number, cond?: NpcCond,
): TeamSetup {
  const out = npcInjuredOut(roster, cond, npcAbsences(roster, worldSeed, matchSeed));
  return teamSetupFromRoster(roster, rating, oppRating, worldSeed, out, leagueAvg, true, cond);
}

export function teamSetupFromRoster(
  roster: TeamRoster, rating: number, oppRating: number, worldSeed = '', exclude: ReadonlySet<string> = new Set(), leagueAvg?: number,
  aiAdapt = true, cond?: NpcCond,
): TeamSetup {
  const fat = (id: string) => cond?.[id]?.[0] ?? 0;
  const lu = pickLineup(roster, exclude, cond ? (id) => npcSelectPenalty(fat(id)) : undefined);
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const plan = teamPlan(roster.teamId, rating, roster.formation, worldSeed, leagueAvg);
  if (aiAdapt) plan.tactics = underdogPlan(roster.teamId, rating, oppRating, plan.tactics, worldSeed);
  const setup: TeamSetup = {
    teamId: roster.teamId,
    formation: roster.formation,
    ...(roster.customSlots ? { customSlots: roster.customSlots } : {}),
    lineup: lu.slots.map((s) => specOf(byId.get(s.playerId)!, s.slot, startStamina(fat(s.playerId)))),
    bench: lu.bench.map((id) => specOf(byId.get(id)!, -1, startStamina(fat(id)))),
    tactics: plan.tactics,
    rating,
  };
  const slotPos = new Map(lu.slots.map((s) => [s.slot, s.pos]));
  fillRoles(setup, (slot) => slotPos.get(slot) ?? 'CM');
  return setup;
}
