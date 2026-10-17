// 선수 이름 색인 (부록 C.44a): 세계의 모든 선수(내 선수·로스터·리그 밖 실제 선수)의 자동 짧은 이름.
// 설정 화면은 세계 전체로, 경기 화면은 그 경기 두 팀 명단 안에서 겹침을 본다 (C.45, pending 60). 세이브에 넣지 않는다

import { A_GRADE_PLAYERS } from '../../data/players';
import { LEGEND_BY_ID } from '../legends';
import type { GameState } from '../game';
import { labelName, shortNames, type NameEntry } from '../names';
import { myFace } from './viewModels';

const REAL = new Map(A_GRADE_PLAYERS.map((p) => [p.id, p]));

export interface NamedPlayer extends NameEntry {
  /** 팀 id (리그 밖이면 없음) */
  teamId?: string;
  /** 리그 밖 소속 이름 */
  club?: string;
  mine?: boolean;
  /** 목록 보조 줄 (C.59) */
  position?: string;
  age?: number;
}

/** 세계의 모든 선수 (내 선수가 맨 앞, id 중복 없음) */
export function worldPlayers(g: GameState): NamedPlayer[] {
  const out = new Map<string, NamedPlayer>();
  const me = myFace(g).id;
  const real = g.player.realPlayerId ? REAL.get(g.player.realPlayerId) : undefined;
  const legend = g.player.legendId ? LEGEND_BY_ID.get(g.player.legendId) : undefined;
  out.set(me, { id: me, nameKo: g.player.name, mine: true, teamId: g.player.teamId, ...(real ? { name: real.name, ...(real.shortKo ? { shortKo: real.shortKo } : {}) } : {}), ...(legend ? { name: legend.name, shortKo: legend.shortKo } : {}) });
  for (const [teamId, r] of Object.entries(g.rosters ?? {})) {
    for (const p of r.players) {
      if (out.has(p.id)) continue;
      const sk = REAL.get(p.id)?.shortKo ?? LEGEND_BY_ID.get(p.id)?.shortKo;
      out.set(p.id, { id: p.id, name: p.name, nameKo: p.nameKo, teamId, position: p.position, age: p.age, ...(sk ? { shortKo: sk } : {}) });
    }
  }
  for (const n of g.npcs) {
    if (out.has(n.id) || n.retired) continue;
    const sk = REAL.get(n.id)?.shortKo;
    out.set(n.id, { id: n.id, name: n.name, nameKo: n.nameKo, club: n.club, position: n.position, age: n.age, ...(sk ? { shortKo: sk } : {}) });
  }
  return [...out.values()];
}

let cache: { key: unknown[]; map: Map<string, string> } | null = null;

/** 자동 짧은 이름 (id → 이름). 로스터·NPC·이적·시즌·내 이름이 바뀌면 다시 계산 */
export function autoShortNames(g: GameState): Map<string, string> {
  const key = [g.rosters, g.npcs, g.transfers.length, g.league.season, g.player.name, g.player.teamId];
  if (!cache || cache.key.length !== key.length || cache.key.some((k, i) => k !== key[i])) cache = { key, map: shortNames(worldPlayers(g)) };
  return cache.map;
}

let scoped: { key: unknown[]; map: Map<string, string> } | null = null;

/**
 * 한 경기 명단 안의 자동 짧은 이름 (C.45, pending 60): 첫 글자 붙이는 겹침 판정을 세계 전체가 아니라 그 경기 두 팀 명단(교체 포함) 안에서.
 * ids 는 리플레이 선수 id (내 선수는 엔진 id 'me' 대신 isMe 로 표시된 선수)
 */
export function matchShortNames(g: GameState, scope: ReadonlyMap<string, { isMe: boolean; name: string }>): Map<string, string> {
  const key = [scope, g.rosters, g.npcs, g.player.name];
  if (scoped && scoped.key.length === key.length && scoped.key.every((k, i) => k === key[i])) return scoped.map;
  const world = new Map(worldPlayers(g).map((p) => [p.id, p]));
  const me = myFace(g).id;
  const entries: NameEntry[] = [];
  for (const [id, info] of scope) {
    const pid = info.isMe ? me : id;
    entries.push(world.get(pid) ?? { id: pid, nameKo: info.name });
  }
  scoped = { key, map: shortNames(entries) };
  return scoped.map;
}

/** 경기 화면 라벨 이름: 별명 > 직접 고친 짧은 이름 > 자동 짧은 이름(그 경기 명단 안 겹침, 명단을 모르면 세계 기준). 리플레이의 내 선수 id 는 엔진 id 라 isMe 로 고른다 */
export function pitchLabel(g: GameState, id: string, isMe: boolean, fallback: string, scope?: ReadonlyMap<string, { isMe: boolean; name: string }>): string {
  const pid = isMe ? myFace(g).id : id;
  const auto = scope ? matchShortNames(g, scope).get(pid) : autoShortNames(g).get(pid);
  return labelName(pid, auto, isMe ? g.player.name : fallback, g.nameOverrides);
}
