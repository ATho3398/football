// 대표팀 · 국제 대회 (10번·18.12, 45c단계, 부록 C.76d).
// ① 소집: 리그 A매치 휴식기마다 위상 티어 확률(+ 대표팀보다 잘하면 가산)로 소집 → 인박스 알림, 평가전 2경기(금·화)를 내 경기 일정에 넣는다.
//    소집 기간에는 휴가가 없고(대표팀 훈련 = 평소 훈련 계획), 휴식기 주말이라 클럽 경기와 겹치지 않는다.
// ② 경기: 내 경기는 클럽 경기처럼 엔진(game.ts playMyNational), 나머지는 빠른 판정. 대표팀 전력 = 국가 레이팅 표(data/nations.ts) + 내 선수.
// ③ 대회: 월드컵(4년, 2018 끝난 상태 → 2022)·대륙컵(실제 주기 근사)은 시즌이 끝난 여름(6~7월)에 조별 + 녹아웃.
//    C.81l: 클럽 시즌이 끝나는 날(리그 최종 + 내 컵 끝) 소집을 판정해 **소집되면 달력 위에서**(휴가 → 소집일 → 조별 3경기 → 녹아웃) 내 경기는
//    클럽 경기처럼(준비·결정 순간·엔진·결과), 다른 경기는 그 날짜에 빠른 계산(nat.live 에 결과를 쌓아 세이브). 내 나라가 떨어지거나 우승하면
//    남은 경기는 시즌 끝에 한꺼번에. 소집 안 되면(또는 본선 탈락) 지금처럼 시즌 끝에 결과만 뉴스로.
//    대회가 없는 해 6월에는 평가전 2경기. 업적 XP(18.12)·월드컵 우승 기록(honors.worldCups → 8.2 배지)은 시즌 끝 업적에 같이 들어간다.

import { BALANCE } from './config/balance';
import { nationOf, NATIONS, nationsIn, type Confed, type NationData } from '../data/nations';
import { A_GRADE_PLAYERS } from '../data/players';
import { addDays, daysBetween, type IsoDate } from './calendar';
import { expectedGoals, scorePair } from './league';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import { createTeamRoster, type TeamRoster } from './roster';
import { reputationTier, playerOvr } from './growth';
import { myNationality } from './life';
import { pushInbox } from './inbox';
import { NAME_POOLS, PLAYER_EXTRA_POOLS } from '../data/names';
import { randomNameFor } from './identity';
import type { GameState } from './game';
import type { Tier } from './types';

export type NatComp = 'friendly' | 'wc' | 'euro' | 'copa' | 'asian' | 'afcon' | 'gold' | 'ofc';
export type TournamentComp = Exclude<NatComp, 'friendly'>;

export const NAT_COMP_KO: Record<NatComp, string> = {
  friendly: 'A매치 평가전', wc: '월드컵', euro: '유로', copa: '코파 아메리카', asian: '아시안컵', afcon: '아프리카 네이션스컵', gold: '골드컵', ofc: 'OFC 네이션스컵',
};

/** 대표팀 팀 id (경기 엔진·유니폼 `n:<국가>`) */
export const natId = (nation: string): string => `n:${nation}`;
export const nationFromId = (id: string): string => id.slice(2);

/** 내 대표팀 경기 하나 (치른 것은 결과 포함, 내 쪽 기준) */
export interface NatMatch {
  /** 시드 키 ("w:2018:0:1" A매치 주간 · "j:2019:0" 6월 평가전 · "t:wc2022:g1" 대회) */
  key: string;
  date: IsoDate;
  comp: NatComp;
  /** "평가전" · "조별 1차전" · "16강" · "결승" */
  stage: string;
  /** 상대 국가 (영문) */
  opp: string;
  /** 평가전 홈/원정. 대회는 중립 (true = 앞 팀) */
  home: boolean;
  /** 리플레이 보관 번호 (200+) */
  seq: number;
  /** 시즌 (그 경기가 속한 클럽 시즌) */
  season: number;
  gf?: number;
  ga?: number;
  /** 승부차기 [내 팀, 상대] */
  pens?: [number, number];
  min?: number;
  started?: boolean;
  g?: number;
  a?: number;
  r?: number | null;
  mom?: boolean;
  absent?: 'injured' | 'bench';
}

export interface NatCareer { apps: number; starts: number; minutes: number; goals: number; assists: number; ratingSum: number; moms: number }

export interface GroupRow { team: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }
export interface KoTie { a: string; b: string; ga: number; gb: number; pens?: [number, number]; winner: string }

/** 끝난 대회 (조 순위·대진 표) */
export interface TournamentRec {
  id: string;
  comp: TournamentComp;
  year: number;
  /** 내 나라가 나갔는지 · 내가 소집됐는지 · 내 나라 성적 */
  qualified: boolean;
  called: boolean;
  reach: string;
  champion: string;
  groups: { name: string; table: GroupRow[] }[];
  ko: { name: string; ties: KoTie[] }[];
}

