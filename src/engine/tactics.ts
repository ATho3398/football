// 전술 시스템 엔진 층 (E.19, E.18 A8): 전술 성향 6종, 세부 전술 4개(3단계), 슬롯별 역할, AI 팀 전술과 경기 중 조정.
// 전술은 선수의 움직임과 판단 방식만 바꾼다. 결과는 능력치와 위치에서 나온다 (E.15.1). 시너지·상성 보너스 표는 없다.

import type { FieldAttributes } from '../attributes';
import { FORMATION_SLOTS, FORMATIONS, type Formation } from '../formations';
import { createRng, hashSeed } from '../rng';
import type { Position } from '../types';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as pitch_ from './pitch';
const { clamp } = pitch_;
import { type Role } from './roles';
import * as roles_ from './roles';
const { defaultRole, ROLE_KEYS, ROLE_OPTIONS, ROLES } = roles_;
import type { SimState } from './state';
import { TEAM_STYLE, TEAM_TACTICS } from './teamData';
import type { Tactics, Tendency } from './types';

export const TENDENCIES: readonly Tendency[] = ['balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'bus'];

export const TENDENCY_NAMES_KO: Record<Tendency, string> = {
  balanced: '균형', tikitaka: '티키타카', gegenpress: '게겐프레싱', counter: '역습', direct: '직선(롱볼)', block: '수비 블록', bus: '버스 세우기',
};

/** 성향 한 줄 설명 (전술 화면·하프타임 안내용, C.76k) */
export const TENDENCY_DESC_KO: Record<Tendency, string> = {
  balanced: '라인·압박·빌드업·폭 모두 보통',
  tikitaka: '높은 라인에서 짧은 패스로 돌리다 확실한 기회만 쏜다',
  gegenpress: '공을 잃으면 바로 되찾는 전방 압박',
  counter: '낮게 서서 뺏자마자 빠르게 앞으로',
  direct: '타깃 ST 에게 롱볼, 세컨드볼과 크로스',
  block: '박스 경계까지 내려서 두 줄 간격 12 m 블록',
  bus: '라인을 박스 앞까지 내리고 두 줄로 버틴다',
};

/** 세부 전술 단계 값 (E.19 ③). 라인은 4단(C.76k '매우 낮음' = 박스 앞 20 m), 나머지는 3단. 빌드업은 짧게 / 혼합 / 직선 순 */
export const LEVELS = {
  lineHeight: [0.2, 0.35, 0.5, 0.65],
  pressing: [0.3, 0.55, 0.8],
  style: [0.85, 0.5, 0.2],
  width: [0.85, 1.0, 1.15],
} as const;
export type Detail = keyof typeof LEVELS;
export const DETAILS: readonly Detail[] = ['lineHeight', 'pressing', 'style', 'width'];
export const DETAIL_NAMES_KO: Record<Detail, string> = { lineHeight: '수비 라인', pressing: '압박', style: '빌드업', width: '공격 폭' };
/** 단계 이름 (I.16 세그먼트): 빌드업은 짧게 / 혼합 / 직선, 폭은 좁게 / 보통 / 넓게 */
export const LEVEL_NAMES_KO: Record<Detail, readonly string[]> = {
  lineHeight: ['매우 낮음', '낮음', '보통', '높음'], pressing: ['낮음', '보통', '높음'], style: ['짧게', '혼합', '직선'], width: ['좁게', '보통', '넓게'],
};
/** 0 낮음(빌드업 짧게, 폭 좁게) / 1 보통 / 2 높음(빌드업 직선, 폭 넓게). 라인만 0 매우 낮음 / 1 낮음 / 2 보통 / 3 높음 (C.76k) */
export type Level = 0 | 1 | 2 | 3;
/** 세부 전술의 마지막 단계 번호 (라인 3, 나머지 2) */
export function levelMax(detail: Detail): Level {
  return (LEVELS[detail].length - 1) as Level;
}
/** 단계 번호가 그 세부 전술에 있는가 (세이브 검사용) */
export function validLevel(detail: Detail, v: unknown): v is Level {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) < LEVELS[detail].length;
}

