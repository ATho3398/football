// 더비 판정 (C.44 pending 52 5번): 명시 표(data/derbies.ts) → 없으면 프리미어리그 밖·가상 구단끼리(또는 리그 구단과) 같은 지역이면 자동 지역 더비.
// 리그 구단끼리는 명시 표만 쓴다 (모든 런던 팀 맞대결이 더비가 되지 않게). 5-2 라이벌 이벤트·큰 경기 배율은 BALANCE.derby 훅

import { DERBIES, REGION, REGION_DERBY_KO, type DerbyDef } from '../data/derbies';
import { CLUB_TO_TEAM } from './league';

export interface DerbyInfo {
  name: string;
  big: boolean;
  /** 지역 기준 자동 지정 */
  auto: boolean;
}

const PL = new Set(Object.values(CLUB_TO_TEAM));
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const TABLE = new Map<string, DerbyDef>(DERBIES.map((d) => [key(d.teams[0], d.teams[1]), d]));

/** 구단 연고 지역 (없으면 null). 가상 구단이 생기면 여기서 그 구단의 지역을 돌려준다 (훅) */
export function regionOf(teamId: string): string | null {
  return REGION[teamId] ?? null;
}

/** 두 팀 경기가 더비면 이름·큰 더비 여부 */
export function derbyOf(a: string, b: string): DerbyInfo | null {
  if (a === b) return null;
  const d = TABLE.get(key(a, b));
  if (d) return { name: d.name, big: !!d.big, auto: false };
  if (PL.has(a) && PL.has(b)) return null;
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
