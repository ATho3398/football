// 새 게임 시작 팀 고르기 (45b b, 사용자 17:45): '내 리그' 단계 없이 리그 선택(탭) → 그 리그 팀 목록. 고른 팀의 리그가 내 리그.
// 선택 가능 규칙은 모드마다 기존 그대로 (유망주 = 리그 레이팅 순위 범위, 커스텀 소속팀 = 스탯에 맞는 팀, 유스·유스 출신 = 전부)

import { leagueCatalog, leagueData } from '../../data/leagues';
import { initialTeams, leagueOfTeam } from '../league';
import { BALANCE } from '../config/balance';

export interface TeamPickVM {
  /** 리그 탭 (카탈로그 순, 국기 + 이름) */
  leagues: { id: string; label: string }[];
  league: string;
  teams: { id: string; ko: string; rating: number; on: boolean; ok: boolean; why: string }[];
  /** 랜덤 칸 (있으면 고른 팀이 없을 때 켜짐) */
  random: { label: string; on: boolean } | null;
}

const FLAG: Readonly<Record<string, string>> = {
  England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Spain: '🇪🇸', Italy: '🇮🇹', Germany: '🇩🇪', France: '🇫🇷', Netherlands: '🇳🇱', Portugal: '🇵🇹',
  'Saudi Arabia': '🇸🇦', 'Korea Republic': '🇰🇷', Japan: '🇯🇵', Brazil: '🇧🇷', 'United States': '🇺🇸',
};

/** 리그 탭 */
export function pickLeagues(): TeamPickVM['leagues'] {
  return leagueCatalog().filter((e) => leagueData(e.id)).map((e) => ({ id: e.id, label: `${FLAG[e.country] ?? ''} ${e.nameKo}`.trim() }));
}

/** 지금 보는 리그: 고른 팀의 리그 > 화면에서 고른 탭 > 내 리그 */
export function pickLeagueOf(chosen: string | undefined, tab: string | undefined, mine: string): string {
  return (chosen && leagueOfTeam(chosen)) || (tab && leagueData(tab) ? tab : '') || mine;
}

/** 유망주 시작 팀 순위 범위 (game.ts 와 같은 규칙: 팀이 20개보다 적은 리그는 팀 수까지) */
export function prospectRank(teams: number): { min: number; max: number } {
  const R = BALANCE.newGame.teamRankRange;
  const max = Math.min(R.max, teams);
  return { min: Math.min(R.min, max), max };
}

/** 유망주 팀 목록: 레이팅 순위가 범위 안이면 고를 수 있다 */
export function prospectTeamPick(league: string, chosen: string): TeamPickVM {
  const teams = [...initialTeams(league)].sort((a, b) => b.rating - a.rating);
  const { min, max } = prospectRank(teams.length);
  return {
    leagues: pickLeagues(), league,
    teams: teams.map((t, i) => {
      const ok = i + 1 >= min && i + 1 <= max;
      return { id: t.id, ko: t.nameKo, rating: t.rating, on: t.id === chosen, ok, why: ok ? '' : `리그 ${min}~${max}위 팀만 (유망주)` };
    }),
    random: { label: `랜덤 · 리그 ${min}~${max}위`, on: !chosen },
  };
}

/** 유망주가 그 팀으로 시작할 수 있나 */
export function prospectTeamOk(teamId: string): boolean {
  const lg = leagueOfTeam(teamId);
  if (!lg) return false;
  return prospectTeamPick(lg, '').teams.some((t) => t.id === teamId && t.ok);
}

/** 리그 고르기 묶음 (디자인 239): 유럽 1부 · 유럽 2부 · 아시아 · 아메리카 */
export type LeagueGroup = 'eu1' | 'eu2' | 'asia' | 'americas';
export const LEAGUE_GROUPS: readonly { id: LeagueGroup; ko: string }[] = [
  { id: 'eu1', ko: '유럽 · 1부' }, { id: 'eu2', ko: '유럽 · 2부' }, { id: 'asia', ko: '아시아' }, { id: 'americas', ko: '아메리카' },
];
const ASIA = new Set(['Saudi Arabia', 'Korea Republic', 'Japan', 'China PR', 'Australia', 'Qatar', 'United Arab Emirates']);
const AMERICAS = new Set(['Brazil', 'United States', 'Argentina', 'Mexico', 'Canada']);
export function leagueGroupOf(country: string, tier: number): LeagueGroup {
  return ASIA.has(country) ? 'asia' : AMERICAS.has(country) ? 'americas' : tier >= 2 ? 'eu2' : 'eu1';
}
