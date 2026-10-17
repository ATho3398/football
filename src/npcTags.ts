// NPC 커리어 태그 (C.45 14번): 모든 선수(실제·생성)에 유스 출신 구단과 원클럽맨·영원한 <구단>을 같은 규칙으로.
// 저장하지 않고 로스터(입단 시즌)·실제 선수 경력 표·선수 id 시드로 계산한다. 새로 붙은 태그는 시즌 끝 뉴스에만 (내 선수는 홈 알림)

import { REAL_CAREER } from '../data/players/careers';
import { OUTSIDE_CLUBS } from '../data/outsideClubs';
import { BALANCE } from './config/balance';
import type { GameState } from './game';
import type { RosterPlayer } from './roster';
import { createRng, hashSeed } from './rng';

const START = BALANCE.newGame.startYear;

/** NPC 유스 구단: 실제 선수는 경력 표, 생성 선수는 만든 구단(id 의 팀) 유스일 확률 npcOwnYouth, 아니면 리그 밖 포함 랜덤 */
export function npcYouth(state: Pick<GameState, 'league'>, p: Pick<RosterPlayer, 'id' | 'real'>): string {
  const real = REAL_CAREER[p.id];
  if (real) return real.youth;
  const own = /^v:([^:]+):/.exec(p.id)?.[1];
  const rng = createRng(hashSeed(`youth:${p.id}`));
  if (own && rng() < BALANCE.tags.npcOwnYouth) return own;
  const all = [...state.league.teams.map((t) => t.id), ...OUTSIDE_CLUBS.map((c) => c.id)];
  return all[Math.floor(rng() * all.length)]!;
}

/** 지금 구단에서 뛴 시즌 수 (이번 시즌 포함). 세계 시작부터 있던 선수는 그 전 시즌도 (실제: 입단 시즌, 생성: 시드) */
export function npcClubSeasons(state: Pick<GameState, 'league'>, p: Pick<RosterPlayer, 'id' | 'joined' | 'age'>, teamId: string, season = state.league.season): number {
  const now = season - p.joined + 1;
  if (p.joined !== START) return now;
  const real = REAL_CAREER[p.id];
  if (real) return now + Math.max(0, START - real.since);
  const age0 = p.age - (season - START);
  const youth = npcYouth(state, { id: p.id, real: false });
  const prior = youth === teamId ? Math.max(0, age0 - 18) : Math.floor(createRng(hashSeed(`club-years:${p.id}`))() * 4);
  return now + Math.min(prior, Math.max(0, age0 - 17));
}

/** NPC 커리어 태그 (이름만): 영원한 <구단> / 원클럽맨 / 없음 */
export function npcCareerTag(state: GameState, p: RosterPlayer, teamId: string, season = state.league.season): string | null {
  if (npcClubSeasons(state, p, teamId, season) < BALANCE.tags.oneClub.seasons) return null;
  const name = state.league.teams.find((t) => t.id === teamId)?.nameKo ?? teamId;
  return npcYouth(state, p) === teamId ? `영원한 ${name}` : '원클럽맨';
}

export interface TagNews { season: number; id: string; name: string; teamId: string; tag: string }

/** 로스터 전체 NPC 태그 (선수 id → 태그 이름) */
export function npcTagMap(state: GameState, season = state.league.season): Map<string, string> {
  const out = new Map<string, string>();
  for (const [teamId, r] of Object.entries(state.rosters ?? {})) {
    for (const p of r.players) {
      const t = npcCareerTag(state, p, teamId, season);
      if (t) out.set(p.id, t);
    }
  }
  return out;
}

/** 시즌 갱신 전후 비교: 새로 붙은 NPC 태그를 뉴스로 (최근 3시즌만 남긴다) */
export function recordTagNews(state: GameState, before: Map<string, string>, season: number): void {
  const after = npcTagMap(state, season);
  const news = (state.tagNews ?? []).filter((n) => n.season > season - 3);
  for (const [teamId, r] of Object.entries(state.rosters ?? {})) {
    for (const p of r.players) {
      const t = after.get(p.id);
      if (t && before.get(p.id) !== t) news.push({ season, id: p.id, name: p.nameKo, teamId, tag: t });
    }
  }
  state.tagNews = news;
}