export interface NationalState {
  /** 대표팀 국가 (국적) */
  nation: string;
  /** A매치 주간 소집 결과 "시즌:번호" → 소집 여부 */
  calls: Record<string, boolean>;
  /** 내 대표팀 경기 (치른 것 + 잡힌 것, 날짜 순) */
  fixtures: NatMatch[];
  /** 통산 대표팀 기록 */
  career: NatCareer;
  /** 지난 대회 (최근 keepTournaments 개, 내 나라 대륙 대회·월드컵) */
  tournaments: TournamentRec[];
  /** 대회 성적 한 줄 기록 (통산, 표 없이) */
  honors: { comp: TournamentComp; year: number; reach: string; xp: number }[];
  seq: number;
  /** 진행 중인 여름 대회 (C.81l, SAVE_FORMAT_VERSION 62): 소집돼 달력 위에서 치르는 동안만. 시즌 끝에 기록(tournaments)으로 옮기고 지운다 */
  live?: TournamentLive;
  /** 이번 여름 대회 소집 판정 (C.81l): 클럽 시즌이 끝나는 날 한 번 (대회가 있는 해만). 시즌 끝 처리가 같은 판정을 쓴다 */
  summer?: { year: number; called: boolean };
}

/** 치른 대회 경기 결과: [앞 팀 골, 뒤 팀 골] 또는 승부차기까지 [골, 골, [앞 팀, 뒤 팀]] */
export type TResult = [number, number] | [number, number, [number, number]];

/** 진행 중인 여름 대회 (C.81l): 조 편성·날짜는 추첨 때 정하고, 결과는 경기 열쇠별로 쌓는다. 녹아웃 대진은 결과에서 다시 만든다 (tournamentState) */
export interface TournamentLive {
  id: string;
  comp: TournamentComp;
  year: number;
  qualified: boolean;
  /** 내가 소집돼 내 나라 경기를 직접 치르는지 */
  called: boolean;
  /** 조 편성 (A조부터) */
  groups: string[][];
  /** 첫 조별 경기 날 · 대표팀 소집일 (휴가 끝) */
  start: IsoDate;
  camp: IsoDate;
  /** 경기 열쇠 ("g0:1:0:2" 조별 · "k1:3" 녹아웃) → 결과 */
  played: Record<string, TResult>;
}

/** 대회 경기 하나 (조별·녹아웃, 결과에서 만든 목록) */
export interface TMatch {
  key: string;
  a: string;
  b: string;
  stage: string;
  date: IsoDate;
  ko: boolean;
  res?: TResult;
}

/** 지금까지 결과로 만든 대회 상태 */
export interface TournamentView {
  matches: TMatch[];
  /** 조별 순위표 (조 순서) */
  tables: GroupRow[][];
  /** 녹아웃 단계 (아직 안 치른 경기는 ga·gb −1, winner '') */
  ko: { name: string; ties: KoTie[] }[];
  /** 아직 떨어지지 않은 팀 (조별이면 전부, 녹아웃이면 지금 단계에 남은 팀) */
  alive: string[];
  champion: string | null;
  done: boolean;
}

export const emptyNatCareer = (): NatCareer => ({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, ratingSum: 0, moms: 0 });

export function initNational(nation: string): NationalState {
  return { nation, calls: {}, fixtures: [], career: emptyNatCareer(), tournaments: [], honors: [], seq: 0 };
}

/** 대표팀 상태 (옛 세이브·새 게임은 처음 쓸 때 만든다) */
export function ensureNational(state: GameState): NationalState {
  return (state.national ??= initNational(myNationality(state.player)));
}

const N = () => BALANCE.national;

export function myNation(state: GameState): NationData {
  return nationOf(state.national?.nation ?? myNationality(state.player));
}

/** 국가 표 레이팅 (+ 대회 해 흔들림) */
export function nationRating(name: string, worldSeed?: string, year?: number): number {
  const base = nationOf(name).rating;
  if (worldSeed === undefined || year === undefined) return base;
  return base + gaussian(createRng(hashSeed(`${worldSeed}:natform:${name}:${year}`))) * N().formSd;
}

/** 내가 뛸 때 대표팀 전력 가산 (빠른 판정): 내 OVR 이 대표팀 레이팅보다 높으면 그 차 / myShare */
export function myBoost(state: GameState, rating: number): number {
  return Math.max(0, playerOvr(state.player) - rating) / N().myShare;
}

// ── 소집 ──

/** 이번 소집 확률 (18.12): 위상 티어 + 내 OVR 가산. 나이 미달 0 */
export function callChance(state: GameState, extra = 0): number {
  const C = N().callup;
  const p = state.player;
  if (p.age < C.minAge) return 0;
  const tier: Tier = reputationTier(p.reputation, p.honors);
  const base = C[tier];
  const gap = Math.max(0, playerOvr(p) - myNation(state).rating);
  return Math.min(C.max, base + gap * C.ovrBonus + extra);
}

export interface NatWindow { idx: number; key: string; sat: IsoDate; dates: IsoDate[] }

/** 이번 시즌 A매치 주간 (리그 달력의 A매치 휴식기 주말) */
export function natWindows(state: GameState, breaks: readonly { date: IsoDate; kind: string }[]): NatWindow[] {
  const W = N().window;
  return breaks.filter((b) => b.kind === 'international').map((b, idx) => ({
    idx, key: `${state.league.season}:${idx}`, sat: b.date, dates: W.matchDays.map((d) => addDays(b.date, d)),
  }));
}

/** 평가전 상대: 레이팅 ± friendlyGap 안에서 (같은 대륙 반, 다른 대륙 반) */
function friendlyOpponent(state: GameState, rng: Rng, avoid: readonly string[]): string {
  const me = myNation(state);
  const gap = N().friendlyGap;
  const pool = NATIONS.filter((n) => n.name !== me.name && !avoid.includes(n.name) && Math.abs(n.rating - me.rating) <= gap);
  const list = pool.length ? pool : NATIONS.filter((n) => n.name !== me.name);
  return list[Math.floor(rng() * list.length)]!.name;
}

