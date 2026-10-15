// 엔진 통계 점검 스위트 (E.15, E.15.1, E.18 0번): 표본 구성 → 병렬 실행 → 지표 계산
// 전체 점검(balance:engine), 경량 회귀 가드(balance:engine:check), 상수 스윕(balance:sweep)이 같이 쓴다.

import type { FieldAttribute, GkAttributes } from '../../src/attributes';
import { FORMATION_SLOTS, FORMATIONS, type Formation } from '../../src/formations';
import { createTeamRoster, posGroup, rosterRating, type PosGroup } from '../../src/roster';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { curveAttr } from '../../src/engine/sim';
import type { TeamStats } from '../../src/engine/types';
import type { AttrMod, CompactPlayer, Job, JobOut, LeagueMatchOut, MatchJob, MatchOut, SeasonOut, TeamSpec } from './job';
import { runJobs } from './pool';
import { BALANCED } from './job';

export type Mode = 'full' | 'light' | 'sweep';

export interface Row {
  section: string;
  key: string;
  label: string;
  target: string;
  value: number;
  /** 통과 범위 (E.15 목표) */
  lo: number;
  hi: number;
  digits: number;
  /** 경량 회귀 가드 범위 (check 모드에서 이것으로 판정) */
  guard?: [number, number];
  /** 범위가 아닌 판정 (예: 상위 3개 포지션군에 ST 없음) */
  pass?: boolean;
  note?: string;
}

export interface ResponseRow {
  key: string;
  attrs: string;
  target: string;
  metric: string;
  criterion: string;
  base: number;
  mod: number;
  change: number;
  unit: '%p' | '%' | '' | '분';
  pass: boolean;
  guard?: number;
  /** 표의 기준값 (방향 포함, 하락·축소처럼 방향만 보면 ±0) */
  need: number;
  /** 짝지은 부트스트랩 단측 95% 한계 (기준 방향 쪽 5번째 백분위수) */
  bound: number;
}

/** 스탯 반응 통과 (D.12, E.20 6번): 방향이 통계적으로 확실하고(단측 95%), 크기가 기준값의 70% 이상 */
export const RESP_SHARE = 0.7;

/** 엔진 보정 중 임시 경량 가드 범위 (부록 C.13, C.17 결정 5: 시즌 XP 비 상한만 1.2, 득점·ST 반응은 원래 범위). 보정이 끝나면 false 로 되돌린다 */
export const TEMP_GUARD = true;
const BOOT = 400;

/** 짝지은 부트스트랩: 같은 경기 시드 쌍을 다시 뽑아 변화량 분포의 단측 95% 한계 */
function bootBound(n: number, change: (idx: number[]) => number, up: boolean): number {
  let st = 0x9e3779b9;
  const next = () => {
    st = (Math.imul(st, 1664525) + 1013904223) >>> 0;
    return st / 4294967296;
  };
  const xs: number[] = [];
  for (let b = 0; b < BOOT; b++) {
    const idx = Array.from({ length: n }, () => Math.floor(next() * n));
    xs.push(change(idx));
  }
  xs.sort((a, b) => a - b);
  return up ? xs[Math.floor(BOOT * 0.05)]! : xs[Math.ceil(BOOT * 0.95) - 1]!;
}

/** 스탯 반응 상한 (E.20 5번 기록): 크기가 표 기준값의 RESP_CAP 배 이하 */
export const RESP_CAP = 2.5;

function respPass(change: number, need: number, bound: number): boolean {
  const up = need >= 0;
  const significant = up ? bound > 0 : bound < 0;
  const big = up ? change >= RESP_SHARE * need : change <= RESP_SHARE * need;
  return significant && big;
}

/** 상한을 넘었는가 (방향만 보는 항목은 상한 없음) */
export function respOver(change: number, need: number): boolean {
  if (Math.abs(need) < 0.001) return false;
  return need > 0 ? change > RESP_CAP * need : change < RESP_CAP * need;
}

export interface SuiteResult {
  mode: Mode;
  rows: Row[];
  responses: ResponseRow[];
  matches: number;
  seconds: number;
  msPerMatch: number;
  extra: string[];
}

// ── 표본 구성 ──

const SLOT442 = { GK: 0, LB: 1, CB: 2, LM: 5, CM: 6, ST: 9 } as const;

export function std(side: string, i: number, rating = 75, formation: Formation = '4-4-2', tactics: TeamSpec['tactics'] = 'balanced'): TeamSpec {
  return { id: `v${side}${i}`, rating, seed: `eng-${side}-${rating}-${i}`, formation, tactics };
}

function match(seed: number, home: TeamSpec, away: TeamSpec, extra: Partial<MatchJob> = {}): MatchJob {
  return { kind: 'match', seed, home, away, neutral: true, ...extra };
}

export interface ResponseDef {
  key: string;
  label: string;
  target: string;
  slot: number;
  attrs: string[];
  light?: boolean;
}

/** E.15.1 스탯 반응 표 (+10). 같은 시드의 표준 경기와 짝지어, 양 팀의 같은 슬롯 선수 1명씩만 바꾼다 */
export const RESPONSES: ResponseDef[] = [
  { key: 'st_shoot', label: '슈팅, 결정력, 침착성', target: 'ST', slot: SLOT442.ST, attrs: ['shooting', 'bigMatch', 'composure'], light: true },
  { key: 'cm_pass', label: '숏패스, 시야', target: 'CM', slot: SLOT442.CM, attrs: ['shortPassing', 'vision'], light: true },
  { key: 'wing_drib', label: '드리블, 민첩성, 볼 컨트롤', target: '윙어(LM)', slot: SLOT442.LM, attrs: ['dribbling', 'agility', 'ballControl'] },
  { key: 'pace', label: '속도, 가속', target: 'ST', slot: SLOT442.ST, attrs: ['pace', 'acceleration'] },
  { key: 'cb_def', label: '태클, 수비 포지셔닝, 마킹', target: 'CB', slot: SLOT442.CB, attrs: ['tackling', 'defensivePositioning', 'marking'], light: true },
  { key: 'aerial', label: '헤더, 점프', target: 'CB', slot: SLOT442.CB, attrs: ['heading', 'jumping'] },
  { key: 'cross', label: '크로스', target: '윙어(LM)', slot: SLOT442.LM, attrs: ['crossing'] },
  { key: 'stamina', label: '체력', target: 'CM', slot: SLOT442.CM, attrs: ['stamina'] },
  { key: 'gk', label: '선방, 핸들링', target: 'GK', slot: SLOT442.GK, attrs: ['gk.shotStopping', 'gk.handling'] },
];