/** 성향별 세부 전술 기본값 [라인, 압박, 빌드업, 폭] (E.19 ①). 라인은 4단이라 보통 = 2 */
const TENDENCY_LEVELS: Record<Tendency, [Level, Level, Level, Level]> = {
  balanced: [2, 1, 1, 1],
  tikitaka: [3, 2, 0, 2],
  gegenpress: [3, 2, 1, 1],
  counter: [1, 0, 2, 1],
  direct: [2, 1, 2, 2],
  block: [1, 0, 2, 0],
  bus: [0, 0, 2, 0],
};

/** 성향의 세부 전술 기본 단계 (E.19 ①) */
export function tendencyLevels(tendency: Tendency): Record<Detail, Level> {
  const [lineHeight, pressing, style, width] = TENDENCY_LEVELS[tendency];
  return { lineHeight, pressing, style, width };
}

export function tacticsOf(tendency: Tendency, levels?: Partial<Record<Detail, Level>>): Tactics {
  const [l, p, b, w] = TENDENCY_LEVELS[tendency];
  const lv = { lineHeight: l, pressing: p, style: b, width: w, ...levels };
  // 3단 세부 전술에 단계 3 이 오면 마지막 단계로 (라인만 4단, C.76k)
  const at = (d: Detail): number => LEVELS[d][Math.min(lv[d], LEVELS[d].length - 1)]!;
  return {
    tendency,
    lineHeight: at('lineHeight'),
    pressing: at('pressing'),
    style: at('style'),
    width: at('width'),
  };
}

/** 값에 가장 가까운 단계 */
export function levelOf(detail: Detail, v: number): Level {
  const xs = LEVELS[detail];
  let best: Level = 0;
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i]! - v) < Math.abs(xs[best]! - v)) best = i as Level;
  return best;
}

// ── 역할 ──

/** 성향별 추천 역할 (E.19 ②, E3.7 새 이름). 포지션군마다 후보, 여럿이면 능력치 적합도가 높은 쪽 */
const RECOMMENDED: Partial<Record<Tendency, Partial<Record<string, string[]>>>> = {
  tikitaka: { CB: ['ballPlayingCB'], FB: ['invertedFullback'], CDM: ['halfBack', 'regista'], CM: ['deepPlaymaker', 'boxToBox'], WING: ['wingForward'], ST: ['falseNine'] },
  gegenpress: { CDM: ['ballWinner'], CM: ['boxToBox'], FB: ['attackingFullback'], ST: ['advancedForward'] },
  counter: { CB: ['coverCB'], CDM: ['anchor'], WING: ['wingForward'], ST: ['advancedForward'] },
  direct: { CB: ['stopper'], FB: ['attackingFullback'], WING: ['classicWinger'], ST: ['targetMan'] },
  block: { CB: ['stopper', 'coverCB'], FB: ['defensiveFullback'], CDM: ['anchor'], CM: ['holdingCM'], ST: ['targetMan'] },
  bus: { CB: ['stopper', 'coverCB'], FB: ['defensiveFullback'], CDM: ['anchor'], CM: ['holdingCM'], ST: ['targetMan'] },
};

/** 포지션별로 고를 수 있는 역할 (E.6 역할 표) */
export { ROLE_OPTIONS };

export function roleGroup(pos: Position): string {
  switch (pos) {
    case 'GK': return 'GK';
    case 'CB': return 'CB';
    case 'LB': case 'RB': case 'LWB': case 'RWB': return 'FB';
    case 'CDM': return 'CDM';
    case 'CM': return 'CM';
    case 'CAM': return 'CAM';
    case 'LW': case 'RW': case 'LM': case 'RM': return 'WING';
    case 'ST': case 'CF': return 'ST';
  }
}

/** 역할 적합도 (18.1, 안내와 기본값 채우기용): 역할 적합도 능력치 평균 (E.6 표) */
export function roleFit(roleId: string, a: FieldAttributes): number {
  const keys = ROLE_KEYS[roleId];
  if (!keys) return 0;
  return keys.reduce((t, k) => t + a[k], 0) / keys.length;
}