/**
 * 하루 끝 (endDay 뒤, 오늘 = state.calendar.date): 발표일이 된 A매치 주간 소집 판정 → 소집이면 평가전 2경기를 잡고 인박스.
 * clubDates = 내 클럽 경기 날짜 (겹치거나 하루 붙은 날은 대표팀 경기를 뺀다)
 */
export function nationalDayEnd(state: GameState, breaks: readonly { date: IsoDate; kind: string }[], clubDates: readonly IsoDate[]): void {
  if (state.phase !== 'season') return;
  const nat = ensureNational(state);
  const today = state.calendar.date;
  for (const w of natWindows(state, breaks)) {
    if (nat.calls[w.key] !== undefined) continue;
    const first = w.dates[0]!;
    if (daysBetween(today, first) <= 0) { nat.calls[w.key] = false; continue; }
    if (daysBetween(today, w.sat) > N().window.announce) continue;
    const rng = createRng(hashSeed(`${state.worldSeed}:callup:${w.key}`));
    const roll = rng();
    const injured = !!state.player.injury && state.player.injury.daysLeft > daysBetween(today, first);
    const called = !injured && roll < callChance(state);
    nat.calls[w.key] = called;
    if (!called) continue;
    const opps: string[] = [];
    const added: NatMatch[] = [];
    w.dates.forEach((date, k) => {
      if (clubDates.some((d) => Math.abs(daysBetween(d, date)) <= 1)) return;
      const opp = friendlyOpponent(state, rng, opps);
      opps.push(opp);
      added.push({ key: `w:${w.key}:${k}`, date, comp: 'friendly', stage: '평가전', opp, home: rng() < 0.5, seq: 200 + (++nat.seq % 800), season: state.league.season });
    });
    nat.fixtures.push(...added);
    const me = myNation(state);
    pushInbox(state, {
      key: `natcall:${w.key}`, cat: 'national', title: `${me.nameKo} 대표팀 소집`,
      body: added.length
        ? `A매치 주간 대표팀에 뽑혔어요. ${added.map((m) => `${m.date.slice(5).replace('-', '/')} ${nationOf(m.opp).nameKo}전(${m.comp !== 'friendly' ? '중립' : m.home ? '홈' : '원정'})`).join(' · ')}. 소집 기간에는 휴가 대신 대표팀 훈련을 해요.`
        : 'A매치 주간 대표팀에 뽑혔지만 클럽 일정과 겹쳐 경기는 뛰지 않아요.',
      link: { to: 'national', label: '대표팀' },
    });
  }
}

/** 이번 시즌 아직 안 치른 내 대표팀 경기 중 가장 이른 것 (시즌 중만) */
export function nextNatMatch(state: GameState): NatMatch | null {
  if (state.phase !== 'season' || !state.national) return null;
  let best: NatMatch | null = null;
  for (const m of state.national.fixtures) {
    if (m.gf !== undefined || m.season !== state.league.season) continue;
    if (!best || daysBetween(m.date, best.date) > 0) best = m;
  }
  return best;
}

/** 이번 시즌 내 대표팀 경기 날짜 (치른 것 + 잡힌 것): A매치 주간 평가전 + 달력 위 여름 대회 경기 (C.81l). 시즌 끝 한꺼번에 치른 경기는 빼고 */
export function natMatchDates(state: GameState): IsoDate[] {
  if (!state.national) return [];
  return state.national.fixtures.filter((m) => m.season === state.league.season && (m.key.startsWith('w:') || m.key.startsWith('t:'))).map((m) => m.date);
}

/** 대회·평가전 이름 한 줄: "A매치 평가전" · "월드컵 16강" */
export const natLabel = (m: Pick<NatMatch, 'comp' | 'stage'>): string => (m.comp === 'friendly' ? NAT_COMP_KO.friendly : `${NAT_COMP_KO[m.comp]} ${m.stage}`);

/** 내 경기 결과를 기록한다 (경기 결과는 내 쪽 기준) */
export function recordNatMatch(state: GameState, m: NatMatch, r: { gf: number; ga: number; minutes: number; started: boolean; goals: number; assists: number; rating: number | null; mom: boolean; injured?: boolean }): void {
  const nat = ensureNational(state);
  Object.assign(m, { gf: r.gf, ga: r.ga, min: r.minutes, started: r.started, g: r.goals, a: r.assists, r: r.rating, mom: r.mom });
  if (r.minutes <= 0) m.absent = r.injured ? 'injured' : 'bench';
  if (r.minutes > 0) {
    const c = nat.career;
    c.apps++;
    if (r.started) c.starts++;
    c.minutes += r.minutes;
    c.goals += r.goals;
    c.assists += r.assists;
    c.ratingSum += r.rating ?? 0;
    if (r.mom) c.moms++;
  }
}

// ── 대표팀 로스터 (엔진 경기) ──

const rosterCache = new Map<string, TeamRoster>();
const NAT_POOL = new Set([...NAME_POOLS, ...PLAYER_EXTRA_POOLS].map((p) => p.nationality));

/**
 * 대표팀 로스터: 그 국적 실제 선수(은퇴 안 한 NPC, OVR 높은 순 최대 14명) + 국가 레이팅의 가상 선수.
 * 가상 선수 한글 이름은 그 나라 이름 풀이 있으면 그 풀로 (없으면 생성 이름 그대로). 시즌마다 다시 만든다
 */