const GROUPS: PosGroup[] = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
/** 전체 OVR +5 반응: 포지션군마다 그 군이 있는 포메이션과 슬롯 */
const GROUP_SLOT: Record<PosGroup, [Formation, number]> = {
  GK: ['4-4-2', 0], CB: ['4-4-2', 2], FB: ['4-4-2', 1], CDM: ['4-3-3', 5], CM: ['4-4-2', 6], CAM: ['4-2-3-1', 8], WING: ['4-3-3', 8], ST: ['4-4-2', 9],
};
const STRENGTHS = [68, 75, 82];

export interface SetDef {
  name: string;
  jobs: Job[];
}

export interface Sizes {
  neutral: number;
  diff8: number;
  poss10: number;
  home: number;
  red: number;
  formation: number;
  response: number;
  sens: number;
  rating: number;
  ovr5: number;
  seasons: number;
  tactic: number;
  /** 실제 선수 리그 시즌 수 (실제 로스터 20팀 전 경기 엔진, E.20 5번) */
  league: number;
}

export const SIZES: Record<Mode, Sizes> = {
  full: { neutral: 400, diff8: 200, poss10: 200, home: 300, red: 400, formation: 40, response: 400, sens: 200, rating: 240, ovr5: 200, seasons: 6, tactic: 200, league: 3 },
  light: { neutral: 120, diff8: 120, poss10: 0, home: 0, red: 0, formation: 0, response: 120, sens: 0, rating: 120, ovr5: 0, seasons: 6, tactic: 0, league: 0 },
  sweep: {
    neutral: Number(process.env.SWEEP_N ?? 60), diff8: Number(process.env.SWEEP_D ?? 40), poss10: 0, home: Number(process.env.SWEEP_HOME ?? 0), red: 0, formation: 0,
    response: Number(process.env.SWEEP_RESP ?? 40), sens: 0, rating: Number(process.env.SWEEP_RATING ?? 0), ovr5: 0, seasons: Number(process.env.SWEEP_SEASONS ?? 0), tactic: 0,
    league: Number(process.env.SWEEP_LEAGUE ?? 0),
  },
};

/** 동레이팅 표준 경기 (양 팀 균형 + 4-4-2, 중립) */
export const neutralJob = (i: number, extra: Partial<MatchJob> = {}): MatchJob => match(1000 + i, std('a', i), std('b', i), extra);

const SEASON_PLAYERS: [string, string][] = [
  ['ST', 'kane'], ['CM', 'eriksen'], ['CB', 'van-dijk'], ['LW', 'sterling'], ['RB', 'alexander-arnold'], ['CAM', 'de-bruyne'],
];

export function buildSets(mode: Mode, overrides?: Record<string, number>): SetDef[] {
  const z = SIZES[mode];
  const o = overrides ? { overrides } : {};
  const n = (k: number, f: (i: number) => Job): Job[] => Array.from({ length: k }, (_, i) => f(i));
  const sets: SetDef[] = [];
  sets.push({ name: 'neutral', jobs: n(z.neutral, (i) => neutralJob(i, o)) });
  sets.push({ name: 'diff8', jobs: n(z.diff8, (i) => match(3000 + i, std('a', i, 79), std('b', i, 71), o)) });
  // Δ+10 점유율: 팀 데이터 전술(성향 포함, 자기 포메이션) / 빌드업 성향 0.5 고정
  sets.push({ name: 'poss10', jobs: n(z.poss10, (i) => match(5000 + i, { id: `pa${i}`, rating: 80, seed: `poss-a-${i}`, tactics: 'data' }, { id: `pb${i}`, rating: 70, seed: `poss-b-${i}`, tactics: 'data' }, o)) });
  sets.push({ name: 'poss10fixed', jobs: n(z.poss10, (i) => match(5000 + i, { id: `pa${i}`, rating: 80, seed: `poss-a-${i}`, tactics: FIXED_STYLE }, { id: `pb${i}`, rating: 70, seed: `poss-b-${i}`, tactics: FIXED_STYLE }, o)) });
  sets.push({ name: 'home', jobs: n(z.home, (i) => match(7000 + i, std('a', 7000 + i), std('b', 7000 + i), { ...o, neutral: false })) });
  sets.push({ name: 'red', jobs: n(z.red, (i) => match(9000 + i, std('a', 9000 + i), std('b', 9000 + i), { ...o, forceRed: { team: 0, minute: 30 } })) });
  sets.push({ name: 'formation', jobs: FORMATIONS.flatMap((f, k) => n(z.formation, (i) => match(11000 + k * 100 + i, std('a', 11000 + k * 100 + i, 75, f), std('b', 11000 + k * 100 + i, 75, f), o))) });
  for (const r of RESPONSES) {
    if (mode !== 'full' && !r.light && !(mode === 'sweep' && process.env.SWEEP_ALLRESP)) continue;
    // 스윕: SWEEP_RESPKEYS=cross,stamina 처럼 고른 반응만
    if (mode === 'sweep' && process.env.SWEEP_RESPKEYS && !process.env.SWEEP_RESPKEYS.split(',').includes(r.key)) continue;
    const mods: AttrMod[] = [0, 1].map((team) => ({ team: team as 0 | 1, slot: r.slot, attrs: r.attrs, delta: 10 }));
    sets.push({ name: `resp:${r.key}`, jobs: n(z.response, (i) => neutralJob(i, { ...o, mods })) });
  }
  sets.push({ name: 'sens:map', jobs: n(z.sens, (i) => neutralJob(i, { overrides: { ...overrides, 'onball.valueScale': 1.05 } })) });
  sets.push({ name: 'sens:shot', jobs: n(z.sens, (i) => neutralJob(i, { overrides: { ...overrides, 'onball.shotScale': 1.05 } })) });
  // 평점 표본: 약·중·강팀 × 포메이션 5종 (포지션 8군이 고르게 나오게)
  sets.push({ name: 'rating', jobs: n(z.rating, (i) => match(13000 + i, std('a', 13000 + i, STRENGTHS[i % 3]!, FORMATIONS[i % 5]!), std('b', 13000 + i, 75, FORMATIONS[(i + 2) % 5]!), o)) });
  // 전체 OVR +5 (모든 포지션): 포지션군을 돌아가며 홈 팀 선수 1명
  const ovrJob = (i: number, mod: boolean): MatchJob => {
    const g = GROUPS[i % 8]!;
    const [f, slot] = GROUP_SLOT[g];
    return match(15000 + i, std('a', 15000 + i, STRENGTHS[Math.floor(i / 8) % 3]!, f), std('b', 15000 + i, 75, f), {
      ...o, ...(mod ? { mods: [{ team: 0, slot, attrs: ['all'], delta: 5 }] } : {}),
    });
  };
  sets.push({ name: 'ovr5:base', jobs: n(z.ovr5, (i) => ovrJob(i, false)) });
  sets.push({ name: 'ovr5:mod', jobs: n(z.ovr5, (i) => ovrJob(i, true)) });
  // 전술 반응 (E.15, E.19): 홈 팀의 세부 전술 하나만 낮음 ↔ 높음, 상대는 균형. 같은 시드 짝
  for (const [d, lo, hi] of TACTIC_PAIRS) {
    for (const [tag, v] of [['lo', lo], ['hi', hi]] as const) {
      sets.push({ name: `tac:${d}:${tag}`, jobs: n(z.tactic, (i) => match(17000 + i, std('a', 17000 + i, 75, '4-4-2', { ...BALANCED, [d]: v }), std('b', 17000 + i), o)) });
    }
  }
  for (const engine of ['agent', 'quick'] as const) {
    sets.push({ name: `season:${engine}`, jobs: n(z.seasons, (i) => ({ kind: 'season', playerId: SEASON_PLAYERS[i % 6]![1], seed: `season-${i}`, engine, ...o })) });
  }
  // 실제 선수 리그 (실제 로스터 20팀, 홈·원정 2회전 380경기 × 시즌)
  for (let k = 0; k < z.league; k++) {
    const ws = `league-${k}`;
    const ids = LEAGUE_IDS;
    const jobs: Job[] = [];
    let seed = 30000 + k * 1000;
    for (const h of ids) for (const a of ids) if (h !== a) jobs.push({ kind: 'league', worldSeed: ws, home: h, away: a, seed: seed++, ...o });
    sets.push({ name: `league:${k}`, jobs });
  }
  return sets.filter((s) => s.jobs.length > 0);
}

