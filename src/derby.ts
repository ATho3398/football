// 더비 판정 (C.44 pending 52 5번): 명시 표(data/derbies.ts) + 리그 데이터 더비(C.75y) → 없으면 다른 리그·가상 구단끼리 같은 지역이면 자동 지역 더비.
// 같은 리그 구단끼리는 명시 표만 쓴다 (모든 런던 팀 맞대결이 더비가 되지 않게). 5-2 라이벌 이벤트·큰 경기 배율은 BALANCE.derby 훅

import { DERBIES, REGION, REGION_DERBY_KO, type DerbyDef } from '../data/derbies';
import { allLeagueData } from '../data/leagues';
import { LEAGUE_TO_OUTSIDE, OUTSIDE_TO_LEAGUE, leagueOfClub } from '../data/clubAlias';

export interface DerbyInfo {
  name: string;
  big: boolean;
  /** 지역 기준 자동 지정 */
  auto: boolean;
}

/** 같은 클럽 두 id(x: ↔ 리그 데이터, C.75y)는 리그 데이터 id 로 본다 */
const canon = (id: string) => OUTSIDE_TO_LEAGUE[id] ?? id;
const key = (a: string, b: string) => {
  const [x, y] = [canon(a), canon(b)];
  return x < y ? `${x}|${y}` : `${y}|${x}`;
};
/** 명시 표 먼저, 그다음 리그 데이터 더비 (C.75y, 45b — 같은 짝이면 앞의 것) */
const TABLE = new Map<string, DerbyDef>();
for (const d of [
  ...DERBIES,
  ...allLeagueData().flatMap((l) => (l.derbies ?? []).map(([a, b, name]): DerbyDef => ({ teams: [a, b], name: name ?? '더비' }))),
]) {
  const k = key(d.teams[0], d.teams[1]);
  if (!TABLE.has(k)) TABLE.set(k, d);
}

/** 구단 연고 지역 (없으면 null). 같은 클럽의 x: id 지역을 같이 쓴다. 가상 구단이 생기면 여기서 그 구단의 지역을 돌려준다 (훅) */
export function regionOf(teamId: string): string | null {
  const x = LEAGUE_TO_OUTSIDE[teamId];
  return REGION[teamId] ?? (x ? REGION[x] : undefined) ?? null;
}

/** 두 팀 경기가 더비면 이름·큰 더비 여부 */
export function derbyOf(a: string, b: string): DerbyInfo | null {
  if (a === b) return null;
  const d = TABLE.get(key(a, b));
  if (d) return { name: d.name, big: !!d.big, auto: false };
  // 같은 리그 구단끼리는 명시 표만 (C.75y: PL 밖 리그도 같은 규칙)
  const la = leagueOfClub(a);
  if (la && la === leagueOfClub(b)) return null;
  const ra = regionOf(a);
  if (!ra || ra !== regionOf(b)) return null;
  return { name: REGION_DERBY_KO[ra] ?? '지역 더비', big: false, auto: true };
}

/** 그 팀의 라이벌 (후보 팀 중) */
export function rivalsOf(teamId: string, candidates: readonly string[]): { id: string; derby: DerbyInfo }[] {
  return candidates.flatMap((id) => {
    const derby = derbyOf(teamId, id);
    return derby ? [{ id, derby }] : [];
  });
}
