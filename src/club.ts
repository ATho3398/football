// 구단 이벤트 (부록 C.63, C.62 남은 질문 ④): 감독 경질·새 감독(신뢰도 다시 시작)과 주장.
// - 경질: 내 팀이 10R 이후 강등권 근처(또는 전력보다 크게 아래)이고 최근 5경기 1승 이하면 경기 뒤 확률로. 시즌에 한 번. 새 감독은 풀에서 시드로
// - 주장: 이벤트(data/events.ts captainOffer)로 제안 → 수락하면 주장. 신뢰도 하락 ×downMul, 시즌 끝 위상 +, 이적하면 끝
// 수치는 BALANCE.events.coach / captain

import { BALANCE } from './config/balance';
import { MANAGER_STYLE_KO, managerOf, type ManagerData, type ManagerStyle } from '../data/managers';
import { sortedTable, teamById } from './league';
import { pushInbox } from './inbox';
import { startTrust } from './manager';
import { createRng, hashSeed } from './rng';
import { fill, pickText } from './text';
import type { GameState } from './game';

const C = () => BALANCE.events.coach;
const K = () => BALANCE.events.captain;

/** 새 감독 풀 (2018-19 전후 실제로 PL 지휘봉을 새로 잡은 감독들) */
export const COACH_POOL: readonly (Omit<ManagerData, 'stadiumKo'>)[] = [
  { name: 'Ole Gunnar Solskjær', nameKo: '올레 군나르 솔샤르', style: 'youth' },
  { name: 'Ralph Hasenhüttl', nameKo: '랄프 하센휘틀', style: 'strict' },
  { name: 'Claudio Ranieri', nameKo: '클라우디오 라니에리', style: 'steady' },
  { name: 'Brendan Rodgers', nameKo: '브렌던 로저스', style: 'youth' },
  { name: 'Scott Parker', nameKo: '스콧 파커', style: 'youth' },
  { name: 'David Moyes', nameKo: '데이비드 모이스', style: 'neutral' },
  { name: 'Sam Allardyce', nameKo: '샘 앨러다이스', style: 'strict' },
  { name: 'Chris Hughton', nameKo: '크리스 휴턴', style: 'steady' },
  { name: 'Frank Lampard', nameKo: '프랭크 램파드', style: 'youth' },
  { name: 'Carlo Ancelotti', nameKo: '카를로 안첼로티', style: 'rotation' },
  { name: 'Graham Potter', nameKo: '그레이엄 포터', style: 'neutral' },
  { name: 'Dean Smith', nameKo: '딘 스미스', style: 'neutral' },
];

export interface CoachRec { name: string; nameKo: string; style: ManagerStyle; since: number }

/** 그 팀 지금 감독 (경질로 바뀌었으면 새 감독, 홈구장은 원래 데이터) */
export function coachOf(state: Pick<GameState, 'coaches'>, teamId: string): ManagerData | null {
  const base = managerOf(teamId);
  const c = state.coaches?.[teamId];
  if (c) return { name: c.name, nameKo: c.nameKo, style: c.style, stadiumKo: base?.stadiumKo ?? '' };
  return base;
}

/** 두 팀 감독 기용 성향 (C.79i, 엔진 입력 styles). 둘 다 실용이면 붙이지 않는다 (입력·미리 계산 키 그대로) */
export function coachStylesField(state: Pick<GameState, 'coaches'>, a: string, b: string): { styles?: [ManagerStyle, ManagerStyle] } {
  const sa = coachOf(state, a)?.style ?? 'neutral';
  const sb = coachOf(state, b)?.style ?? 'neutral';
  return sa === 'neutral' && sb === 'neutral' ? {} : { styles: [sa, sb] };
}

export function coachName(state: Pick<GameState, 'coaches'>, teamId: string): string {
  return coachOf(state, teamId)?.nameKo ?? '감독';
}

export function coachLabel(state: Pick<GameState, 'coaches'>, teamId: string): string {
  const m = coachOf(state, teamId);
  return m ? `${m.nameKo} · ${MANAGER_STYLE_KO[m.style]}` : '감독 정보 없음';
}

/** 최근 n경기 승 수 (내 경기 기록) */
function recentWins(state: GameState, n: number): number {
  return state.matchLog.slice(-n).filter((m) => m.goalsFor > m.goalsAgainst).length;
}