export function natRoster(state: GameState, nation: string): TeamRoster {
  const season = state.league.season;
  const key = `${state.worldSeed}:${nation}:${season}:${state.roster.updates}`;
  const hit = rosterCache.get(key);
  if (hit) return hit;
  const natOf = new Map(A_GRADE_PLAYERS.map((p) => [p.id, p.nationality]));
  const reals = state.npcs
    .filter((n) => !n.retired && natOf.get(n.id) === nation && n.id !== state.player.realPlayerId)
    .sort((a, b) => playerOvr(b) - playerOvr(a))
    .slice(0, 14);
  const roster = createTeamRoster({ id: natId(nation), rating: nationRating(nation) }, state.worldSeed, 2018, reals);
  if (NAT_POOL.has(nation) || nation === 'Korea Republic') {
    for (const p of roster.players) {
      if (p.real) continue;
      p.nameKo = randomNameFor(`nat:${state.worldSeed}:${p.id}`, nation, 'white');
      p.nationality = nation;
    }
  }
  if (rosterCache.size > 32) rosterCache.clear();
  rosterCache.set(key, roster);
  return roster;
}

// ── 대회 ──

/** 그해 여름 대회 (내 나라와 무관하게 열리는 것 전부) */
export function tournamentsIn(year: number): TournamentComp[] {
  const T = N().tournaments;
  return (Object.keys(T) as TournamentComp[]).filter((c) => {
    const t = T[c];
    return t.extra.includes(year) || (year >= t.from && (year - t.from) % t.every === 0);
  });
}

/** 내 나라가 나갈 수 있는 그해 대회 (월드컵 또는 내 대륙 대회) */
export function myTournament(nation: NationData, year: number): TournamentComp | null {
  const T = N().tournaments;
  return tournamentsIn(year).find((c) => T[c].confed === null || T[c].confed === nation.confed) ?? null;
}

/** 다음 월드컵 해 (지금 시즌 이후) */
export function nextWorldCupYear(fromYear: number): number {
  const t = N().tournaments.wc;
  let y = Math.max(t.from, fromYear);
  while ((y - t.from) % t.every !== 0) y++;
  return y;
}

const neutralScore = (rng: Rng, a: number, b: number): [number, number] => scorePair(rng, expectedGoals(a, b, false), expectedGoals(b, a, false));

function pensWinner(rng: Rng, a: number, b: number): boolean {
  const P = N().pens;
  return rng() < Math.min(P.max, Math.max(P.min, 0.5 + (a - b) * P.ratingK));
}

/** 승부차기 점수 (간이): 이긴 쪽 4~5, 진 쪽 2~4 */
function pensScore(rng: Rng, aWins: boolean): [number, number] {
  const w = 4 + Math.floor(rng() * 2);
  const l = Math.min(w - 1, 2 + Math.floor(rng() * 3));
  return aWins ? [w, l] : [l, w];
}

/** 참가국: 월드컵 = 대륙별 quota, 대륙컵 = 그 대륙 상위 (모자라면 다른 대륙 상위 초청) */
export function participants(worldSeed: string, comp: TournamentComp, year: number): string[] {
  const T = N().tournaments[comp];
  const rng = createRng(hashSeed(`${worldSeed}:qual:${comp}:${year}`));
  const noisy = (list: NationData[]) => list.map((n) => ({ n, s: n.rating + gaussian(rng) * N().qualSd })).sort((a, b) => b.s - a.s).map((x) => x.n.name);
  if (T.confed === null) {
    const Q = N().wcQuota;
    return (Object.keys(Q) as Confed[]).flatMap((c) => noisy(nationsIn(c)).slice(0, Q[c]));
  }
  const own = noisy(nationsIn(T.confed as Confed)).slice(0, T.teams);
  if (own.length >= T.teams) return own;
  const guests = noisy(NATIONS.filter((n) => n.confed !== T.confed && (n.confed === 'CONCACAF' || n.confed === 'AFC'))).slice(0, T.teams - own.length);
  return [...own, ...guests];
}

/** 표준 대진 순서 (1번 시드와 2번 시드가 결승에서 만난다): n = 2^k */
function bracketOrder(n: number): number[] {
  let order = [0];
  while (order.length < n) {
    const m = order.length * 2;
    order = order.flatMap((s) => [s, m - 1 - s]);
  }
  return order;
}

const rankRows = (rows: GroupRow[], str: Map<string, number>): GroupRow[] =>
  [...rows].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || (str.get(y.team) ?? 0) - (str.get(x.team) ?? 0));

const KO_NAME: Record<number, string> = { 2: '결승', 4: '4강', 8: '8강', 16: '16강', 32: '32강' };

/** 내 경기 판정 콜백 (game.ts 가 엔진·빠른 경기로 치르고 결과를 돌려준다). 결과는 내 쪽 기준 */
export type PlayMine = (m: NatMatch, my: number, opp: number) => { gf: number; ga: number };

export interface TournamentRun { rec: TournamentRec; mine: NatMatch[] }

/** 대회 해 전력 표 (참가국 → 레이팅 + 대회 해 흔들림). 조 편성·순위 동률·빠른 계산이 같이 쓴다 */
function liveStrengths(state: GameState, live: Pick<TournamentLive, 'groups' | 'year'>): Map<string, number> {
  return new Map(live.groups.flat().map((t) => [t, nationRating(t, state.worldSeed, live.year)]));
}

/** 경기 전력: 내 나라는 내가 뛰면 myBoost 가산 (빠른 판정, 지금과 같은 식) */
function liveStrength(state: GameState, live: TournamentLive, str: Map<string, number>, t: string): number {
  const base = str.get(t) ?? nationRating(t, state.worldSeed, live.year);
  return base + (live.called && t === myNation(state).name ? myBoost(state, base) : 0);
}

