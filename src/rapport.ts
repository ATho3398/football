// 동료 호흡 · 상대 분석 리포트 · 패스 받는 빈도 (부록 C.74c, pending 77-1·77-3·125 c). 엔진에는 실행 배율(RapportInput)만 넘긴다.
// 호흡은 세이브(state.chem: 팀 id + 동료별 같이 뛴 분), 리포트는 (상대 로스터, 내 포지션)으로 그때그때 계산해 저장하지 않는다.
// 측정 고정(setEnvironmentFixed)이면 셋 다 끈다 → 호흡 0·관계 보통·리포트 없음 (회귀 가드·지문 그대로)

import { BALANCE } from './config/balance';
import { pickLineup, type RosterPlayer, type TeamRoster } from './roster';
import { environmentFixed } from './weather';
import type { FieldAttributes } from './attributes';
import type { ExploitAction, RapportInput } from './engine/rapport';
import type { PlayerStats } from './engine/types';
import type { GameState } from './game';

export interface ChemState {
  /** 지금 호흡이 속한 팀 (팀이 바뀌면 0부터) */
  teamId: string;
  /** 동료 id → 같이 뛴 분 */
  mins: Record<string, number>;
}

const C = () => BALANCE.chemistry;
const P = () => BALANCE.passTarget;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ensureChem(state: GameState): ChemState {
  const teamId = state.player.teamId;
  if (!state.chem || state.chem.teamId !== teamId) state.chem = { teamId, mins: {} };
  return state.chem;
}

/** 호흡 비율 0~1 (같이 뛴 분 / fullMinutes) */
export function chemFrac(mins: number): number {
  return clamp(mins / C().fullMinutes, 0, 1);
}

/** 그 동료와 패스 실행 배율 */
export function chemPassMul(mins: number): number {
  return 1 + C().maxPass * chemFrac(mins);
}

/** 내 경기 뒤: 같은 팀으로 뛴 동료마다 min(내 분, 그 동료 분)을 더한다 */
export function chemAfterMatch(state: GameState, players: readonly PlayerStats[] | undefined, side: 0 | 1, myId: string): void {
  if (!players) return;
  const me = players.find((p) => p.id === myId);
  if (!me || me.minutes <= 0) return;
  const ch = ensureChem(state);
  for (const p of players) {
    if (p.team !== side || p.id === myId || p.minutes <= 0) continue;
    const m = Math.min(me.minutes, p.minutes);
    ch.mins[p.id] = Math.round((ch.mins[p.id] ?? 0) + m);
  }
}

/** 시즌 끝: 지금 팀 로스터에 없는 동료는 지운다 (세이브 크기) */
export function chemSeasonEnd(state: GameState): void {
  const ch = state.chem;
  if (!ch || ch.teamId !== state.player.teamId) return;
  const ids = new Set((state.rosters[ch.teamId]?.players ?? []).map((p) => p.id));
  for (const id of Object.keys(ch.mins)) if (!ids.has(id)) delete ch.mins[id];
}

export interface ChemMateVM {
  id: string;
  name: string;
  position: string;
  minutes: number;
  /** 패스 성공 + % (소수 1자리) */
  bonus: number;
  label: '찰떡' | '호흡 좋음' | '알아 가는 중';
}

/** 선수 화면: 호흡 좋은 동료 상위 top (지금 로스터에 있는 동료만) */
export function topChemMates(state: GameState, n: number = C().top): ChemMateVM[] {
  const ch = state.chem;
  if (!ch || ch.teamId !== state.player.teamId) return [];
  const byId = new Map((state.rosters[ch.teamId]?.players ?? []).map((p) => [p.id, p]));
  return Object.entries(ch.mins)
    .filter(([id, m]) => m > 0 && byId.has(id))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([id, m]) => {
      const p = byId.get(id)!;
      const f = chemFrac(m);
      return {
        id, name: p.nameKo, position: p.position, minutes: m, bonus: Math.round((chemPassMul(m) - 1) * 1000) / 10,
        label: f >= C().great ? '찰떡' : f >= C().good ? '호흡 좋음' : '알아 가는 중',
      };
    });
}

/** 패스 받는 빈도 배율: 팀 관계(생활 지표) + 그 동료 호흡 */
export function passTargetMul(team: number, mins: number): number {
  const T = P();
  const rel = team < T.mid ? (-(T.mid - team) / T.mid) * T.relDown : ((team - T.mid) / (100 - T.mid)) * T.relUp;
  return clamp(1 + rel + chemFrac(mins) * T.chemUp, 1 - T.maxDown, 1 + T.maxUp);
}

// ── 상대 분석 리포트 ──

