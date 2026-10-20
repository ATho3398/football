// 월드 정보·NPC 시즌 통계 (18.5, 부록 C.64).
// 통계 자체는 엔진 기록이다(다른 경기도 22명 엔진, state.playerStats). 여기서는 그 기록으로 리그 기록 순위(득점·도움·평점),
// 시즌 시상(득점왕·도움왕·최고 평점·영플레이어), NPC 위상(OVR 근사 + 기록 + 수상), 기록 소식(인박스), 지난 시즌 세이브 상한을 만든다.
// 수치는 BALANCE.world

import { BALANCE } from './config/balance';
import { MY_ID } from './engine/adapter';
import { npcReputation } from './finance';
import { pushInbox } from './inbox';
import { gamesPerTeam, sortedTable, teamById } from './league';
import { isU21 } from './squad';
import type { GameState, PlayerTotals, SeasonArchive } from './game';

const W = () => BALANCE.world;

export type BoardKind = 'goals' | 'assists' | 'rating';
export type AwardKind = 'goals' | 'assists' | 'rating' | 'young';

export const AWARD_KO: Record<AwardKind, string> = { goals: '득점왕', assists: '도움왕', rating: '최고 평점', young: '영플레이어' };

/** 이번 시즌 선수 한 줄 (내 선수 포함). 리그를 떠난 선수는 statNames 의 이름·팀, 나이는 모름(null) */
export interface StatRow { id: string; name: string; teamId: string; age: number | null; apps: number; goals: number; assists: number; avg: number; minutes: number; me: boolean }

/** 시즌 기록이 있는 모든 선수 + 내 선수 (출전했으면) */
export function seasonRows(g: GameState): StatRow[] {
  const who = new Map<string, { name: string; teamId: string; age: number }>();
  for (const [teamId, r] of Object.entries(g.rosters ?? {})) for (const p of r.players) who.set(p.id, { name: p.nameKo, teamId, age: p.age });
  const rows: StatRow[] = Object.entries(g.playerStats ?? {}).map(([id, t]) => {
    const w = who.get(id);
    const [apps, goals, assists, r10] = t;
    return {
      id, name: w?.name ?? g.statNames?.[id]?.[0] ?? id, teamId: w?.teamId ?? g.statNames?.[id]?.[1] ?? '', age: w?.age ?? null,
      apps, goals, assists, avg: apps ? r10 / apps / 10 : 0, minutes: t[4] ?? 0, me: false,
    };
  });
  const s = g.player.season;
  if (s.apps > 0) {
    // 시즌 끝(비시즌)에는 이미 나이 +1 이 되어 있다
    const age = g.phase === 'season' ? g.player.age : g.player.age - 1;
    rows.push({ id: MY_ID, name: g.player.name, teamId: g.player.teamId, age, apps: s.apps, goals: s.goals, assists: s.assists, avg: s.ratingSum / s.apps, minutes: 0, me: true });
  }
  return rows;
}

/** 평점 순위 자격 출전 수 (지난 라운드 비례) */
export function ratingMinApps(g: GameState): number {
  return Math.max(W().ratingMinApps, Math.round(g.league.round * W().ratingMinShare));
}

const BY: Record<BoardKind, (a: StatRow, b: StatRow) => number> = {
  goals: (a, b) => b.goals - a.goals || b.assists - a.assists || a.apps - b.apps || (a.id < b.id ? -1 : 1),
  assists: (a, b) => b.assists - a.assists || b.goals - a.goals || a.apps - b.apps || (a.id < b.id ? -1 : 1),
  rating: (a, b) => b.avg - a.avg || b.apps - a.apps || (a.id < b.id ? -1 : 1),
};

/** 순위에 드는 줄 (득점·도움은 1개 이상, 평점은 자격 출전 이상) */
function eligible(g: GameState, rows: StatRow[], kind: BoardKind): StatRow[] {
  if (kind === 'goals') return rows.filter((r) => r.goals > 0);
  if (kind === 'assists') return rows.filter((r) => r.assists > 0);
  const min = ratingMinApps(g);
  return rows.filter((r) => r.apps >= min);
}

export interface BoardRow extends StatRow { rank: number }

/**
 * 리그 기록 순위 (18.5): 상위 limit 명. 내 선수가 순위 안(자격)이지만 limit 밖이면 맨 끝에 자기 순위로 붙인다.
 * 순위에 못 드는 내 선수(골 0 등)는 득점 탭에서만 0으로 붙인다 (C.38 득점 순위와 같게)
 */
export function leaderboard(g: GameState, kind: BoardKind, limit: number = W().boardSize, rows = seasonRows(g)): BoardRow[] {
  const list = eligible(g, rows, kind).sort(BY[kind]).map((r, i) => ({ ...r, rank: i + 1 }));
  const out = list.slice(0, limit);
  const mine = list.find((r) => r.me);
  if (mine && mine.rank > limit) out.push(mine);
  if (!mine && kind === 'goals') {
    const me = rows.find((r) => r.me);
    if (me) out.push({ ...me, rank: list.length + 1 });
  }
  return out;
}