/** 2018-19 프리미어리그 20팀 id */
const LEAGUE_IDS = ['mci', 'liv', 'che', 'tot', 'ars', 'mun', 'wol', 'eve', 'lei', 'whu', 'wat', 'cry', 'new', 'bou', 'bur', 'sou', 'bha', 'car', 'ful', 'hud'];

/** 전술 반응 쌍: [세부 전술, 낮음 값, 높음 값]. 빌드업은 직선(0.2) ↔ 짧게(0.85) 순서로 "높음 = 짧게" */
export const TACTIC_PAIRS: [keyof typeof BALANCED, number, number][] = [
  ['lineHeight', 0.35, 0.65], ['pressing', 0.3, 0.8], ['style', 0.2, 0.85], ['width', 0.85, 1.15],
];

/** 빌드업 성향을 0.5로 고정한 데이터 전술 (E.15 능력치만의 점유율 효과) */
export const FIXED_STYLE: TeamSpec['tactics'] = { style: 0.5 };

export async function runSets(sets: SetDef[], label = '경기'): Promise<Map<string, JobOut[]>> {
  const all = sets.flatMap((s) => s.jobs);
  const outs = await runJobs(all, { label });
  const map = new Map<string, JobOut[]>();
  let k = 0;
  for (const s of sets) {
    map.set(s.name, outs.slice(k, k + s.jobs.length));
    k += s.jobs.length;
  }
  return map;
}

// ── 계산 도우미 ──

const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);
const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);
const perTeam = (ms: MatchOut[], f: (s: TeamStats) => number) => avg(ms.flatMap((m) => m.team.map(f)));
const totTeam = (ms: MatchOut[], f: (s: TeamStats) => number) => sum(ms.flatMap((m) => m.team.map(f)));
const poss = (m: MatchOut) => (m.team[0].possessionTicks / Math.max(1, m.team[0].possessionTicks + m.team[1].possessionTicks)) * 100;

function tracked(ms: MatchOut[], slot: number, team?: 0 | 1): CompactPlayer[] {
  return ms.flatMap((m) => m.players.filter((p) => p.starter && p.slot === slot && (team === undefined || p.team === team)));
}

function groupOf(p: CompactPlayer): PosGroup {
  return posGroup(p.position);
}

// ── 지표 계산 ──

