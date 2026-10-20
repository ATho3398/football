// C.75m 측정·테스트용 가짜 리그: 데이터 파일이 아직 없는 리그를 팀 수·달력만 맞춰 등록한다 (이미 등록된 리그는 그대로)
import { leagueData, registerLeague, type LeagueData } from '../../data/leagues';

const SPEC: [string, string, number, LeagueData['calendar'], 1 | 2][] = [
  ['laliga', 'Spain', 20, 'autumn-spring', 1], ['seriea', 'Italy', 20, 'autumn-spring', 1], ['bundesliga', 'Germany', 18, 'autumn-spring', 1],
  ['ligue1', 'France', 20, 'autumn-spring', 1], ['championship', 'England', 24, 'autumn-spring', 2],
  ['kleague1', 'Korea Republic', 12, 'spring-autumn', 1], ['jleague1', 'Japan', 18, 'spring-autumn', 1], ['mls', 'USA', 23, 'spring-autumn', 1],
];

export function registerFakeLeagues(ids?: readonly string[]): string[] {
  const out: string[] = [];
  for (const [id, country, n, calendar, tier] of SPEC) {
    if (ids && !ids.includes(id)) continue;
    out.push(id);
    if (leagueData(id)) continue;
    registerLeague({
      id, name: id, nameKo: id, country, tier, season: calendar === 'spring-autumn' ? '2018' : '2018-19', calendar,
      teams: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, name: `${id} ${i}`, nameKo: `${id} ${i}`, rating: 82 - i * (20 / n) })),
    });
  }
  return out;
}