/** 내 선수 순위 (그 기록 순위에 없으면 null) */
export function myRank(g: GameState, kind: BoardKind, rows = seasonRows(g)): number | null {
  const list = eligible(g, rows, kind).sort(BY[kind]);
  const i = list.findIndex((r) => r.me);
  return i < 0 ? null : i + 1;
}

export interface Award { kind: AwardKind; id: string; name: string; teamId: string; value: number; me: boolean }

/** 시즌 시상 (C.44 + C.64 영플레이어): 득점왕(골) · 도움왕(도움) · 최고 평점(출전 bestMinApps+) · 영플레이어(21세 이하, youngMinApps+, 평점) */
export function seasonAwards(g: GameState, rows = seasonRows(g)): Award[] {
  const out: Award[] = [];
  const top = (kind: AwardKind, list: StatRow[], cmp: (a: StatRow, b: StatRow) => number, value: (r: StatRow) => number) => {
    const r = [...list].sort(cmp)[0];
    if (r) out.push({ kind, id: r.id, name: r.name, teamId: r.teamId, value: value(r), me: r.me });
  };
  top('goals', rows.filter((r) => r.goals > 0), BY.goals, (r) => r.goals);
  top('assists', rows.filter((r) => r.assists > 0), BY.assists, (r) => r.assists);
  top('rating', rows.filter((r) => r.apps >= W().bestMinApps), BY.rating, (r) => r.avg);
  top('young', rows.filter((r) => r.age !== null && isU21(r.age) && r.apps >= W().youngMinApps), BY.rating, (r) => r.avg);
  return out;
}

/** 시상 값 글 (골·도움·평점) */
export function awardValue(a: { kind: AwardKind; value: number }): string {
  return a.kind === 'goals' ? `${a.value}골` : a.kind === 'assists' ? `${a.value}도움` : a.value.toFixed(2);
}

/** 보존 기록용 시상 줄 [종류, 선수 id, 값(평점은 ×100 정수)] */
export function archiveAwards(g: GameState): NonNullable<SeasonArchive['aw']> {
  return seasonAwards(g).map((a) => [a.kind, a.id, a.kind === 'rating' || a.kind === 'young' ? Math.round(a.value * 100) : a.value]);
}

/** 옛 보존 기록(시상 줄 없음)의 시상: 그 시즌 선수 합계에서 (나이를 몰라 영플레이어는 없음) */
export function awardsFromTotals(players: Record<string, PlayerTotals>): NonNullable<SeasonArchive['aw']> {
  const rows: StatRow[] = Object.entries(players).map(([id, [apps, goals, assists, r10]]) => ({ id, name: id, teamId: '', age: null, apps, goals, assists, avg: apps ? r10 / apps / 10 : 0, minutes: 0, me: false }));
  const out: NonNullable<SeasonArchive['aw']> = [];
  const g = [...rows].filter((r) => r.goals > 0).sort(BY.goals)[0];
  if (g) out.push(['goals', g.id, g.goals]);
  const a = [...rows].filter((r) => r.assists > 0).sort(BY.assists)[0];
  if (a) out.push(['assists', a.id, a.assists]);
  const b = [...rows].filter((r) => r.apps >= W().bestMinApps).sort(BY.rating)[0];
  if (b) out.push(['rating', b.id, Math.round(b.avg * 100)]);
  return out;
}

// ── NPC 위상 (C.63a 라이벌이 OVR 로 대신하던 것) ──

/** 시즌 기록 점수 (출전 perfMinApps 미만이면 0) */
function perfScore(t: PlayerTotals | undefined, games: number): number {
  const S = W().standing;
  if (!t || t[0] < S.perfMinApps) return 0;
  const [apps, goals, assists, r10] = t;
  const v = (r10 / apps / 10 - S.perfAvg) * S.perfPerRating + ((goals + assists) / apps) * games * S.perfPerGa38;
  return Math.max(-S.perfMin, Math.min(S.perfMax, v));
}

/** 최근 honorSeasons 시즌 수상 횟수 (비시즌이면 이번 시즌 시상 포함) */
export function npcHonors(g: GameState, id: string): number {
  const S = W().standing;
  let n = 0;
  for (const s of (g.archive ?? []).slice(-S.honorSeasons)) for (const [, who] of s.aw ?? []) if (who === id) n++;
  if (g.phase !== 'season') for (const a of seasonAwards(g)) if (a.id === id) n++;
  return n;
}

/**
 * NPC 위상 (0~1000, 내 선수 위상과 같은 눈금): OVR 근사(finance.npcRep, 연봉·몸값과 같은 값) + 기록 + 수상.
 * 기록은 이번 시즌(출전 비례 비중)과 지난 시즌을 섞는다
 */
export function npcStanding(g: GameState, id: string, ovr: number): number {
  const S = W().standing;
  const cur = g.playerStats?.[id];
  const last = g.archive?.at(-1)?.players[id];
  const w = cur ? Math.min(1, cur[0] / S.curFullApps) : 0;
  // 시즌 경기 수 (C.75m): 리그별 (PL 38)
  const games = gamesPerTeam(g.league);
  const perf = perfScore(cur, games) * w + perfScore(last, games) * (1 - w);
  const honor = Math.min(S.honorMax, npcHonors(g, id) * S.honorRep);
  return Math.round(Math.max(0, Math.min(BALANCE.reputation.max, npcReputation(ovr) + perf + honor)));
}