/**
 * 대회 추첨 (C.81l): 참가국 → 전력 순 포트(조 수만큼씩)에서 한 팀씩 조에 (시드는 지금과 같다). 날짜 = 리그 최종 라운드 + startAfter 일부터
 * 조별 gap 일 간격, 소집일 = 첫 경기 campDays 일 전. 경기 결과는 비어 있다
 */
export function drawTournament(state: GameState, comp: TournamentComp, year: number, finalDate: IsoDate, called: boolean): TournamentLive {
  const T = N().tournaments[comp];
  const seed = state.worldSeed;
  const me = myNation(state).name;
  const teams = participants(seed, comp, year);
  const rng = createRng(hashSeed(`${seed}:tourney:${comp}:${year}`));
  const str = new Map(teams.map((t) => [t, nationRating(t, seed, year)]));
  const G = T.groups;
  const sorted = [...teams].sort((a, b) => str.get(b)! - str.get(a)!);
  const groups: string[][] = Array.from({ length: G }, () => []);
  for (let pot = 0; pot * G < sorted.length; pot++) {
    const potTeams = sorted.slice(pot * G, pot * G + G);
    for (let i = potTeams.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [potTeams[i], potTeams[j]] = [potTeams[j]!, potTeams[i]!];
    }
    potTeams.forEach((t, g) => groups[g]!.push(t));
  }
  const start = addDays(finalDate, N().startAfter);
  return { id: `${comp}${year}`, comp, year, qualified: teams.includes(me), called: called && teams.includes(me), groups, start, camp: addDays(start, -N().campDays), played: {} };
}

/** 경기 결과의 승자 (녹아웃: 무승부면 승부차기) */
const winnerOf = (a: string, b: string, r: TResult): string => (r[0] !== r[1] ? (r[0] > r[1] ? a : b) : r[2] && r[2][0] > r[2][1] ? a : b);

/** 조별 1회전 짝: (0-1, 2-3), (0-2, 1-3), (0-3, 1-2) */
const ROUNDS = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]] as const;

/**
 * 지금까지 결과로 대회 상태를 만든다: 조별 경기 목록·순위표 → (조별이 다 끝나면) 녹아웃 진출 시드 → 앞 단계가 다 끝날 때마다 다음 단계 대진.
 * 순수 함수(세이브에는 결과만 있고 대진은 여기서 다시 만든다) — 날짜 순 목록이라 하루 끝 진행·한꺼번에 진행이 같은 순서로 치른다
 */
export function tournamentState(state: GameState, live: TournamentLive): TournamentView {
  const T = N().tournaments[live.comp];
  const str = liveStrengths(state, live);
  const G = live.groups.length;
  const matches: TMatch[] = [];
  const tables = live.groups.map((g) => g.map((team) => ({ team, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 })));
  const add = (row: GroupRow, f: number, a: number) => {
    row.p++; row.gf += f; row.ga += a;
    if (f > a) { row.w++; row.pts += 3; } else if (f === a) { row.d++; row.pts++; } else row.l++;
  };
  let groupDone = true;
  ROUNDS.forEach((pairs, md) => {
    const date = addDays(live.start, md * N().gap);
    live.groups.forEach((g, gi) => pairs.forEach(([i, j]) => {
      const a = g[i];
      const b = g[j];
      if (a === undefined || b === undefined) return;
      const key = `g${gi}:${md}:${i}:${j}`;
      const res = live.played[key];
      matches.push({ key, a, b, stage: `조별 ${md + 1}차전`, date, ko: false, ...(res ? { res } : {}) });
      if (!res) { groupDone = false; return; }
      add(tables[gi]![i]!, res[0], res[1]);
      add(tables[gi]![j]!, res[1], res[0]);
    }));
  });
  const ranked = tables.map((t) => rankRows(t, str));
  const ko: TournamentView['ko'] = [];
  if (!groupDone) return { matches, tables: ranked, ko, alive: live.groups.flat(), champion: null, done: false };
  // 녹아웃 진출: 조 1·2위 + (자리가 남으면) 성적 좋은 3위
  const K = T.ko;
  let seeds: string[];
  if (K === 2 * G && G >= 2) {
    // 1A-2B, 1C-2D … / 1B-2A, 1D-2C … (같은 조는 결승 전에 안 만난다)
    const half = (off: number) => Array.from({ length: G / 2 }, (_, k) => 2 * k + off).flatMap((g) => [ranked[g]![0]!.team, ranked[g ^ 1]![1]!.team]);
    seeds = [...half(0), ...half(1)];
  } else {
    const byRank = (k: number) => rankRows(ranked.map((t) => t[k]).filter((x): x is GroupRow => !!x), str).map((r) => r.team);
    const order = [...byRank(0), ...byRank(1), ...byRank(2)].slice(0, K);
    const pos = bracketOrder(K);
    seeds = pos.map((p) => order[p]!);
  }
  let alive = seeds;
  let date = addDays(live.start, 3 * N().gap);
  for (let r = 0; alive.length >= 2; r++) {
    const name = KO_NAME[alive.length] ?? `${alive.length}강`;
    const ties: KoTie[] = [];
    const next: string[] = [];
    const left: string[] = [];
    let complete = true;
    for (let i = 0; i + 1 < alive.length; i += 2) {
      const a = alive[i]!;
      const b = alive[i + 1]!;
      const key = `k${r}:${i / 2}`;
      const res = live.played[key];
      matches.push({ key, a, b, stage: name, date, ko: true, ...(res ? { res } : {}) });
      if (res) {
        const w = winnerOf(a, b, res);
        ties.push({ a, b, ga: res[0], gb: res[1], ...(res[2] ? { pens: res[2] } : {}), winner: w });
        next.push(w);
        left.push(w);
      } else {
        complete = false;
        ties.push({ a, b, ga: -1, gb: -1, winner: '' });
        left.push(a, b);
      }
    }
    ko.push({ name, ties });
    if (!complete) return { matches, tables: ranked, ko, alive: left, champion: null, done: false };
    alive = next;
    date = addDays(date, N().koGap);
  }
  return { matches, tables: ranked, ko, alive, champion: alive[0]!, done: true };
}

