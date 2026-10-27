// 내 팀 전술 (E.19, E3.6): 사용자가 정한 성향·포메이션·내 슬롯·슬롯 역할·세부 전술. 세이브에 담는다 (SAVE_FORMAT_VERSION 12).
// 경기 전 설정과 "기본 전술 저장"만 (바꾸기 전까지 매 경기 유지). 하프타임·중단 때 변경은 E5.
// 전술은 선수의 움직임과 판단만 바꾼다. 결과는 엔진이 능력치와 위치로 만든다 (E.15.1)

import type { FieldAttributes } from './attributes';
import { customLabel, customProblem, customSlots, FORMATIONS, presetCells, slotsOf, type CustomCells, type Formation } from './formations';
import { positionDistance } from './proficiency';
import { pickLineup, posGroup, type RosterPlayer, type Rosters, type TeamRoster } from './roster';
import { DETAILS, recommendedRole, ROLE_OPTIONS, roleGroup, tacticsOf, TENDENCIES, tendencyLevels, validLevel, type Detail, type Level } from './engine/tactics';
import { TEAM_TACTICS } from './engine/teamData';
import type { Tactics, Tendency } from './engine/types';
import type { Position } from './types';

export interface MyTactics {
  tendency: Tendency;
  formation: Formation;
  /**
   * 커스텀 포메이션 (E.5.1, E3.7): 슬롯 11개의 격자 칸 (GK -1). null 이면 프리셋 formation 그대로.
   * 커스텀이면 formation 은 편집을 시작한 프리셋 (기본값 되돌리기용)
   */
  custom: CustomCells | null;
  /** 내 슬롯 (슬롯 인덱스, GK 제외) */
  mySlot: number;
  /** 슬롯 역할 11개. null 이면 성향 추천 역할 (그 슬롯 선수 능력치에 가장 맞는 것) */
  roles: (string | null)[];
  /** 세부 전술 4개 (0 낮음 / 1 보통 / 2 높음, 빌드업은 짧게 / 혼합 / 직선, 폭은 좁게 / 보통 / 넓게) */
  levels: Record<Detail, Level>;
}

export const isFormation = (f: unknown): f is Formation => (FORMATIONS as readonly unknown[]).includes(f);

/**
 * 내 위치 기본 슬롯: 같은 포지션 → 같은 포지션군 → 가장 가까운 포지션. 후보가 여럿이면 지금 그 자리 선발 OVR 이 가장 낮은 슬롯
 * (내 선수가 밀어내는 선수가 가장 약하게, 이전 어댑터의 자리 고르기와 같은 뜻)
 */
export function defaultSlot(formation: Formation, pos: Position, roster?: TeamRoster, custom: CustomCells | null = null): number {
  const slots = slotsOf(formation, custom);
  const idx = slots.map((s, i) => ({ s, i })).filter(({ s }) => s.pos !== 'GK');
  let cands = idx.filter(({ s }) => s.pos === pos);
  if (!cands.length) cands = idx.filter(({ s }) => posGroup(s.pos) === posGroup(pos));
  if (!cands.length) {
    const best = Math.min(...idx.map(({ s }) => positionDistance(s.pos, pos)));
    cands = idx.filter(({ s }) => positionDistance(s.pos, pos) === best);
  }
  if (cands.length > 1 && roster) {
    const lu = pickLineup(withSlots(roster, { formation, custom }));
    const ovr = new Map(lu.slots.map((x) => [x.slot, x.ovr]));
    cands = [...cands].sort((a, b) => (ovr.get(a.i) ?? 0) - (ovr.get(b.i) ?? 0) || a.i - b.i);
  }
  return cands[0]!.i;
}

export function emptyRoles(): (string | null)[] {
  return Array.from({ length: 11 }, () => null);
}

/** 성향 기본값 전술 (역할은 모두 추천, 세부 전술은 성향 기본) */
export function makeTactics(tendency: Tendency, formation: Formation, pos: Position, roster?: TeamRoster): MyTactics {
  return { tendency, formation, custom: null, mySlot: defaultSlot(formation, pos, roster), roles: emptyRoles(), levels: tendencyLevels(tendency) };
}

/** 새 게임·팀 변경: 그 팀의 데이터 전술 (E.19 저장: "이적 등으로 팀이 바뀌면 새 팀의 데이터 전술로 초기화") */
export function teamDefaultTactics(teamId: string, roster: TeamRoster | undefined, pos: Position): MyTactics {
  const data = TEAM_TACTICS[teamId];
  return makeTactics(data?.tendency ?? 'balanced', data?.formation ?? roster?.formation ?? '4-4-2', pos, roster);
}

/** 이전 세이브 변환 (E.19 저장): 균형 + 팀 데이터 포메이션 + 주 포지션 슬롯 */
export function migratedTactics(teamId: string, roster: TeamRoster | undefined, pos: Position): MyTactics {
  return makeTactics('balanced', TEAM_TACTICS[teamId]?.formation ?? roster?.formation ?? '4-4-2', pos, roster);
}