export function analyze(mode: Mode, res: Map<string, JobOut[]>, seconds: number): SuiteResult {
  const M = (name: string) => (res.get(name) ?? []) as MatchOut[];
  const rows: Row[] = [];
  const extra: string[] = [];
  const add = (section: string, key: string, label: string, target: string, value: number, lo: number, hi: number, digits = 1, more: Partial<Row> = {}) => {
    rows.push({ section, key, label, target, value, lo, hi, digits, ...more });
  };
  const eq = M('neutral');
  const nMatches = [...res.values()].reduce((t, xs) => t + xs.filter((x) => x.kind === 'match').length, 0);
  const allMatches = [...res.values()].flat().filter((x): x is MatchOut => x.kind === 'match');
  const msPerMatch = avg(allMatches.map((m) => m.ms));

  if (eq.length) {
    const S = `동레이팅 75 중립 (균형 + 4-4-2, ${eq.length}경기, 팀당)`;
    add(S, 'goals', '득점', '1.35 ± 0.1', perTeam(eq, (s) => s.goals), 1.25, 1.45, 2, { guard: [1.1, 1.6] });
    add(S, 'poss', '점유율 (홈쪽 %)', '50 ± 3', avg(eq.map(poss)), 47, 53);
    add(S, 'passes', '패스 시도', '약 420', perTeam(eq, (s) => s.passes), 380, 460, 0);
    add(S, 'passPct', '패스 성공률 %', '80 ± 3', ratio(totTeam(eq, (s) => s.passesCompleted), totTeam(eq, (s) => s.passes)) * 100, 77, 83);
    add(S, 'shots', '슈팅', '약 12', perTeam(eq, (s) => s.shots), 10.5, 13.5);
    add(S, 'sot', '유효 슈팅', '약 4.2', perTeam(eq, (s) => s.shotsOnTarget), 3.6, 4.8);
    add(S, 'conv', '유효 슈팅 득점 전환 %', '약 32', ratio(totTeam(eq, (s) => s.goals), totTeam(eq, (s) => s.shotsOnTarget)) * 100, 28, 36);
    add(S, 'corners', '코너', '약 5', perTeam(eq, (s) => s.corners), 4, 6);
    add(S, 'fouls', '파울', '약 11', perTeam(eq, (s) => s.fouls), 9.5, 12.5);
    add(S, 'yellows', '옐로', '약 1.6', perTeam(eq, (s) => s.yellows), 1.3, 1.9, 2);
    add(S, 'reds', '레드', '약 0.06', perTeam(eq, (s) => s.reds), 0.02, 0.12, 3);
    add(S, 'offsides', '오프사이드', '약 2.2', perTeam(eq, (s) => s.offsides), 1.7, 2.7);
    add(S, 'adv', '어드밴티지', '약 2', perTeam(eq, (s) => s.advantages), 1.5, 2.5);
    add(S, 'advShare', '어드밴티지 / 파울 %', '15~20', ratio(totTeam(eq, (s) => s.advantages), totTeam(eq, (s) => s.fouls)) * 100, 15, 20);
    add(S, 'tackles', '태클', '약 16', perTeam(eq, (s) => s.tackles), 13.5, 18.5);
    add(S, 'ints', '인터셉트', '약 12', perTeam(eq, (s) => s.interceptions), 10, 14);
    add(S, 'dribbles', '드리블 시도', '약 14', perTeam(eq, (s) => s.dribbles), 11.5, 16.5);
    add(S, 'dribPct', '드리블 성공률 %', '약 50', ratio(totTeam(eq, (s) => s.dribblesWon), totTeam(eq, (s) => s.dribbles)) * 100, 45, 55);
    add(S, 'crosses', '크로스 시도', '약 16', perTeam(eq, (s) => s.crosses), 13.5, 18.5);
    add(S, 'crossPct', '크로스 성공률 %', '25~30', ratio(totTeam(eq, (s) => s.crossesCompleted), totTeam(eq, (s) => s.crosses)) * 100, 25, 30);
    add(S, 'aerials', '공중볼 경합', '약 35', perTeam(eq, (s) => s.aerials), 30, 40);
    add(S, 'savePct', 'GK 선방률 %', '68~72 (68~70 지향)', ratio(totTeam(eq, (s) => s.saves), totTeam(eq, (s) => s.shotsOnTarget)) * 100, 68, 72);
    const km = (g: string[]) => avg(eq.flatMap((m) => m.players.filter((p) => g.includes(p.position) && p.minutes >= 85).map((p) => p.distance / 1000)));
    add(S, 'distCM', '이동 거리 CM km', '10~12', km(['CM']), 10, 12, 2);
    add(S, 'distDef', '이동 거리 수비수 km', '9~10.5', km(['CB', 'LB', 'RB']), 9, 10.5, 2);
    add(S, 'distST', '이동 거리 ST km', '9~10.5', km(['ST', 'CF']), 9, 10.5, 2);
    add(S, 'live', '공이 살아 있는 시간 (분)', '55~65', avg(eq.map((m) => m.liveSeconds / 60)), 55, 65, 1, { guard: [40, 95] });
    add(S, 'throwIns', '스로인', '15~22', perTeam(eq, (s) => s.throwIns), 15, 22);
    add(S, 'goalKicks', '골킥', '6~10', perTeam(eq, (s) => s.goalKicks), 6, 10);
    add(S, 'longPct', '롱패스(30 m 이상) 비율 %', '10~16', ratio(totTeam(eq, (s) => s.longPasses), totTeam(eq, (s) => s.passes)) * 100, 10, 16);
    // C.17 결정 2: 30 m 이상 패스 성공률 (실제 약 50~60%)
    add(S, 'longDone', '롱패스(30 m 이상) 성공률 %', '50~60', ratio(totTeam(eq, (s) => s.longCompleted), totTeam(eq, (s) => s.longPasses)) * 100, 50, 60);
    add(S, 'counterPct', '역습 슈팅(소유 10초 안) %', '15~25', ratio(totTeam(eq, (s) => s.counterShots), totTeam(eq, (s) => s.shots)) * 100, 15, 25);
    add(S, 'gkShotPct', '골킥 직후 15초 안 슈팅 %', '5 이하', ratio(totTeam(eq, (s) => s.goalKickShots), totTeam(eq, (s) => s.shots)) * 100, 0, 5);
    add(S, 'ms', '경기 계산 시간 ms (워커)', '2000 이하', msPerMatch, 0, 2000, 0);
    if (mode === 'sweep') {
      // 스윕용 간이 분포 (표준 경기 4-4-2 만)
      const gb = (gs: PosGroup[]) => sum(eq.flatMap((m) => m.players.filter((p) => gs.includes(groupOf(p))).map((p) => p.goals)));
      const tot = gb(GROUPS);
      add(S, 'gSTn', '득점 비율 ST (4-4-2) %', '38~48', ratio(gb(['ST']), tot) * 100, 38, 48, 0);
      add(S, 'gMIDn', '득점 비율 미드 (4-4-2) %', '18~28', ratio(gb(['CDM', 'CM', 'CAM']), tot) * 100, 18, 28, 0);
    }

    // 판단 민감도
    for (const [name, label] of [['sens:map', '위치 가치 맵 × 1.05'], ['sens:shot', '슛 효용 × 1.05']] as const) {
      const ss = M(name);
      if (!ss.length) continue;
      const base = perTeam(eq.slice(0, ss.length), (s) => s.goals);
      add(S, name, `판단 민감도: ${label} 득점 변화 %`, '±10 이내', (perTeam(ss, (s) => s.goals) / base - 1) * 100, -10, 10);
    }
  }

  // 분포 (포메이션 5종 + 표준 경기)
  const distSet = [...eq, ...M('formation')];
  if (M('formation').length) {
    const S = `분포 (표준 ${eq.length}경기 + 포메이션 5종 각 ${M('formation').length / 5}경기)`;
    const goalsBy = (gs: PosGroup[]) => sum(distSet.flatMap((m) => m.players.filter((p) => gs.includes(groupOf(p))).map((p) => p.goals)));
    const total = goalsBy(GROUPS);
    add(S, 'gST', '득점 비율 ST/CF %', '38~48', ratio(goalsBy(['ST']), total) * 100, 38, 48);
    add(S, 'gWING', '득점 비율 윙어 %', '20~28', ratio(goalsBy(['WING']), total) * 100, 20, 28);
    add(S, 'gMID', '득점 비율 미드 %', '18~28', ratio(goalsBy(['CDM', 'CM', 'CAM']), total) * 100, 18, 28);
    add(S, 'gDEF', '득점 비율 수비 %', '8~14', ratio(goalsBy(['CB', 'FB']), total) * 100, 8, 14);
    const rec = GROUPS.map((g) => [g, sum(distSet.flatMap((m) => m.players.filter((p) => groupOf(p) === g).map((p) => p.received)))] as const)
      .sort((a, b) => b[1] - a[1]);
    const totalRec = sum(rec.map((r) => r[1]));
    const stRank = rec.findIndex((r) => r[0] === 'ST') + 1;
    add(S, 'recST', '패스 수신 순위: ST/CF', '상위 3개 밖 (4위 이하)', stRank, 4, 8, 0, {
      note: rec.map(([g, v]) => `${g} ${((v / totalRec) * 100).toFixed(0)}%`).join(' · '),
    });
    const shotsBy = (gs: PosGroup[]) => sum(distSet.flatMap((m) => m.players.filter((p) => gs.includes(groupOf(p))).map((p) => p.shots)));
    const st = shotsBy(GROUPS);
    extra.push(`슈팅 비율: ST ${(ratio(shotsBy(['ST']), st) * 100).toFixed(0)}% · 윙어 ${(ratio(shotsBy(['WING']), st) * 100).toFixed(0)}% · 미드 ${(ratio(shotsBy(['CDM', 'CM', 'CAM']), st) * 100).toFixed(0)}% · 수비 ${(ratio(shotsBy(['CB', 'FB']), st) * 100).toFixed(0)}%`);
  }

  // 레이팅 차, 점유율
  const d8 = M('diff8');
  if (d8.length) {
    const S = `레이팅 차 (Δ+8: 79 vs 71 중립 ${d8.length}경기, 균형 + 4-4-2)`;
    const strong = avg(d8.map((m) => m.homeGoals));
    const weak = avg(d8.map((m) => m.awayGoals));
    add(S, 'g8', '강팀 득점 (Δ+8)', '1.8~2.4', strong, 1.8, 2.4, 2, { guard: [1.3, 2.8] });
    add(S, 'gm8', '약팀 득점 (Δ−8)', '0.75~1.05', weak, 0.75, 1.05, 2, { guard: [0.5, 1.3] });
    add(S, 'gr8', '강팀/약팀 득점비', '3 이하', ratio(strong, weak), 1, 3, 2, { guard: [1.4, 4] });
  }
  if (M('poss10').length) {
    const S = `점유율 Δ+10 (80 vs 70 중립 ${M('poss10').length}경기)`;
    add(S, 'p10', '점유율 Δ+10 (데이터 전술) %', '55~58', avg(M('poss10').map(poss)), 55, 58);
    add(S, 'p10f', '점유율 Δ+10 (빌드업 0.5 고정) %', '52 이상', avg(M('poss10fixed').map(poss)), 52, 100);
  }

  // 홈
  const home = M('home');
  if (home.length) {
    const S = `홈 경기 (동레이팅, ${home.length}경기)`;
    const w = (home.filter((m) => m.homeGoals > m.awayGoals).length / home.length) * 100;
    const d = (home.filter((m) => m.homeGoals === m.awayGoals).length / home.length) * 100;
    add(S, 'homeW', '홈 승 %', '45 ± 4', w, 41, 49, 0);
    add(S, 'homeD', '무 %', '27 ± 4', d, 23, 31, 0);
    add(S, 'homeL', '패 %', '28 ± 4', 100 - w - d, 24, 32, 0);
  }

  // 퇴장
  const red = M('red');
  if (red.length && eq.length) {
    const S = `퇴장 (30분 홈 미드 퇴장, ${red.length}경기, 30분 이후 득점)`;
    const after = (m: MatchOut, team: 0 | 1) => m.goals.filter((g) => g.team === team && g.t >= 1800).length;
    const base = avg(eq.flatMap((m) => [after(m, 0), after(m, 1)]));
    add(S, 'red10', '10명 팀 득점 변화 %', '−20~−45', (avg(red.map((m) => after(m, 0))) / base - 1) * 100, -45, -20, 0);
    add(S, 'red11', '11명 팀 득점 변화 %', '+5~+35', (avg(red.map((m) => after(m, 1))) / base - 1) * 100, 5, 35, 0);
  }

  // 평점: 약·중·강팀 × 포지션 8군 균등 표본 (홈 팀 선발, 45분 이상)
  const rs = M('rating');
  if (rs.length) {
    const S = `평점 (약·중·강 × 포지션 8군 균등, ${rs.length}경기)`;
    const cells = new Map<string, number[]>();
    rs.forEach((m, i) => {
      for (const p of m.players) {
        if (p.team !== 0 || !p.starter || p.minutes < 45) continue;
        const k = `${i % 3}:${groupOf(p)}`;
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k)!.push(p.rating);
      }
    });
    const nCell = Math.min(...GROUPS.flatMap((g) => [0, 1, 2].map((s) => cells.get(`${s}:${g}`)?.length ?? 0)));
    const sample = [...cells.values()].flatMap((xs) => xs.slice(0, nCell));
    const mu = avg(sample);
    add(S, 'rMean', '평점 평균', '약 6.5', mu, 6.3, 6.7, 2, { guard: [6.2, 6.8] });
    add(S, 'rSd', '평점 σ', '0.7~0.9', Math.sqrt(avg(sample.map((x) => (x - mu) ** 2))), 0.7, 0.9, 2, { guard: [0.5, 1.1] });
    const gm = GROUPS.map((g) => [g, avg([0, 1, 2].flatMap((s) => (cells.get(`${s}:${g}`) ?? []).slice(0, nCell)))] as const);
    for (const [g, m] of gm) add(S, `r${g}`, `평점 ${g}`, '6.5 ± 0.2', m, 6.3, 6.7, 2);
    const byStr = [0, 1, 2].map((s) => avg(GROUPS.flatMap((g) => (cells.get(`${s}:${g}`) ?? []).slice(0, nCell))));
    extra.push(`평점 팀 강도별 평균 (68 / 75 / 82): ${byStr.map((x) => x.toFixed(2)).join(' / ')}, 칸당 ${nCell}명`);
  }

  // 시즌 진행 (엔진 vs 빠른 경기 XP)
  const sa = res.get('season:agent') as SeasonOut[] | undefined;
  const sq = res.get('season:quick') as SeasonOut[] | undefined;
  if (sa?.length && sq?.length) {
    const S = `시즌 진행 (실제 선수 ${sa.length}명 × 1시즌, 엔진 vs 빠른 경기)`;
    // 출전당 XP 비 (E.20 6번 기록): 시즌 합계 비는 부상 한 번(예: 3경기 출전)에 ±0.25 흔들려 출전 10경기 이상인 선수만 출전당으로 비교한다
    const both = sa.map((x, i) => [x, sq[i]!] as const).filter(([e, q]) => e.apps >= 10 && q.apps >= 10);
    const perApp = (xs: SeasonOut[]) => sum(xs.map((x) => x.xp)) / Math.max(1, sum(xs.map((x) => x.apps)));
    const total = avg(sa.map((x) => x.xp)) / Math.max(1, avg(sq.map((x) => x.xp)));
    add(S, 'xpRatio', '시즌 경기 XP 엔진/빠른 (출전당, 10경기 이상)', '0.9~1.1 (2차 후 0.85~1.15)', perApp(both.map((b) => b[0])) / Math.max(1e-9, perApp(both.map((b) => b[1]))), 0.85, 1.15, 2, {
      // 엔진 보정 중 임시 범위 (부록 C.13, 추가 확정 6번): 0.85~1.3. E3.5 2차가 끝나면 0.85~1.15 로 되돌린다
      guard: TEMP_GUARD ? [0.85, 1.2] : [0.85, 1.15], note: `시즌 합계 비 ${total.toFixed(2)}, ${both.length}명`,
    });
    const all = sa.flatMap((x) => x.ratings);
    const mu = avg(all);
    add(S, 'seasonR', '실제 선수 시즌 평점 평균 (참고)', '강팀 주전 6.8~7.0 허용', mu, 6.2, 7.2, 2);
    sa.forEach((x, i) => extra.push(`시즌 ${SEASON_PLAYERS[i % 6]![1]}: 엔진 평점 ${x.rating.toFixed(2)} XP ${x.xp} 출전 ${x.apps} ${x.goals}골 ${x.assists}도움 · 빠른 경기 평점 ${sq[i]!.rating.toFixed(2)} XP ${sq[i]!.xp} ${sq[i]!.goals}골 ${sq[i]!.assists}도움`));
  }

  // 전술 반응 (E.15): 홈 팀만 바꾸고 상대는 균형
  if (M('tac:lineHeight:lo').length) {
    const S = `전술 반응 (홈 팀 세부 전술 하나만 낮음 ↔ 높음, 각 ${M('tac:lineHeight:lo').length}경기)`;
    const T = (d: string, tag: string) => M(`tac:${d}:${tag}`);
    const team = (ms: MatchOut[], k: 0 | 1, f: (s: TeamStats) => number) => avg(ms.map((m) => f(m.team[k])));
    const chg = (a: number, b: number) => (b / Math.max(1e-9, a) - 1) * 100;
    add(S, 'tLineOff', '라인 높음: 상대 오프사이드 변화 %', '+40 이상', chg(team(T('lineHeight', 'lo'), 1, (s) => s.offsides), team(T('lineHeight', 'hi'), 1, (s) => s.offsides)), 40, 1000, 0);
    add(S, 'tLineThru', '라인 높음: 상대 침투 패스 수신 변화 %', '증가', chg(team(T('lineHeight', 'lo'), 1, (s) => s.throughReceived), team(T('lineHeight', 'hi'), 1, (s) => s.throughReceived)), 0.01, 1000, 0);
    add(S, 'tPressWin', '압박 높음: 상대 진영 탈취 변화 %', '+25 이상', chg(team(T('pressing', 'lo'), 0, (s) => s.oppHalfWins), team(T('pressing', 'hi'), 0, (s) => s.oppHalfWins)), 25, 1000, 0);
    const teamKm = (ms: MatchOut[]) => avg(ms.map((m) => sum(m.players.filter((p) => p.team === 0).map((p) => p.distance))));
    add(S, 'tPressKm', '압박 높음: 팀 이동 거리 변화 %', '+3 이상', chg(teamKm(T('pressing', 'lo')), teamKm(T('pressing', 'hi'))), 3, 1000, 1);
    add(S, 'tPressFoul', '압박 높음: 파울 변화 %', '증가', chg(team(T('pressing', 'lo'), 0, (s) => s.fouls), team(T('pressing', 'hi'), 0, (s) => s.fouls)), 0.01, 1000, 0);
    const possOf = (ms: MatchOut[]) => avg(ms.map(poss));
    add(S, 'tBuildPoss', '빌드업 짧게 (↔ 직선): 점유율 변화 %p', '+5 이상', possOf(T('style', 'hi')) - possOf(T('style', 'lo')), 5, 100, 1);
    const longR = (ms: MatchOut[]) => ratio(sum(ms.map((m) => m.team[0].longPasses)), sum(ms.map((m) => m.team[0].passes))) * 100;
    add(S, 'tBuildLong', '빌드업 짧게: 롱패스 비율 변화 %p', '−5 이하', longR(T('style', 'hi')) - longR(T('style', 'lo')), -100, -5, 1);
    add(S, 'tWidthCross', '폭 넓게: 크로스 변화 %', '+25 이상', chg(team(T('width', 'lo'), 0, (s) => s.crosses), team(T('width', 'hi'), 0, (s) => s.crosses)), 25, 1000, 0);
    const central = (ms: MatchOut[]) => ratio(sum(ms.map((m) => m.team[0].centralShots)), sum(ms.map((m) => m.team[0].shots))) * 100;
    add(S, 'tWidthCentral', '폭 넓게: 중앙 슈팅 비율 변화 %p', '감소', central(T('width', 'hi')) - central(T('width', 'lo')), -100, -0.01, 1);
    const gd = (ms: MatchOut[]) => avg(ms.map((m) => m.homeGoals - m.awayGoals));
    extra.push(`전술 반응 득실차 (홈): ${TACTIC_PAIRS.map(([d]) => `${d} 낮음 ${gd(T(d, 'lo')).toFixed(2)} / 높음 ${gd(T(d, 'hi')).toFixed(2)}`).join(' · ')}`);
  }

  // 실제 선수 시즌 (E.20 5번, 3시즌 평균)
  const lg = [...res.keys()].filter((k) => k.startsWith('league:')).map((k) => res.get(k) as LeagueMatchOut[]);
  if (lg.length) {
    const S = `실제 선수 시즌 (실제 로스터 20팀 전 경기 엔진, ${lg.length}시즌 평균)`;
    const per = lg.map((ms) => {
      const t = new Map<string, { gf: number; ga: number; pts: number }>();
      const row = (id: string) => t.get(id) ?? (t.set(id, { gf: 0, ga: 0, pts: 0 }), t.get(id)!);
      const sc = new Map<string, number>();
      for (const m of ms) {
        const h = row(m.home);
        const a = row(m.away);
        h.gf += m.homeGoals; h.ga += m.awayGoals; a.gf += m.awayGoals; a.ga += m.homeGoals;
        h.pts += m.homeGoals > m.awayGoals ? 3 : m.homeGoals === m.awayGoals ? 1 : 0;
        a.pts += m.awayGoals > m.homeGoals ? 3 : m.homeGoals === m.awayGoals ? 1 : 0;
        for (const [id, g] of Object.entries(m.scorers)) sc.set(id, (sc.get(id) ?? 0) + g);
      }
      const rows = [...t.entries()];
      const top = rows.reduce((x, y) => (y[1].gf > x[1].gf ? y : x));
      const leak = rows.reduce((x, y) => (y[1].ga > x[1].ga ? y : x));
      const champ = rows.reduce((x, y) => (y[1].pts > x[1].pts || (y[1].pts === x[1].pts && y[1].gf - y[1].ga > x[1].gf - x[1].ga) ? y : x));
      const boot = [...sc.entries()].reduce((x, y) => (y[1] > x[1] ? y : x), ['', 0] as [string, number]);
      const goals = rows.reduce((t2, r) => t2 + r[1].gf, 0) / ms.length / 2;
      return { top, leak, champ, boot, goals, kane: sc.get('kane') ?? 0 };
    });
    const m = (f: (x: (typeof per)[number]) => number) => avg(per.map(f));
    add(S, 'lgTopGF', '최다 득점 팀 골', '85~105', m((x) => x.top[1].gf), 85, 105, 0, { note: per.map((x) => `${x.top[0]} ${x.top[1].gf}`).join(', ') });
    add(S, 'lgTopGA', '최다 실점 팀 실점', '60~85', m((x) => x.leak[1].ga), 60, 85, 0, { note: per.map((x) => `${x.leak[0]} ${x.leak[1].ga}`).join(', ') });
    add(S, 'lgBoot', '득점왕 골', '22~38', m((x) => x.boot[1]), 22, 38, 0, { note: per.map((x) => `${x.boot[0]} ${x.boot[1]}`).join(', ') });
    add(S, 'lgChamp', '우승팀 승점', '85~100', m((x) => x.champ[1].pts), 85, 100, 0, { note: per.map((x) => `${x.champ[0]} ${x.champ[1].pts}`).join(', ') });
    // C.17: 실제 플레이에서 확인된 케인 시즌 50~60골 (45골 이상이면 멈춤 조건)
    add(S, 'lgKane', '케인 시즌 골', '득점왕 범위 22~38 (45 이상 멈춤)', m((x) => x.kane), 10, 38, 0, { note: per.map((x) => `${x.kane}`).join(', ') });
    add(S, 'lgGoals', '리그 경기당 팀 득점 (참고)', '약 1.4', m((x) => x.goals), 1.2, 1.6, 2);
  }

  const responses = eq.length ? analyzeResponses(res, eq) : [];
  return { mode, rows, responses, matches: nMatches, seconds, msPerMatch, extra };
}

