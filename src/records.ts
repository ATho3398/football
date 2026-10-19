// 기록 추적·도전 과제 (C.74b, pending 77-10): "구단 최다 골까지 12골"처럼 남은 기록을 보여 주고, 깨면 작게 보상한다 (XP·위상 소량, 카드 선택권 없음).
// 데이터가 있는 기록만: 내 리그 통산(골·도움·출전 이정표), 구단 통산 최다 골(2018~ 이 세계 기록, 지난 시즌 기록 + 이번 시즌),
// 리그 한 시즌 최다 골(지난 시즌 기록), 내 한 시즌 최다 골(커리어 최고). 모두 리그 경기 기준. 수치는 BALANCE.records

import { BALANCE } from './config/balance';
import { MY_ID } from './engine/adapter';
import { addXp } from './growth';
import { teamById } from './league';
import type { GameState } from './game';

const R = () => BALANCE.records;

export type RecordKind = 'milestone' | 'club' | 'league' | 'best';

/** 남은 기록 한 줄 */
export interface RecordTrack {
  /** 달성 기록 id (한 번만 보상): cg:100 · ca:50 · cs:200 · club:<팀> · lg:<시즌> · pb:<시즌> */
  id: string;
  kind: RecordKind;
  /** "리그 통산 100골" · "토트넘 구단 최다 골 (2018~)" */
  label: string;
  /** 기록 보유 (구단·리그 기록) */
  holder?: string;
  cur: number;
  target: number;
  unit: '골' | '도움' | '경기';
}

/** 깬 기록 (토스트·인박스) */
export interface RecordHit { id: string; title: string; xp: number; rep: number }

export interface RecordsState {
  /** 보상까지 끝난 기록 id */
  done: string[];
  /** 아직 화면에 띄우지 않은 달성 (토스트 뒤 비운다) */
  fresh: RecordHit[];
}

const inSeason = (g: GameState) => g.phase === 'season';

/** 내 리그 통산 (지난 시즌 기록 + 이번 시즌) */
function careerLine(g: GameState): { goals: number; assists: number; apps: number } {
  const h = g.player.history;
  const s = inSeason(g) ? g.player.season : null;
  return {
    goals: h.reduce((t, r) => t + r.goals, 0) + (s?.goals ?? 0),
    assists: h.reduce((t, r) => t + r.assists, 0) + (s?.assists ?? 0),
    apps: h.reduce((t, r) => t + r.apps, 0) + (s?.apps ?? 0),
  };
}

/** 구단 통산 최다 골 (2018~, 내 선수 제외): 지난 시즌 선수 합계(그 시즌 소속) + 이번 시즌 */
function clubTop(g: GameState, teamId: string): { name: string; goals: number } | null {
  const sum = new Map<string, { name: string; goals: number }>();
  const add = (id: string, name: string | undefined, team: string | undefined, goals: number) => {
    if (id === MY_ID || team !== teamId || goals <= 0) return;
    const e = sum.get(id) ?? { name: name ?? id, goals: 0 };
    e.goals += goals;
    sum.set(id, e);
  };
  for (const a of g.archive ?? []) for (const [id, t] of Object.entries(a.players)) add(id, a.names?.[id]?.[0], a.names?.[id]?.[1], t[1]);
  if (inSeason(g)) for (const [id, t] of Object.entries(g.playerStats ?? {})) add(id, g.statNames?.[id]?.[0], g.statNames?.[id]?.[1], t[1]);
  let best: { name: string; goals: number } | null = null;
  for (const e of sum.values()) if (!best || e.goals > best.goals) best = e;
  return best;
}

/** 리그 한 시즌 최다 골 (지난 시즌 기록, 내 선수 포함) */
function leagueSeasonTop(g: GameState): { name: string; goals: number; season: number } | null {
  let best: { name: string; goals: number; season: number } | null = null;
  for (const a of g.archive ?? []) for (const [id, t] of Object.entries(a.players)) {
    if (id !== MY_ID && (!best || t[1] > best.goals)) best = { name: a.names?.[id]?.[0] ?? id, goals: t[1], season: a.season };
  }
  for (const r of g.player.history) if (!best || r.goals > best.goals) best = { name: g.player.name, goals: r.goals, season: r.season };
  return best && best.goals > 0 ? best : null;
}