// ── 기록 소식 (인박스, 20.4) ──

const nameTeam = (g: GameState, r: StatRow) => `${r.name}${r.teamId && g.league.teams.some((t) => t.id === r.teamId) ? `(${teamById(g.league, r.teamId).nameKo})` : ''}`;

/** 내 경기 뒤 (라운드를 마쳤을 때): raceRounds 라운드면 득점·도움 경쟁 기사. 다른 경기를 빠른 진행으로 돌려 기록이 없으면 안 낸다 */
export function worldAfterRound(state: GameState): void {
  const round = state.league.round;
  if (!W().raceRounds.includes(round) || state.events?.off) return;
  if (!Object.keys(state.playerStats ?? {}).length) return;
  const rows = seasonRows(state);
  const goals = leaderboard(state, 'goals', 3, rows).filter((r) => r.goals > 0 && r.rank <= 3);
  const ast = leaderboard(state, 'assists', 1, rows).find((r) => r.rank === 1);
  if (!goals.length) return;
  const mr = myRank(state, 'goals', rows);
  const me = rows.find((r) => r.me);
  const lines = goals.map((r) => `${r.rank}위 ${nameTeam(state, r)} ${r.goals}골`).join(' · ');
  const meLine = me && mr && mr > 3 && me.goals > 0 ? ` ${state.player.name}은(는) ${me.goals}골로 ${mr}위.` : '';
  const astLine = ast ? ` 도움 1위는 ${nameTeam(state, ast)} ${ast.assists}개.` : '';
  pushInbox(state, {
    cat: 'media', key: `race:${state.league.season}:${round}`,
    title: mr && mr <= 3 ? `득점 경쟁 ${mr}위 · ${state.player.name}` : `득점 경쟁 · ${round}라운드`,
    body: `${round}라운드까지 득점 순위: ${lines}.${meLine}${astLine}`,
    link: { act: 'world-tab', v: 'scorers', label: '리그 기록 보기' },
  });
}

/** 시즌 끝 (endSeason, 비시즌): 시즌 시상 기사 */
export function worldSeasonEnd(state: GameState): void {
  if (state.events?.off) return;
  const aw = seasonAwards(state);
  if (!aw.length) return;
  const champ = sortedTable(state.league)[0];
  const mine = aw.filter((a) => a.me).map((a) => AWARD_KO[a.kind]);
  pushInbox(state, {
    cat: 'media', key: `awards:${state.league.season}`,
    title: mine.length ? `시즌 시상 · ${mine.join(' · ')} 수상` : '시즌 시상 발표',
    body: `${champ ? `우승 ${teamById(state.league, champ.teamId).nameKo}. ` : ''}${aw.map((a) => `${AWARD_KO[a.kind]} ${a.me ? state.player.name : a.name} ${awardValue(a)}`).join(' · ')}.`,
    link: { to: 'season', label: '시즌 요약 보기' },
  });
}

// ── 세이브 상한 (지난 시즌 요약) ──

/**
 * 지난 시즌 보존 기록 줄이기: 최근 fullSeasons 시즌은 그대로, 그 앞은 선수 기록을 득점·도움·평점 상위 keepTop 명 + 그 시즌 내 팀 선수 + 수상자만,
 * 다른 경기 득점 기록(g)은 지운다(스코어는 남김). 한 번 줄인 시즌은 slim 표시
 */
export function trimArchive(archive: SeasonArchive[]): void {
  const A = W().archive;
  for (const s of archive.slice(0, Math.max(0, archive.length - A.fullSeasons))) {
    if (s.slim) continue;
    s.aw ??= awardsFromTotals(s.players);
    const ent = Object.entries(s.players);
    const keep = new Set<string>(s.aw.map((a) => a[1]));
    const take = (cmp: (a: [string, PlayerTotals], b: [string, PlayerTotals]) => number, ok: (t: PlayerTotals) => boolean) =>
      ent.filter(([, t]) => ok(t)).sort(cmp).slice(0, A.keepTop).forEach(([id]) => keep.add(id));
    take((a, b) => b[1][1] - a[1][1], (t) => t[1] > 0);
    take((a, b) => b[1][2] - a[1][2], (t) => t[2] > 0);
    take((a, b) => b[1][3] / b[1][0] - a[1][3] / a[1][0], (t) => t[0] >= W().bestMinApps);
    if (s.names) for (const [id, [, team]] of Object.entries(s.names)) if (team === s.teamId) keep.add(id);
    s.players = Object.fromEntries(ent.filter(([id]) => keep.has(id)));
    if (s.names) s.names = Object.fromEntries(Object.entries(s.names).filter(([id]) => keep.has(id)));
    s.results = s.results.map((r) => [r[0], r[1], r[2], r[3], r[4]]);
    s.slim = true;
  }
}