/** 내 경기 뒤 (playMyRound): 경질 판정. 경질했으면 새 감독 이름 */
export function coachAfterMatch(state: GameState): string | null {
  const X = C();
  const p = state.player;
  if (state.trial || state.league.round < X.fromRound || state.matchLog.length < X.lastGames) return null;
  const key = `${p.teamId}:${state.league.season}`;
  if (state.sacked?.includes(key)) return null;
  const rank = sortedTable(state.league).findIndex((r) => r.teamId === p.teamId) + 1;
  const expected = [...state.league.teams].sort((a, b) => b.rating - a.rating).findIndex((t) => t.id === p.teamId) + 1;
  const bad = rank >= X.rankFrom || rank - expected >= X.expectedGap;
  if (!bad || recentWins(state, X.lastGames) > X.maxWins) return null;
  const old = coachOf(state, p.teamId);
  const rng = createRng(hashSeed(`${state.worldSeed}:sack:${p.teamId}:${state.league.season}:${state.league.round}`));
  if (rng() >= X.chance * (old?.style === 'steady' ? X.steadyMul : 1)) return null;
  // 새 감독: 지금 리그에서 지휘하지 않는 사람
  const busy = new Set(state.league.teams.map((t) => coachOf(state, t.id)?.nameKo));
  const pool = COACH_POOL.filter((c) => !busy.has(c.nameKo));
  const next = pool[Math.floor(rng() * pool.length)] ?? COACH_POOL[0]!;
  (state.coaches ??= {})[p.teamId] = { ...next, since: state.league.season };
  (state.sacked ??= []).push(key);
  // 신뢰도 다시 시작 (새 감독은 새 팀처럼 40~60), 면담·보상은 새로
  const m = state.manager;
  const start = startTrust(state, p.teamId);
  if (m && m.teamId === p.teamId) {
    Object.assign(m, { trust: start, lowSince: null, meeting: null, posStreak: 0, perks: {}, rewardKeys: [], upset: false });
    m.log.push({ season: state.league.season, date: state.calendar.date, delta: 0, why: `새 감독 ${next.nameKo} 부임 · ${start}부터` });
    if (m.log.length > BALANCE.manager.logMax) m.log.splice(0, m.log.length - BALANCE.manager.logMax);
  }
  // 주장은 새 감독이 다시 정한다
  if (state.captain?.teamId === p.teamId) state.captain = null;
  const team = teamById(state.league, p.teamId)?.nameKo ?? p.teamId;
  const vars = { team, old: old?.nameKo ?? '감독', next: next.nameKo, rank };
  const body = pickText([
    '{team}{이/가} {rank}위까지 떨어지자 {old} 감독을 경질했어요. 후임은 {next}. 감독 신뢰도는 새로 시작해요.',
    '성적 부진 끝에 {old} 감독이 물러났어요. {next} 감독이 지휘봉을 잡았고, 모두가 다시 경쟁해야 해요.',
    '{team} 구단이 {old} 감독과 결별했어요. 새 감독 {next}{은/는} 첫 훈련에서 "모두에게 기회가 있다"고 말했어요.',
  ], rng());
  pushInbox(state, { cat: 'club', title: fill('감독 경질 · {next} 부임', vars), body: fill(body, vars) });
  return next.nameKo;
}

// ── 주장 ──

export function isCaptain(state: GameState): boolean {
  return state.captain?.teamId === state.player.teamId;
}

/** 지금 구단에서 보낸 시즌 수 (이번 시즌 포함) */
export function clubSeasons(state: GameState): number {
  const p = state.player;
  let n = 1;
  for (let i = p.history.length - 1; i >= 0 && p.history[i]!.teamId === p.teamId; i--) n++;
  return n;
}

export function setCaptain(state: GameState, on: boolean): void {
  state.captain = on ? { teamId: state.player.teamId, since: state.league.season } : null;
}

/** 주장 신뢰도 하락 배율 */
export function captainDownMul(state: GameState): number {
  return isCaptain(state) ? K().downMul : 1;
}

/** 시즌 끝: 주장 시즌 위상 + (끝까지 주장이었으면). 받은 위상 */
export function captainSeasonEnd(state: GameState): number {
  if (!isCaptain(state)) return 0;
  state.player.reputation += K().seasonRep;
  return K().seasonRep;
}

/** 새 시즌 시작: 이적했으면 끝, 신뢰도가 stripBelow 미만이면 완장을 뺏긴다 (인박스) */
export function captainSeasonStart(state: GameState): void {
  const c = state.captain;
  if (!c) return;
  if (c.teamId !== state.player.teamId) {
    state.captain = null;
    return;
  }
  const trust = state.manager?.teamId === c.teamId ? state.manager.trust : 50;
  if (trust < K().stripBelow) {
    state.captain = null;
    pushInbox(state, { cat: 'club', title: '주장 완장을 내려놓았어요', body: `감독 신뢰도 ${Math.round(trust)} · 감독이 새 주장을 정했어요. 신뢰를 되찾으면 다시 기회가 와요.` });
  }
}

/** 주장 시즌 수 (since 부터) */
export function captainSeasons(state: GameState): number {
  return isCaptain(state) ? state.league.season - state.captain!.since + 1 : 0;
}