/** 내 대표팀 경기 열쇠 ("t:wc2022:k0:3") */
const myKey = (live: TournamentLive, m: TMatch): string => `t:${live.id}:${m.key}`;

/** 내 나라 경기의 NatMatch (없으면 만들어 일정에 넣는다). 날짜 순을 지킨다 */
function ensureMyFixture(state: GameState, live: TournamentLive, m: TMatch): NatMatch {
  const nat = ensureNational(state);
  const key = myKey(live, m);
  const hit = nat.fixtures.find((x) => x.key === key);
  if (hit) return hit;
  const me = myNation(state).name;
  const fx: NatMatch = { key, date: m.date, comp: live.comp, stage: m.stage, opp: m.a === me ? m.b : m.a, home: m.a === me, seq: 200 + (++nat.seq % 800), season: state.league.season };
  let at = nat.fixtures.length;
  while (at > 0 && nat.fixtures[at - 1]!.gf === undefined && daysBetween(fx.date, nat.fixtures[at - 1]!.date) > 0) at--;
  nat.fixtures.splice(at, 0, fx);
  return fx;
}

/** 내 나라의 아직 안 치른 대회 경기를 일정에 넣는다 (조별은 추첨 때, 녹아웃은 대진이 정해질 때마다) */
export function ensureMyFixtures(state: GameState, live: TournamentLive, view = tournamentState(state, live)): void {
  if (!live.called) return;
  const me = myNation(state).name;
  for (const m of view.matches) if (!m.res && (m.a === me || m.b === me)) ensureMyFixture(state, live, m);
}

/** 내 나라 경기가 아닌 경기 빠른 계산 (경기 열쇠 시드): 중립 경기 점수, 녹아웃 무승부면 승부차기 */
function quickTMatch(state: GameState, live: TournamentLive, str: Map<string, number>, m: TMatch): void {
  const rng = createRng(hashSeed(`${state.worldSeed}:tmatch:${live.id}:${m.key}`));
  const sa = liveStrength(state, live, str, m.a);
  const sb = liveStrength(state, live, str, m.b);
  const [ga, gb] = neutralScore(rng, sa, sb);
  live.played[m.key] = m.ko && ga === gb ? [ga, gb, pensScore(rng, pensWinner(rng, sa, sb))] : [ga, gb];
}

/**
 * 내 대회 경기 결과를 기록한다 (내 쪽 기준 점수). 녹아웃 무승부면 승부차기를 판정해 m.pens 에도 적는다.
 * 돌려주는 값: 승부차기 · 내 나라가 이겼는지
 */
export function settleMyTournamentMatch(state: GameState, live: TournamentLive, m: NatMatch, gf: number, ga: number): { pens?: [number, number]; won: boolean } {
  const key = m.key.slice(`t:${live.id}:`.length);
  const me = myNation(state).name;
  let res: TResult = m.home ? [gf, ga] : [ga, gf];
  const ko = key.startsWith('k');
  if (ko && gf === ga) {
    const str = liveStrengths(state, live);
    const rng = createRng(hashSeed(`${state.worldSeed}:tpens:${live.id}:${key}`));
    const a = m.home ? me : m.opp;
    const b = m.home ? m.opp : me;
    const aWins = pensWinner(rng, liveStrength(state, live, str, a), liveStrength(state, live, str, b));
    const pens = pensScore(rng, aWins);
    res = [res[0], res[1], pens];
    m.pens = m.home ? pens : [pens[1], pens[0]];
  }
  live.played[key] = res;
  const won = winnerOf(m.home ? me : m.opp, m.home ? m.opp : me, res) === me;
  return { ...(m.pens ? { pens: m.pens } : {}), won };
}

/**
 * 대회를 진행한다: until 날짜까지(null = 끝까지)의 안 치른 경기를 날짜 순으로 — 내 나라 경기(소집됐을 때)는 play 콜백으로 치르고(없으면 게임 루프가
 * 그날 치르도록 남겨 둔다), 나머지는 빠른 계산. 단계가 끝나 다음 대진이 생기면 이어서. 끝나면 내 다음 경기를 일정에 넣는다
 */
export function advanceTournament(state: GameState, live: TournamentLive, until: IsoDate | null, play?: PlayMine): TournamentView {
  const me = myNation(state).name;
  const str = liveStrengths(state, live);
  let view = tournamentState(state, live);
  for (let guard = 0; guard < 16 && !view.done; guard++) {
    let progressed = false;
    for (const m of view.matches) {
      if (m.res || (until !== null && daysBetween(m.date, until) < 0)) continue;
      if (live.called && (m.a === me || m.b === me)) {
        if (!play) continue;
        const fx = ensureMyFixture(state, live, m);
        const r = play(fx, liveStrength(state, live, str, me), liveStrength(state, live, str, m.a === me ? m.b : m.a));
        settleMyTournamentMatch(state, live, fx, r.gf, r.ga);
      } else quickTMatch(state, live, str, m);
      progressed = true;
    }
    if (!progressed) break;
    view = tournamentState(state, live);
  }
  ensureMyFixtures(state, live, view);
  return view;
}

