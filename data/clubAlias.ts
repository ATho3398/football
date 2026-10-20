// 같은 클럽 두 id 정리 (C.76c, 45b): 리그 밖 표(x:)의 클럽이 리그 데이터(<리그>:<3글자>)에도 있으면 같은 클럽이다.
// 이름이 같으면 짝 (리그 밖 표 이름은 리그 데이터·실제 선수 club 과 같게 맞춘다 — 'Bayern Munich').
// 그 리그를 고른 게임에서는 리그 팀 id 로 일원화하고 (리그 밖 이적 목적지에서 뺀다), 안 고른 게임은 x: id 그대로 (PL 만 고른 게임 결과 불변)

import { allLeagueData } from './leagues';
import { CLUB_BY_ID } from './outsideClubs';

const LEAGUE_BY_NAME = new Map<string, { id: string; league: string }>();
for (const d of allLeagueData()) for (const t of d.teams) LEAGUE_BY_NAME.set(t.name, { id: t.id, league: d.id });

/** PL 팀 id 는 리그 접두사가 없다 (mci 등) */
const PL_IDS = new Set(allLeagueData().find((d) => d.id === 'pl')?.teams.map((t) => t.id) ?? []);

/**
 * 리그 데이터에 없는 리그 밖 클럽의 수동 짝 (미래 스타 데이터의 x: id 등). 이름이 다른 같은 클럽만 여기에
 */
const MANUAL: Readonly<Record<string, string>> = {
  'x:ren': 'ligue1:ren',
  'x:bir': 'championship:bir',
};

/** 리그 밖 x: id → 리그 팀 id */
export const OUTSIDE_TO_LEAGUE: Readonly<Record<string, string>> = Object.fromEntries([
  ...Object.values(CLUB_BY_ID).flatMap((c) => {
    const t = LEAGUE_BY_NAME.get(c.name);
    return t ? [[c.id, t.id] as const] : [];
  }),
  ...Object.entries(MANUAL),
]);

/** 리그 팀 id → 리그 밖 x: id */
export const LEAGUE_TO_OUTSIDE: Readonly<Record<string, string>> = Object.fromEntries(Object.entries(OUTSIDE_TO_LEAGUE).map(([x, l]) => [l, x]));

/** 같은 클럽의 다른 id (없으면 undefined) */
export function aliasOf(id: string): string | undefined {
  return OUTSIDE_TO_LEAGUE[id] ?? LEAGUE_TO_OUTSIDE[id];
}

/** 리그 팀 id 의 리그 (x: id 는 짝의 리그). 리그 데이터에 없으면 undefined */
export function leagueOfClub(id: string): string | undefined {
  const lid = OUTSIDE_TO_LEAGUE[id] ?? id;
  const i = lid.indexOf(':');
  if (i < 0) return PL_IDS.has(lid) ? 'pl' : undefined;
  const lg = lid.slice(0, i);
  return lg === 'x' ? undefined : lg;
}

/** 고른 리그 기준 id: 리그 밖 클럽이 고른 리그의 팀이면 리그 팀 id, 아니면 그대로 */
export function canonicalClub(id: string, leagueIds: readonly string[]): string {
  const l = OUTSIDE_TO_LEAGUE[id];
  return l && leagueIds.includes(leagueOfClub(l)!) ? l : id;
}