/** 포메이션을 바꾸면 내 슬롯은 같은 포지션 쪽으로 옮기고, 슬롯 역할은 새 포메이션의 추천으로 */
export function withFormation(t: MyTactics, formation: Formation, roster?: TeamRoster): MyTactics {
  if (formation === t.formation && !t.custom) return t;
  const myPos = slotPos(t, t.mySlot);
  return { ...t, formation, custom: null, mySlot: defaultSlot(formation, myPos, roster), roles: emptyRoles() };
}

/** 로스터에 내 전술의 포메이션(커스텀이면 그 슬롯)을 붙인다 (선발 고르기·엔진 입력) */
export function withSlots(roster: TeamRoster, t: Pick<MyTactics, 'formation' | 'custom'>): TeamRoster {
  const { customSlots: _c, ...rest } = roster;
  return t.custom ? { ...rest, formation: t.formation, customSlots: customSlots(t.custom) } : { ...rest, formation: t.formation };
}

/** 포메이션 이름 (커스텀이면 줄 인원, 예 "3-4-3 커스텀") */
export function formationLabel(t: Pick<MyTactics, 'formation' | 'custom'>): string {
  return t.custom ? `${customLabel(t.custom)} 커스텀` : t.formation;
}

/** 커스텀 편집 시작: 지금 프리셋을 격자 칸으로 옮긴다 (이미 커스텀이면 그대로) */
export function startCustom(t: MyTactics): MyTactics {
  return t.custom ? t : { ...t, custom: presetCells(t.formation) };
}

/**
 * 슬롯을 칸으로 옮긴다 (E.5.1 끌어다 놓기). 다른 슬롯이 있는 칸이면 두 슬롯을 바꾼다. GK 는 못 옮긴다.
 * 배치 규칙을 어기면 바꾸지 않고 사유를 돌려준다
 */
export function moveSlot(t: MyTactics, slot: number, cell: number): { tactics: MyTactics; problem: string | null } {
  const base = startCustom(t);
  const cells = [...base.custom!];
  if (slot <= 0 || slot >= cells.length) return { tactics: t, problem: '골키퍼는 고정이에요.' };
  const other = cells.indexOf(cell);
  if (other === slot) return { tactics: base, problem: null };
  if (other > 0) cells[other] = cells[slot]!;
  cells[slot] = cell;
  const problem = customProblem(cells);
  if (problem) return { tactics: t, problem };
  return { tactics: { ...base, custom: cells }, problem: null };
}

/** 성향 바꾸기. resetDetails 면 세부 전술과 역할도 그 성향 기본값으로 (I.16 확인) */
export function withTendency(t: MyTactics, tendency: Tendency, resetDetails: boolean): MyTactics {
  return resetDetails ? { ...t, tendency, roles: emptyRoles(), levels: tendencyLevels(tendency) } : { ...t, tendency };
}

/** 성향 기본값에서 바꾼 것 (세부 전술 수, 직접 고른 역할 수) */
export function customized(t: MyTactics): { details: number; roles: number } {
  const base = tendencyLevels(t.tendency);
  return { details: DETAILS.filter((d) => t.levels[d] !== base[d]).length, roles: t.roles.filter((r) => r !== null).length };
}

export function engineTactics(t: MyTactics): Tactics {
  return tacticsOf(t.tendency, t.levels);
}

export const slotPos = (t: Pick<MyTactics, 'formation' | 'custom'>, slot: number): Position => slotsOf(t.formation, t.custom)[slot]!.pos;

/** 그 슬롯에 고를 수 있는 역할인지 */
export function roleAllowed(pos: Position, roleId: string): boolean {
  return (ROLE_OPTIONS[roleGroup(pos)] ?? []).includes(roleId);
}

/** 직접 고른 역할 (그 슬롯에 맞을 때만) */
function chosenRole(t: MyTactics, slot: number): string | null {
  const r = t.roles[slot];
  return r && roleAllowed(slotPos(t, slot), r) ? r : null;
}

/**
 * 슬롯 역할 11개: 직접 고른 역할 또는 성향 추천 (엔진 fillRoles 와 같은 규칙: 슬롯 순서, 내려오는 ST 추천은 한 명만).
 * attrs 는 슬롯마다 그 자리 선수 능력치 (없으면 GK 또는 빈 자리)
 */
export function teamRoles(t: MyTactics, attrs: (FieldAttributes | undefined)[]): string[] {
  const taken = new Set(t.roles.map((_, i) => chosenRole(t, i)).filter((r): r is string => !!r));
  return attrs.map((a, i) => {
    const c = chosenRole(t, i);
    if (c) return c;
    const pos = slotPos(t, i);
    if (pos === 'GK' || !a) return 'goalkeeper';
    const r = recommendedRole(t.tendency, pos, a, taken).id;
    taken.add(r);
    return r;
  });
}