/** 내 나라가 아직 대회에 남아 있다 (소집됐을 때만 뜻이 있다): 조별 진행 중이거나 지금 녹아웃 단계에 남아 있고, 우승이 정해지지 않았다 */
export function myNationAlive(state: GameState, live: TournamentLive, view = tournamentState(state, live)): boolean {
  return !view.done && view.alive.includes(myNation(state).name);
}

/** 달력 위 대회가 내 경기를 기다린다 (시즌 끝을 미룬다, C.81l) */
export function natTournamentAlive(state: GameState): boolean {
  const live = state.national?.live;
  return !!live && live.called && live.year === state.league.season + 1 && myNationAlive(state, live);
}

/** 대회 기록 (끝났으면 우승·성적, 진행 중이면 champion '' · reach '진행 중'): 화면·시즌 끝 기록이 같이 쓴다 */
export function tournamentRecord(state: GameState, live: TournamentLive, view = tournamentState(state, live)): TournamentRec {
  const me = myNation(state).name;
  const reach = !live.qualified ? '예선 탈락' : view.done ? reachOf(me, view.champion!, view.ko) : '진행 중';
  return {
    id: live.id, comp: live.comp, year: live.year, qualified: live.qualified, called: live.called, reach, champion: view.champion ?? '',
    groups: view.tables.map((t, g) => ({ name: `${String.fromCharCode(65 + g)}조`, table: t })), ko: view.ko,
  };
}

/**
 * 대회 하나를 처음부터 끝까지 한꺼번에 치른다 (소집 안 된 해·시즌 끝 처리·테스트). myIn = 내가 소집돼 뛰는지 (내 나라 경기는 playMine 으로).
 * 날짜 순서대로 (조별 1~3차전 → 녹아웃) 내 경기를 부르므로 부상·피로가 다음 경기에 이어진다
 */
export function runTournament(state: GameState, comp: TournamentComp, year: number, finalDate: IsoDate, myIn: boolean, play: PlayMine): TournamentRun {
  const live = drawTournament(state, comp, year, finalDate, myIn);
  const before = new Set(ensureNational(state).fixtures);
  const view = advanceTournament(state, live, null, play);
  return { rec: tournamentRecord(state, live, view), mine: ensureNational(state).fixtures.filter((m) => !before.has(m)) };
}

function reachOf(me: string, champion: string, ko: TournamentRec['ko']): string {
  if (champion === me) return '우승';
  for (let k = ko.length - 1; k >= 0; k--) {
    if (ko[k]!.ties.some((t) => t.a === me || t.b === me)) return ko[k]!.name === '결승' ? '준우승' : ko[k]!.name;
  }
  return '조별 탈락';
}

/** 소집 판정 (대회): 본선에 오른 나라 + 긴 부상 아님 + 확률(callup + tournamentBonus). 시드는 해마다 하나 (6월 평가전과 같은 시드 줄) */
function tournamentCallup(state: GameState, comp: TournamentComp, year: number): { qualified: boolean; called: boolean } {
  const me = myNation(state);
  const rng = createRng(hashSeed(`${state.worldSeed}:summer:${year}`));
  const injuredLong = !!state.player.injury && state.player.injury.daysLeft > N().startAfter;
  const qualified = participants(state.worldSeed, comp, year).includes(me.name);
  return { qualified, called: qualified && !injuredLong && rng() < callChance(state, N().tournamentBonus) };
}

/**
 * 클럽 시즌이 끝나는 날 (C.81l, game.ts: 리그 최종 라운드 + 내 컵 경기가 다 끝난 하루 끝·경기 뒤): 이번 여름 대회 소집 판정을 한 번 하고,
 * 소집되면 대회를 추첨해 달력 위에 올린다 (조별 3경기를 내 일정에, 인박스 소집 알림). 소집 안 되면 시즌 끝에 결과만 (nationalSeasonEnd)
 */
export function nationalKickoff(state: GameState, finalDate: IsoDate): TournamentLive | null {
  const nat = ensureNational(state);
  const year = state.league.season + 1;
  if (nat.summer?.year === year) return nat.live ?? null;
  const me = myNation(state);
  const comp = myTournament(me, year);
  if (!comp) return null;
  const { called } = tournamentCallup(state, comp, year);
  nat.summer = { year, called };
  if (!called) return null;
  const live = drawTournament(state, comp, year, finalDate, true);
  nat.live = live;
  const view = tournamentState(state, live);
  ensureMyFixtures(state, live, view);
  const name = `${year} ${NAT_COMP_KO[comp]}`;
  const mine = view.matches.filter((m) => m.a === me.name || m.b === me.name);
  const grp = live.groups.findIndex((g) => g.includes(me.name));
  pushInbox(state, {
    key: `natcall:t:${live.id}`, cat: 'national', title: `${name} 대표팀 소집`,
    body: `${me.nameKo} 대표팀 최종 명단에 들었어요. 클럽 시즌이 끝나면 휴가, ${live.camp.slice(5).replace('-', '/')} 소집. ${String.fromCharCode(65 + grp)}조 — ${mine.map((m) => `${m.date.slice(5).replace('-', '/')} ${nationOf(m.a === me.name ? m.b : m.a).nameKo}전`).join(' · ')}. 경기는 클럽 경기처럼 직접 치러요.`,
    link: { to: 'national', label: '대표팀' },
  });
  return live;
}

/** 하루 끝 (endDay, 날짜 = 끝난 날): 달력 위 대회의 그날까지 다른 나라 경기를 빠른 계산하고, 대진이 정해지면 내 다음 경기를 일정에 넣는다 */
export function tournamentDayEnd(state: GameState, date: IsoDate): void {
  const live = state.national?.live;
  if (!live || !live.called || live.year !== state.league.season + 1) return;
  advanceTournament(state, live, date);
}

