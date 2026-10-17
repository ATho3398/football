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
export function npcYouth(state: Pick<GameState, 'league'>, p: Pick<RosterPlayer, 'id' | 'real'> & { youth?: string }): string {
  const real = REAL_CAREER[p.id];
  if (real) return real.youth;
  if (p.youth) return p.youth;
  const own = /^v:([^:]+):/.exec(p.id)?.[1];
  const rng = createRng(hashSeed(`youth:${p.id}`));
  if (own && rng() < BALANCE.tags.npcOwnYouth) return own;
  const all = [...state.league.teams.map((t) => t.id), ...OUTSIDE_CLUBS.map((c) => c.id)];
  return all[Math.floor(rng() * all.length)]!;
}

/** 지금 구단에서 뛴 시즌 수 (이번 시즌 포함). 세계 시작부터 있던 선수는 그 전 시즌도 (실제: 입단 시즌, 생성: 시드) */
export function npcClubSeasons(state: Pick<GameState, 'league'>, p: Pick<RosterPlayer, 'id' | 'joined' | 'age' | 'youth'>, teamId: string, season = state.league.season): number {
  const now = season - p.joined + 1;
  if (p.joined !== START) return now;
  const real = REAL_CAREER[p.id];
  if (real) return now + Math.max(0, START - real.since);
  const age0 = p.age - (season - START);
  const youth = npcYouth(state, { id: p.id, real: false, ...(p.youth ? { youth: p.youth } : {}) });
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

/**
 * NPC 자연 발생 태그 소식 (pending 65, C.47): 시즌 끝 이번 시즌 선수 기록(엔진 경기)으로 득점 기계·도움 장인·원더키드·노익장·저니맨.
 * NPC 태그는 저장하지 않고 소식에만 남긴다 (같은 선수의 같은 유지형 태그는 한 번만, 기록형은 시즌마다)
 */
export function recordNaturalNews(state: GameState, season: number): void {
  const N = BALANCE.tags.natural;
  const stats = state.playerStats ?? {};
  const news = state.tagNews ?? [];
  const seen = new Set(news.map((n) => `${n.id}:${n.tag}`));
  const push = (p: RosterPlayer, teamId: string, tag: string, once: boolean) => {
    if (once && seen.has(`${p.id}:${tag}`)) return;
    seen.add(`${p.id}:${tag}`);
    news.push({ season, id: p.id, name: p.nameKo, teamId, tag });
  };
  const all = Object.entries(state.rosters ?? {}).flatMap(([teamId, r]) => r.players.map((p) => ({ p, teamId, t: stats[p.id] })));
  const top = (k: 1 | 2) => {
    const best = Math.max(0, ...all.map((x) => x.t?.[k] ?? 0));
    return best > 0 ? all.filter((x) => (x.t?.[k] ?? 0) === best) : [];
  };
  for (const x of top(1)) push(x.p, x.teamId, '득점 기계', false);
  for (const x of top(2)) push(x.p, x.teamId, '도움 장인', false);
  const clubs = new Map<string, Set<string>>();
  for (const r of state.transfers ?? []) {
    const c = clubs.get(r.id) ?? new Set<string>();
    c.add(r.from);
    c.add(r.to);
    clubs.set(r.id, c);
  }
  for (const { p, teamId, t } of all) {
    const avg = t && t[0] > 0 ? t[3] / 10 / t[0] : null;
    if (t && t[0] >= 15 && p.age <= N.wonderAge && ((avg ?? 0) >= N.wonderRating || t[1] >= N.wonderPoints || t[2] >= N.wonderPoints)) push(p, teamId, '원더키드', true);
    if (t && t[0] >= 15 && p.age >= BALANCE.tags.evergreen.fromAge && (avg ?? 0) >= BALANCE.tags.evergreen.rating) push(p, teamId, '노익장', true);
    if ((clubs.get(p.id)?.size ?? 0) >= N.journeyClubs) push(p, teamId, '저니맨', true);
  }
  state.tagNews = news;
}