/** 팀에 한 명만 두는 추천 역할 (내려와서 연결하는 ST): 투톱 둘 다 내려오면 박스에 아무도 없다 (부록 C.32) */
export const SOLO_ROLES: ReadonlySet<string> = new Set(['falseNine']);

/**
 * 슬롯 기본 역할: 성향 추천 역할 중 능력치 적합도가 높은 것, 추천이 없으면 능력치로 (E.19 ②).
 * taken 에 이미 팀에 배정된 역할을 주면 SOLO_ROLES 는 두 번째 슬롯부터 능력치 기본 역할로 바꾼다
 */
export function recommendedRole(tendency: Tendency, pos: Position, attrs: FieldAttributes, taken?: ReadonlySet<string>): Role {
  if (pos === 'GK') return ROLES.goalkeeper!;
  const cands = RECOMMENDED[tendency]?.[roleGroup(pos)];
  if (!cands?.length) return defaultRole(pos, attrs);
  const best = cands.slice().sort((x, y) => roleFit(y, attrs) - roleFit(x, attrs))[0]!;
  if (taken?.has(best) && SOLO_ROLES.has(best)) {
    const alt = defaultRole(pos, attrs);
    return alt.id === best ? ROLES.poacher! : alt;
  }
  return ROLES[best]!;
}

// ── AI 팀 전술 ──

export interface TeamPlan {
  tendency: Tendency;
  formation: Formation;
  tactics: Tactics;
}

/**
 * 팀 데이터 전술 (E.19 AI 팀 전술): 실제 팀은 데이터의 성향·포메이션, 빌드업은 E.18 A5 연속 값.
 * 데이터가 없는 팀은 시드로 성향을 고른다 (레이팅이 리그 평균 +3 이상 / −3 이하 / 그 사이). 포메이션은 로스터 값
 */
export function teamPlan(teamId: string, rating: number, formation: Formation, worldSeed = '', leagueAvg: number = ENGINE.tactics.leagueAvg): TeamPlan {
  const T = ENGINE.tactics;
  const data = TEAM_TACTICS[teamId];
  let tendency: Tendency;
  if (data) tendency = data.tendency;
  else {
    const rng = createRng(hashSeed(`${worldSeed}:tendency:${teamId}`));
    const pool: readonly Tendency[] = rating >= leagueAvg + 3 ? ['tikitaka', 'gegenpress', 'balanced']
      : rating <= leagueAvg - 3 ? ['block', 'direct', 'counter'] : TENDENCIES;
    tendency = pool[Math.floor(rng() * pool.length)]!;
  }
  const style = TEAM_STYLE[teamId] ?? clamp(0.5 + T.stylePerRating * (rating - leagueAvg), T.styleMin, T.styleMax);
  return { tendency, formation: data?.formation ?? formation, tactics: { ...tacticsOf(tendency), style } };
}