/** 대회 성적 → 업적 (18.12): 소집된 대회만 */
export function tournamentAchievement(comp: TournamentComp, reach: string): { label: string; xp: number; key: string } | null {
  const X = N().xp;
  const name = NAT_COMP_KO[comp];
  if (comp === 'wc') {
    const xp = reach === '우승' ? X.wcWin : reach === '준우승' ? X.wcFinal : reach === '4강' ? X.wcSemi : reach === '8강' ? X.wcQuarter : 0;
    return xp ? { label: `${name} ${reach === '4강' || reach === '8강' ? `${reach} 진출` : reach}`, xp, key: reach === '우승' ? 'wcWin' : 'wc' } : null;
  }
  return reach === '우승' ? { label: `${name} 우승`, xp: X.continentalWin, key: 'continental' } : null;
}

export interface NatSeasonEnd {
  /** 업적 (시즌 업적에 더한다) */
  achievements: { label: string; xp: number; key: string }[];
  /** 이번 여름 대회 (없으면 null) */
  tournament: TournamentRec | null;
  /** 이번 여름 내 대표팀 경기 */
  matches: NatMatch[];
}

/**
 * 시즌 끝 여름 (endSeason): 내 나라 대회가 있는 해면 그 대회 — 달력 위에서 진행하던 대회(nat.live)는 남은 경기를 한꺼번에 치러 기록으로,
 * 아니면(소집 안 됨·본선 탈락·옛 흐름) 소집 판정(클럽 시즌 끝 판정이 있으면 그것) 뒤 조별 + 녹아웃을 한꺼번에. 없으면 6월 평가전 2경기(소집 판정).
 * year = 시즌이 끝나는 해 (2018-19 시즌 → 2019). finalDate = 리그 최종 라운드 날짜
 */
export function nationalSeasonEnd(state: GameState, finalDate: IsoDate, play: PlayMine): NatSeasonEnd {
  const nat = ensureNational(state);
  const me = myNation(state);
  const year = state.league.season + 1;
  const comp = myTournament(me, year);
  const out: NatSeasonEnd = { achievements: [], tournament: null, matches: [] };
  if (comp) {
    let live = nat.live && nat.live.year === year ? nat.live : null;
    if (!live) {
      const q = tournamentCallup(state, comp, year);
      const called = nat.summer?.year === year ? nat.summer.called : q.called;
      live = drawTournament(state, comp, year, finalDate, called);
    }
    const view = advanceTournament(state, live, null, play);
    const rec = tournamentRecord(state, live, view);
    const prefix = `t:${live.id}:`;
    const mine = nat.fixtures.filter((m) => m.key.startsWith(prefix));
    delete nat.live;
    const { qualified, called } = live;
    out.matches = mine;
    out.tournament = rec;
    nat.tournaments.push(rec);
    while (nat.tournaments.length > N().keepTournaments) nat.tournaments.shift();
    const ach = called ? tournamentAchievement(comp, rec.reach) : null;
    if (ach) out.achievements.push(ach);
    if (called || qualified) nat.honors.push({ comp, year, reach: called ? rec.reach : `${rec.reach} (미소집)`, xp: ach?.xp ?? 0 });
    const name = `${year} ${NAT_COMP_KO[comp]}`;
    pushInbox(state, {
      key: `natcup:${rec.id}`, cat: 'national', title: `${name} ${!qualified ? '본선 진출 실패' : called ? rec.reach : '소집 안 됨'}`,
      body: !qualified
        ? `${me.nameKo}는 ${name} 본선에 오르지 못했어요. 우승은 ${nationOf(rec.champion).nameKo}.`
        : called
          ? `${me.nameKo} 대표로 ${name}에 나갔어요 — ${rec.reach}. ${mine.filter((m) => (m.min ?? 0) > 0).length}경기 ${mine.reduce((t, m) => t + (m.g ?? 0), 0)}골. 우승 ${nationOf(rec.champion).nameKo}.`
          : `${name} 대표팀 명단에 들지 못했어요. ${me.nameKo} ${rec.reach}, 우승 ${nationOf(rec.champion).nameKo}.`,
      link: { to: 'national', label: '대표팀' },
    });
    return out;
  }
  // 대회가 없는 해: 6월 평가전
  const J = N().june;
  const rng = createRng(hashSeed(`${state.worldSeed}:summer:${year}`));
  const injuredLong = !!state.player.injury && state.player.injury.daysLeft > N().startAfter;
  const called = !injuredLong && rng() < callChance(state);
  if (!called) return out;
  const opps: string[] = [];
  for (let k = 0; k < J.matches; k++) {
    const opp = friendlyOpponent(state, rng, opps);
    opps.push(opp);
    const m: NatMatch = { key: `j:${year}:${k}`, date: addDays(finalDate, J.days[k] ?? 19 + k * 4), comp: 'friendly', stage: '평가전', opp, home: rng() < 0.5, seq: 200 + (++nat.seq % 800), season: state.league.season };
    const str = nationRating(me.name);
    play(m, str + myBoost(state, str), nationRating(opp));
    nat.fixtures.push(m);
    out.matches.push(m);
  }
  return out;
}

/** 세이브 크기: 경기 기록은 최근 maxFixtures 개 */
export function trimNational(nat: NationalState, max = 240): void {
  if (nat.fixtures.length > max) nat.fixtures.splice(0, nat.fixtures.length - max);
}