/** 저장 값 검사 (세이브를 손으로 고쳤거나 다음 패치에서 포메이션이 바뀐 경우 기본값으로) */
export function validTactics(t: unknown): t is MyTactics {
  const x = t as MyTactics | undefined;
  if (!x || !TENDENCIES.includes(x.tendency) || !isFormation(x.formation) || !Array.isArray(x.roles) || x.roles.length !== 11 || !x.levels) return false;
  if (x.custom !== null && (!Array.isArray(x.custom) || customProblem(x.custom) !== null)) return false;
  const s = slotsOf(x.formation, x.custom)[x.mySlot];
  return !!s && s.pos !== 'GK' && DETAILS.every((d) => validLevel(d, x.levels[d]));
}

// ── 전술 적합도 (안내용, 엔진 계산에는 쓰지 않음, E.19) ──

type Who = 'all' | 'att' | 'st';
const FIT_KEYS: Record<Tendency, [Who, (keyof FieldAttributes)[]][]> = {
  balanced: [],
  tikitaka: [['all', ['shortPassing', 'vision', 'ballControl']]],
  gegenpress: [['all', ['workRate', 'stamina', 'acceleration']]],
  counter: [['att', ['pace', 'acceleration', 'offTheBall']]],
  direct: [['all', ['longPassing']], ['st', ['heading', 'strength']]],
  block: [['all', ['marking', 'defensivePositioning', 'tackling']]],
};

export interface FitPlayer { pos: Position; attrs?: FieldAttributes }

const isAtt = (pos: Position) => ['ST', 'WING', 'CAM'].includes(posGroup(pos));

/** 성향 핵심 능력치의 선발 평균 (필드 선수만). 정의가 없는 성향(균형)은 null */
export function fitScore(tendency: Tendency, lineup: readonly FitPlayer[]): number | null {
  const parts = FIT_KEYS[tendency];
  if (!parts.length) return null;
  const field = lineup.filter((p): p is Required<FitPlayer> => p.pos !== 'GK' && !!p.attrs);
  const vals = parts.map(([who, keys]) => {
    const ps = who === 'all' ? field : who === 'att' ? field.filter((p) => isAtt(p.pos)) : field.filter((p) => posGroup(p.pos) === 'ST');
    const pool = ps.length ? ps : field;
    return pool.reduce((t, p) => t + keys.reduce((u, k) => u + p.attrs[k], 0) / keys.length, 0) / Math.max(1, pool.length);
  });
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** 리그 평균 적합도 점수 (각 팀 기본 라인업) */
export function leagueFitAverages(rosters: Rosters): Record<Tendency, number | null> {
  const lineups = Object.values(rosters).map((r) => rosterFitLineup(r));
  const out = {} as Record<Tendency, number | null>;
  for (const t of Object.keys(FIT_KEYS) as Tendency[]) {
    const xs = lineups.map((l) => fitScore(t, l)).filter((v): v is number => v !== null);
    out[t] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }
  return out;
}

function rosterFitLineup(r: TeamRoster): FitPlayer[] {
  const byId = new Map(r.players.map((p) => [p.id, p]));
  return pickLineup(r).slots.map((s) => ({ pos: s.pos, attrs: byId.get(s.playerId)!.attributes }));
}

export type Fit = 'good' | 'ok' | 'bad';

/** 잘 맞음(리그 평균 +3 이상) / 보통 / 안 맞음(−3 이하) */
export function fitOf(score: number | null, league: number | null): Fit {
  if (score === null || league === null) return 'ok';
  const d = score - league;
  return d >= 3 ? 'good' : d <= -3 ? 'bad' : 'ok';
}

// ── 화면용 라인업 미리보기 ──

export interface PreviewSlot {
  slot: number;
  pos: Position;
  x: number;
  y: number;
  /** 선수 (내 슬롯은 내 선수) */
  name: string;
  playerId: string | null;
  attrs?: FieldAttributes;
  role: string;
  /** 직접 고른 역할인지 */
  chosen: boolean;
  me: boolean;
}

/** 내 전술로 짠 선발 미리보기 (경기 때 엔진 라인업과 같은 규칙: OVR 순 자동 선발 + 내 슬롯은 내 선수) */
export function previewLineup(t: MyTactics, roster: TeamRoster, me: { name: string; attrs: FieldAttributes }): PreviewSlot[] {
  const slots = slotsOf(t.formation, t.custom);
  const lu = pickLineup(withSlots(roster, t));
  const bySlot = new Map(lu.slots.map((s) => [s.slot, s]));
  const byId = new Map<string, RosterPlayer>(roster.players.map((p) => [p.id, p]));
  const attrsOf = (i: number) => (i === t.mySlot ? me.attrs : (() => { const pl = bySlot.get(i); return pl ? byId.get(pl.playerId)?.attributes : undefined; })());
  const roles = teamRoles(t, slots.map((_, i) => attrsOf(i)));
  return slots.map((s, i) => {
    const mine = i === t.mySlot;
    const pl = bySlot.get(i);
    const rp = pl ? byId.get(pl.playerId) : undefined;
    const attrs = attrsOf(i);
    const role = roles[i]!;
    return {
      slot: i, pos: s.pos, x: s.x, y: s.y, name: mine ? me.name : rp?.nameKo ?? '-', playerId: mine ? null : rp?.id ?? null,
      ...(attrs ? { attrs } : {}), role, chosen: chosenRole(t, i) !== null, me: mine,
    };
  });
}