/** 지금 노릴 수 있는 기록 전부 (깨지 않은 것만) */
export function recordTracks(g: GameState): RecordTrack[] {
  const C = R();
  const done = new Set(g.records?.done ?? []);
  const me = careerLine(g);
  const out: RecordTrack[] = [];
  const mile = (key: string, list: readonly number[], cur: number, unit: RecordTrack['unit'], what: string) => {
    // 아직 보상하지 않은 가장 작은 이정표 (이미 넘었으면 다음 경기 뒤 보상)
    const t = list.find((n) => !done.has(`${key}:${n}`));
    if (t !== undefined) out.push({ id: `${key}:${t}`, kind: 'milestone', label: `리그 통산 ${t}${what}`, cur, target: t, unit });
  };
  mile('cg', C.goals, me.goals, '골', '골');
  mile('ca', C.assists, me.assists, '도움', '도움');
  mile('cs', C.apps, me.apps, '경기', '경기 출전');
  if (!inSeason(g)) return out;
  const team = g.player.teamId;
  const club = clubTop(g, team);
  const mine = g.player.history.filter((r) => r.teamId === team).reduce((t, r) => t + r.goals, 0) + g.player.season.goals;
  if (club && club.goals >= C.minClub && !done.has(`club:${team}`)) {
    out.push({ id: `club:${team}`, kind: 'club', label: `${teamById(g.league, team).nameKo} 구단 최다 골 (2018~)`, holder: `${club.name} ${club.goals}골`, cur: mine, target: club.goals + 1, unit: '골' });
  }
  const season = g.league.season;
  const lg = leagueSeasonTop(g);
  if (lg && !done.has(`lg:${season}`)) {
    out.push({ id: `lg:${season}`, kind: 'league', label: '리그 한 시즌 최다 골 (2018~)', holder: `${lg.name} ${lg.goals}골`, cur: g.player.season.goals, target: lg.goals + 1, unit: '골' });
  }
  const best = Math.max(0, ...g.player.history.map((r) => r.goals));
  if (best >= C.minBest && !done.has(`pb:${season}`)) {
    out.push({ id: `pb:${season}`, kind: 'best', label: '내 한 시즌 최다 골', holder: `${best}골`, cur: g.player.season.goals, target: best + 1, unit: '골' });
  }
  return out;
}

/** 홈·선수 화면에 보일 기록 (남은 비율이 작은 순, 최대 show 줄) */
export function shownTracks(g: GameState, n: number = R().show): RecordTrack[] {
  return recordTracks(g)
    .filter((t) => t.target > t.cur)
    .sort((a, b) => (a.target - a.cur) / a.target - (b.target - b.cur) / b.target || a.target - a.cur - (b.target - b.cur))
    .slice(0, n);
}

const TITLE: Record<RecordKind, (t: RecordTrack) => string> = {
  milestone: (t) => `${t.label} 달성`,
  club: (t) => `${t.label} 경신`,
  league: (t) => `${t.label} 경신`,
  best: (t) => `${t.label} 경신`,
};

/** 경기 뒤: 깬 기록을 보상하고(XP·위상 소량) fresh 에 쌓는다. 깬 기록을 돌려준다 */
export function recordsAfterMatch(g: GameState): RecordHit[] {
  const st = (g.records ??= initRecords(g));
  const hits: RecordHit[] = [];
  // 이정표는 한 경기에 둘 이상 넘을 수 있어 깨진 것이 없을 때까지 다시 본다
  for (let guard = 0; guard < 8; guard++) {
    const reached = recordTracks(g).filter((t) => t.cur >= t.target);
    if (!reached.length) break;
    for (const t of reached) {
      const [xp, rep] = R().reward[t.kind];
      st.done.push(t.id);
      addXp(g.player, xp);
      g.player.reputation = Math.min(BALANCE.reputation.max, g.player.reputation + rep);
      const hit = { id: t.id, title: TITLE[t.kind](t), xp, rep };
      hits.push(hit);
      st.fresh.push(hit);
    }
  }
  return hits;
}

/** 새 기록 상태. 이미 넘은 이정표는 보상 없이 달성으로 둔다 (새 게임·옛 세이브) */
export function initRecords(g: GameState): RecordsState {
  const C = R();
  const me = careerLine(g);
  const done = [
    ...C.goals.filter((n) => n <= me.goals).map((n) => `cg:${n}`),
    ...C.assists.filter((n) => n <= me.assists).map((n) => `ca:${n}`),
    ...C.apps.filter((n) => n <= me.apps).map((n) => `cs:${n}`),
  ];
  return { done, fresh: [] };
}

/** 화면이 띄울 달성 (꺼내면 비운다) */
export function takeFreshRecords(g: GameState): RecordHit[] {
  const f = g.records?.fresh ?? [];
  if (g.records) g.records.fresh = [];
  return f;
}
