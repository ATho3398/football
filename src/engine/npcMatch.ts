// 다른 팀 경기 (25.1~25.2 4번, 부록 C.38): 내 경기가 아닌 경기도 22명 엔진으로 계산한다.
// 위치 프레임을 기록하지 않고 결과와 선수 기록만 돌려준다. 입력은 직렬화할 수 있어 Web Worker 로 보낼 수 있다

import type { TeamRoster } from '../roster';
import type { MatchEnv } from './env';
import type { NpcCond } from '../npcFit';
import type { ManagerStyle } from '../../data/managers';
import { npcTeamSetup } from './setup';
import { createMatch } from './sim';

export interface NpcMatchInput {
  home: TeamRoster;
  away: TeamRoster;
  homeRating: number;
  awayRating: number;
  seed: number;
  worldSeed: string;
  leagueAvg?: number;
  /** 날씨·심판 실행 배율 (C.74a). 없으면 맑음·보통 심판 */
  env?: Partial<MatchEnv>;
  /** NPC 피로·부상 (C.77m): 두 팀 선수 그날 아침 컨디션. 없으면 모두 피로 0 */
  cond?: NpcCond;
  /** 두 팀 감독 기용 성향 [홈, 원정] (C.79i). 없으면 실용 */
  styles?: [ManagerStyle, ManagerStyle];
}

/** 골 기록: [분, 팀(0 홈·1 원정), 득점자 id, 도움 id(없으면 null)] */
export type GoalRec = [number, 0 | 1, string, string | null];

/** 선수 기록: [id, 출전 분, 골, 도움, 평점 ×10 (정수), 이동 거리 m (정수, C.77m NPC 피로)] */
export type PlayerLine = [string, number, number, number, number, number?];

export interface NpcMatchResult {
  hg: number;
  ag: number;
  goals: GoalRec[];
  players: PlayerLine[];
}

/** 경기 시계(초) → 분 (1~90, 추가시간은 45·90) */
export function goalMinute(t: number, halfSeconds = 2700): number {
  if (t < halfSeconds) return Math.min(45, Math.floor(t / 60) + 1);
  return Math.min(90, Math.floor(t / 60) + 1);
}

/** 엔진 결과의 골 이벤트와 선수 기록을 요약한다 (다른 경기와 내 경기 공통) */
export function summarize(r: {
  homeGoals: number; awayGoals: number;
  events: { t: number; type: string; team: 0 | 1; players: string[] }[];
  players: { id: string; minutes: number; goals: number; assists: number; rating: number; distance: number }[];
}): NpcMatchResult {
  return {
    hg: r.homeGoals,
    ag: r.awayGoals,
    goals: r.events.filter((e) => e.type === 'goal').map((e) => [goalMinute(e.t), e.team, e.players[0]!, e.players[1] ?? null]),
    players: r.players.filter((p) => p.minutes > 0).map((p) => [p.id, p.minutes, p.goals, p.assists, Math.round(p.rating * 10), Math.round(p.distance)]),
  };
}

export function playNpcMatch(m: NpcMatchInput): NpcMatchResult {
  // C.77c·C.77m: 결장 추첨·피로·부상을 거친 선발 — 측정 리그(job.ts runLeagueSeasonJob)와 같은 함수
  const home = npcTeamSetup(m.home, m.homeRating, m.awayRating, m.worldSeed, m.seed, m.leagueAvg, m.cond, m.styles?.[0] ?? 'neutral');
  const away = npcTeamSetup(m.away, m.awayRating, m.homeRating, m.worldSeed, m.seed, m.leagueAvg, m.cond, m.styles?.[1] ?? 'neutral');
  const sim = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: m.seed, bigMatch: false, ...(m.env ? { env: m.env } : {}) });
  return summarize(sim.runToEnd());
}