/**
 * 스탯 반응 기준의 실효 환산 (C.17 결정 1): 엔진은 모든 능력치에 S자 곡선(E.20 11번)을 쓰므로 +10 이 실제로는 그보다 작다.
 * 반응 표본과 같은 팀·슬롯 선수의 바꾼 능력치마다 (곡선(능력치 + 10) − 곡선(능력치)) / 10 을 평균한 비율을 기준값에 곱한다
 */
function effectiveRatio(r: ResponseDef, n: number): number {
  let tot = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    for (const side of ['a', 'b']) {
      const t = std(side, i);
      const roster = createTeamRoster({ id: t.id, rating: t.rating }, t.seed, 2018, []);
      roster.formation = '4-4-2';
      const p = teamSetupFromRoster(roster, rosterRating(roster), 75, `w${1000 + i}`).lineup.find((x) => x.slot === r.slot);
      if (!p) continue;
      for (const k of r.attrs) {
        const v = k.startsWith('gk.') ? p.gk?.attrs[k.slice(3) as keyof GkAttributes] : p.attrs[k as FieldAttribute];
        if (v === undefined) continue;
        tot += (curveAttr(Math.min(99, v + 10)) - curveAttr(v)) / 10;
        cnt++;
      }
    }
  }
  return cnt ? tot / cnt : 1;
}

