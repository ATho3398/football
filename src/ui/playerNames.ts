// 선수 이름 색인 (부록 C.44a): 세계의 모든 선수(내 선수·로스터·리그 밖 실제 선수)의 자동 짧은 이름.
// 같은 짧은 이름끼리만 첫 글자를 붙이므로 세계 전체로 계산한다. 시즌·로스터·이적이 바뀌면 다시 (세이브에 넣지 않는다)

import { A_GRADE_PLAYERS } from '../../data/players';
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
}

/** 세계의 모든 선수 (내 선수가 맨 앞, id 중복 없음) */
export function worldPlayers(g: GameState): NamedPlayer[] {
  const out = new Map<string, NamedPlayer>();
  const me = myFace(g).id;
  const real = g.player.realPlayerId ? REAL.get(g.player.realPlayerId) : undefined;
  out.set(me, { id: me, nameKo: g.player.name, mine: true, teamId: g.player.teamId, ...(real ? { name: real.name, ...(real.shortKo ? { shortKo: real.shortKo } : {}) } : {}) });
  for (const [teamId, r] of Object.entries(g.rosters ?? {})) {
    for (const p of r.players) {
      if (out.has(p.id)) continue;
      const sk = REAL.get(p.id)?.shortKo;
      out.set(p.id, { id: p.id, name: p.name, nameKo: p.nameKo, teamId, ...(sk ? { shortKo: sk } : {}) });
    }
  }
  for (const n of g.npcs) {
    if (out.has(n.id) || n.retired) continue;
    const sk = REAL.get(n.id)?.shortKo;
    out.set(n.id, { id: n.id, name: n.name, nameKo: n.nameKo, club: n.club, ...(sk ? { shortKo: sk } : {}) });
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

/** 경기 화면 라벨 이름: 별명 > 직접 고친 짧은 이름 > 자동 짧은 이름. 리플레이의 내 선수 id 는 엔진 id 라 isMe 로 고른다 */
export function pitchLabel(g: GameState, id: string, isMe: boolean, fallback: string): string {
  const pid = isMe ? myFace(g).id : id;
  return labelName(pid, autoShortNames(g).get(pid), isMe ? g.player.name : fallback, g.nameOverrides);
}