/** 성향 고유 행동의 수치 (E.19 ①, 세부 전술로 표현되지 않는 부분). 배수는 E.20 4번에서 축소 (1.15 → 1.08, 1.2 → 1.1, 1.25 → 1.12, 역압박 +1초, 가담 최대 3명) */
export const TENDENCY = {
  /** 티키타카: 지원 간격 (m), xG 0.05 미만 슛 효용 배수 */
  tikiSupport: [10, 18] as [number, number],
  tikiLowXg: 0.05,
  tikiLowShot: 0.7,
  /** 게겐프레싱: 역압박 +초, 최대 인원, 탈취 후 전진 패스·슛 효용 배수와 시간 */
  gegenExtra: 1,
  gegenMax: 3,
  gegenWinMul: 1.08,
  gegenWinTime: 4,
  /** 게겐프레싱 팀 전원 스태미나 소모 배수 (C.77a 가설 1, 44h-h: 압박 높음 배수와 곱해짐 — 많이 뛰는 대가가 후반에 오게) */
  gegenDrain: 1.15,
  /** 역습: 탈취 후 전진·침투 패스 효용 배수와 시간, 수비 시 남는 최전방 x (정규화) */
  counterWinMul: 1.12,
  counterWinTime: 6,
  counterStayX: 0.48,
  /** 직선: 타깃 ST 롱볼 효용 배수, 크로스 효용 배수, 세컨드볼 위치 (착지점 뒤 m) */
  directTargetMul: 1.1,
  directCrossMul: 1.08,
  directSecond: [10, 15] as [number, number],
  /** 수비 블록: 수비-중원 간격 상한 (m), 수비 라인 상한 (박스 경계, m) */
  blockGap: 12,
  blockLineMax: 16.5,
  /** 버스 세우기 (C.76k, 사용자 확정 ③): 수비 라인 상한 14 m(박스 앞), 수비-중원 간격 상한 8 m(두 줄), 최전방 1명은 역습 출구로 하프라인 부근(counterStayX) */
  busGap: 8,
  busLineMax: 14,
  busStay: 1,
  /** 깊은 블록 밀집 (C.78d ①, ENGINE.offball.compact): 수비·중원 줄 가로 폭 배수 (슬롯 간격 × 이 값) */
  compactW: { bus: 0.5, block: 0.55, counter: 0.65 } as Partial<Record<Tendency, number>>,
  /** 탈취 뒤 역습 지원 인원 (C.78d ②, ENGINE.offball.supportRun): 버스 1 · 블록 1 · 역습 2 */
  supportRunners: { bus: 1, block: 1, counter: 2 } as Partial<Record<Tendency, number>>,
};

/** 공격 폭 → 측면 선수 크로스 효용 배수 (좁게 0.9 / 보통 1.0 / 넓게 1.1) */
export function widthCrossMul(width: number): number {
  return 1 + (width - 1) * (0.1 / 0.15);
}

/**
 * 경기 중 AI 조정 (E.19): 70분 이후 1골 차로 지고 있으면 라인과 압박을 한 단계 올리고, 1골 차로 이기고 있으면 라인을 한 단계 내린다.
 * 2골 이상 차이는 시간과 관계없이 라인·압박 한 단계 (앞서면 아래, 뒤지면 위, C.29 fix2).
 * 뒤질 때 올리기는 상대가 underdogGap 이상 강하면 하지 않는다 (C.76k 사용자 확정 ②: 약팀은 강팀에게 지고 있어도 내려앉은 채로. 강팀이 약팀에게 질 때·비등할 때만 올린다).
 * 모든 팀에 같은 규칙 (직접 모드의 내 팀은 E4 이후 사용자가 바꾼다)
 */
export function aiAdjust(s: SimState): void {
  if (s.tick % 600 !== 0) return;
  const big = ENGINE.tactics.leadAdjustGoals;
  for (const team of [0, 1] as const) {
    const T = s.teams[team];
    if (s.input.mode === 'live' && s.input.myTeam === team) continue;
    const opp = s.teams[team === 0 ? 1 : 0];
    const base = T.setup.tactics;
    const diff = T.stats.goals - opp.stats.goals;
    const underdog = opp.setup.rating - T.setup.rating >= ENGINE.tactics.underdogGap;
    const step = (d: Detail, by: number) => LEVELS[d][clamp(levelOf(d, base[d]) + by, 0, levelMax(d))]!;
    T.tactics = { ...base };
    // 점수 차 (C.29 fix2): 2골 이상이면 시간과 관계없이 라인·압박 한 단계 (앞서면 아래, 뒤지면 위 — 약팀은 위로 안 올림)
    if (diff >= big || (diff <= -big && !underdog)) {
      const by = diff > 0 ? -1 : 1;
      T.tactics.lineHeight = step('lineHeight', by);
      T.tactics.pressing = step('pressing', by);
    } else if (s.t < 70 * 60) continue;
    else if (diff === -1 && !underdog) {
      T.tactics.lineHeight = step('lineHeight', 1);
      T.tactics.pressing = step('pressing', 1);
    } else if (diff === 1) T.tactics.lineHeight = step('lineHeight', -1);
  }
}

export function formationSlots(f: Formation) {
  return FORMATION_SLOTS[f];
}

export { FORMATIONS };