function analyzeResponses(res: Map<string, JobOut[]>, eqAll: MatchOut[]): ResponseRow[] {
  const out: ResponseRow[] = [];
  for (const r of RESPONSES) {
    const mod = res.get(`resp:${r.key}`) as MatchOut[] | undefined;
    if (!mod?.length) continue;
    const eq = eqAll.slice(0, mod.length);
    const eff = effectiveRatio(r, Math.min(mod.length, 100));
    const B = tracked(eq, r.slot);
    const X = tracked(mod, r.slot);
    const push = (metric: string, criterion0: string, f: (ps: CompactPlayer[], ms: MatchOut[]) => number, unit: ResponseRow['unit'], need0: number, guard?: number) => {
      const scaled = Math.abs(need0) >= 0.001;
      const need = scaled ? need0 * eff : need0;
      const criterion = scaled ? `${criterion0} (실효 ×${eff.toFixed(2)} → ${need >= 0 ? '+' : ''}${need.toFixed(1)}${unit})` : criterion0;
      const diff = (b: number, m: number) => (unit === '%' ? (m / Math.max(1e-9, b) - 1) * 100 : m - b);
      const base = f(B, eq);
      const m = f(X, mod);
      const change = diff(base, m);
      const bound = bootBound(eq.length, (idx) => {
        const e = idx.map((i) => eq[i]!);
        const x = idx.map((i) => mod[i]!);
        return diff(f(tracked(e, r.slot), e), f(tracked(x, r.slot), x));
      }, need >= 0);
      const dirNeed = Math.abs(need) < 0.001 ? 0 : need;
      out.push({
        key: r.key, attrs: r.label, target: r.target, metric, criterion, base, mod: m, change, unit,
        pass: respPass(change, need, bound), need: dirNeed, bound, ...(guard !== undefined ? { guard } : {}),
      });
    };
    const rate = (a: (p: CompactPlayer) => number, b: (p: CompactPlayer) => number, k = 100) => (ps: CompactPlayer[]) => (ratio(sum(ps.map(a)), sum(ps.map(b))) * k);
    const perP = (a: (p: CompactPlayer) => number) => (ps: CompactPlayer[]) => avg(ps.map(a));
    switch (r.key) {
      case 'st_shoot':
        push('유효 슈팅률 %', '+4%p 이상', rate((p) => p.shotsOnTarget, (p) => p.shots), '%p', 4);
        push('경기당 득점', '+12% 이상', perP((p) => p.goals), '%', 12, 5);
        break;
      case 'cm_pass':
        push('패스 성공률 %', '+2%p 이상', rate((p) => p.passesCompleted, (p) => p.passes), '%p', 2, 0);
        push('경기당 키패스', '+12% 이상', perP((p) => p.keyPasses), '%', 12);
        break;
      case 'wing_drib':
        push('드리블 성공률 %', '+5%p 이상', rate((p) => p.dribblesWon, (p) => p.dribbles), '%p', 5);
        break;
      case 'pace':
        push('경기당 침투 패스 수신', '+10% 이상 (또는 드리블 +3%p)', perP((p) => p.throughReceived), '%', 10);
        push('드리블 성공률 %', '+3%p 이상 (또는 침투 +10%)', rate((p) => p.dribblesWon, (p) => p.dribbles), '%p', 3);
        break;
      case 'cb_def':
        push('태클 성공률 % (이긴 태클 / (태클 + 돌파 허용))', '+5%p 이상', rate((p) => p.tacklesWon, (p) => p.tackles + p.dribbledPast), '%p', 5, 0);
        push('맡은 상대 드리블 성공률 %', '하락', rate((p) => p.dribbledPast, (p) => p.dribblesFaced), '%p', -0.0001);
        break;
      case 'aerial':
        push('공중볼 승률 %', '+6%p 이상', rate((p) => p.aerialsWon, (p) => p.aerialDuels), '%p', 6);
        break;
      case 'cross':
        push('크로스 성공률 %', '+3%p 이상', rate((p) => p.crossesCompleted, (p) => p.crosses), '%p', 3);
        break;
      case 'stamina': {
        // 75분 전후 초당 이동 거리 (추가시간 포함 실제 경과 시간 기준)
        const decline = (_: CompactPlayer[], ms: MatchOut[]) => {
          let early = 0, late = 0, te = 0, tl = 0;
          for (const m of ms) {
            for (const p of m.players) {
              if (!p.starter || p.slot !== r.slot || p.offMinute !== null) continue;
              early += p.distance75;
              late += p.distance - p.distance75;
              te += m.elapsed75;
              tl += m.duration - m.elapsed75;
            }
          }
          return (1 - late / Math.max(1, tl) / Math.max(1e-9, early / Math.max(1, te))) * 100;
        };
        push('75분 이후 분당 이동 거리 감소폭 %', '축소', decline, '%p', -0.0001);
        push('교체 아웃 평균 분 (끝까지 뛰면 95)', '지연', perP((p) => p.offMinute ?? 95), '분', 0.0001);
        break;
      }
      case 'gk': {
        const save = (_: CompactPlayer[], ms: MatchOut[]) => ratio(sum(ms.flatMap((m) => [m.team[0].saves, m.team[1].saves])), sum(ms.flatMap((m) => [m.team[1].shotsOnTarget, m.team[0].shotsOnTarget]))) * 100;
        push('선방률 %', '+3%p 이상', save, '%p', 3);
        break;
      }
    }
  }
  // 속도·가속은 두 지표 중 하나만 통과하면 된다 (E.15.1 "또는")
  const pace = out.filter((x) => x.key === 'pace');
  if (pace.some((x) => x.pass)) for (const x of pace) x.pass = true;
  const b = res.get('ovr5:base') as MatchOut[] | undefined;
  const m = res.get('ovr5:mod') as MatchOut[] | undefined;
  if (b?.length && m?.length) {
    const pick = (ms: MatchOut[], ids: number[]) => ids.flatMap((i) => ms[i]!.players.filter((p) => p.team === 0 && p.starter && p.slot === GROUP_SLOT[GROUPS[i % 8]!][1]).map((p) => p.rating));
    const all = b.map((_, i) => i);
    const base = avg(pick(b, all));
    const mod = avg(pick(m, all));
    const bound = bootBound(b.length, (idx) => avg(pick(m, idx)) - avg(pick(b, idx)), true);
    out.push({ key: 'ovr5', attrs: '전체 OVR +5', target: '내 선수 (포지션 8군)', metric: '평균 평점', criterion: '+0.15 이상', base, mod, change: mod - base, unit: '', pass: respPass(mod - base, 0.15, bound), need: 0.15, bound });
  }
  return out;
}

/** 경량 가드 판정: 지표는 guard 범위, 스탯 반응은 guard 기준 */
export function guardFailures(r: SuiteResult): string[] {
  const fails: string[] = [];
  for (const row of r.rows) {
    if (!row.guard) continue;
    const [lo, hi] = row.guard;
    if (!(row.value >= lo && row.value <= hi)) fails.push(`${row.label} ${row.value.toFixed(row.digits)} (가드 ${lo}~${hi})`);
  }
  for (const x of r.responses) {
    if (x.guard === undefined) continue;
    if (!(x.change >= x.guard)) fails.push(`스탯 반응 ${x.target} ${x.metric} 변화 ${x.change.toFixed(2)} (가드 ${x.guard} 이상)`);
  }
  return fails;
}

export const rowPass = (row: Row) => row.pass ?? (row.value >= row.lo && row.value <= row.hi);

export function slotsOf(f: Formation) {
  return FORMATION_SLOTS[f];
}