export type WeakKind = 'slow' | 'tackle' | 'aerial' | 'marking' | 'intercept';

export const WEAK_TEXT: Record<WeakKind, { name: string; tip: string; actions: ExploitAction[] }> = {
  slow: { name: '발이 느려요', tip: '뒷공간 침투 패스 · 1대1 돌파', actions: ['through', 'dribble'] },
  tackle: { name: '태클이 약해요', tip: '1대1 돌파', actions: ['dribble'] },
  aerial: { name: '공중볼에 약해요', tip: '크로스 · 헤더 경합', actions: ['cross', 'header'] },
  marking: { name: '마킹이 느슨해요', tip: '슈팅', actions: ['shoot'] },
  intercept: { name: '패스 길목을 못 읽어요', tip: '패스 · 침투 패스', actions: ['pass', 'through'] },
};

const ACTION_KO: Record<ExploitAction, string> = { pass: '패스', through: '침투 패스', dribble: '돌파', shoot: '슈팅', cross: '크로스', header: '헤더' };

function weakScores(a: FieldAttributes): Record<WeakKind, number> {
  return {
    slow: (a.pace + a.acceleration) / 2,
    tackle: a.tackling,
    aerial: (a.jumping + a.heading) / 2,
    marking: (a.marking + a.defensivePositioning) / 2,
    intercept: a.interception,
  };
}

export interface ScoutReport {
  defenderId: string;
  name: string;
  position: string;
  weak: { kind: WeakKind; name: string; tip: string; value: number }[];
  actions: ExploitAction[];
  /** 결정 순간 표시 (예: "돌파 · 침투 패스") */
  actionsKo: string;
  /** 실행 성공 + % */
  bonus: number;
}

/** 나를 맡을 수비수: 상대 선발 중 내 포지션의 맞상대 (counter 순서, 같은 자리가 여럿이면 슬롯 순서 첫 선수) */
export function markerOf(oppRoster: TeamRoster, myPos: string): RosterPlayer | null {
  const order = BALANCE.scouting.counter[myPos];
  if (!order) return null;
  const lu = pickLineup(oppRoster);
  const byId = new Map(oppRoster.players.map((p) => [p.id, p]));
  for (const pos of order) {
    const s = lu.slots.filter((x) => x.pos === pos).sort((a, b) => a.slot - b.slot)[0];
    const p = s ? byId.get(s.playerId) : undefined;
    if (p?.attributes) return p;
  }
  return null;
}

export function scoutReport(oppRoster: TeamRoster, myPos: string): ScoutReport | null {
  if (environmentFixed()) return null;
  const d = markerOf(oppRoster, myPos);
  if (!d?.attributes) return null;
  const sc = weakScores(d.attributes);
  const kinds = (Object.keys(sc) as WeakKind[]).sort((a, b) => sc[a] - sc[b]);
  const first = kinds[0]!;
  const pick = [first, ...(sc[kinds[1]!] - sc[first] <= BALANCE.scouting.secondGap ? [kinds[1]!] : [])];
  const actions = [...new Set(pick.flatMap((k) => WEAK_TEXT[k].actions))];
  return {
    defenderId: d.id, name: d.nameKo, position: d.position,
    weak: pick.map((k) => ({ kind: k, name: WEAK_TEXT[k].name, tip: WEAK_TEXT[k].tip, value: Math.round(sc[k]) })),
    actions, actionsKo: actions.map((x) => ACTION_KO[x]).join(' · '),
    bonus: Math.round((BALANCE.scouting.mul - 1) * 1000) / 10,
  };
}

/** 엔진 입력 (내 경기). 호흡 0·관계 보통·리포트 없음이면 undefined (이전 엔진 입력과 같은 모양) */
export function rapportInput(state: GameState, myRoster: TeamRoster, report: ScoutReport | null): RapportInput | undefined {
  if (environmentFixed()) return undefined;
  const ch = state.chem && state.chem.teamId === state.player.teamId ? state.chem.mins : {};
  const team = state.life?.team ?? P().mid;
  const chem: Record<string, number> = {};
  const toMe: Record<string, number> = {};
  for (const p of myRoster.players) {
    const m = ch[p.id] ?? 0;
    const cm = chemPassMul(m);
    if (cm !== 1) chem[p.id] = cm;
    const tm = passTargetMul(team, m);
    if (tm !== 1) toMe[p.id] = tm;
  }
  const out: RapportInput = {
    ...(Object.keys(chem).length ? { chem } : {}),
    ...(Object.keys(toMe).length ? { toMe } : {}),
    ...(report ? { scout: { defender: report.defenderId, actions: report.actions, mul: BALANCE.scouting.mul } } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}
