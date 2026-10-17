// 포지션 적성 (pending 31·36, 부록 C.37): 숨은 재능 타입, 포지션군 숙련도 상승 배수(플레이어에게 안 보임),
// 가상 유망주 시작 후보 4자리(상위 3 + 와일드카드 1, 코치 한 줄 평), 2시즌 부진 포변 조언과 조언 뒤 포변 보너스

import { FIELD_ATTRIBUTES, type FieldAttributes } from './attributes';
import { BALANCE } from './config/balance';
import {
  ADVICE_TEXT, APT_GROUP_POSITIONS, APT_GROUPS, COACH_LINES, TALENT_TYPES, type AptGroup, type TalentType,
} from './config/aptitude';
import { attributeOvrWeight, POSITION_NAMES_KO, positionOvrExact, type FieldPosition, type PlayablePosition } from './positions';
import { proficientOvr } from './proficiency';
import { generateProspectAttributes, rollPotentialTier, rollStartOvr } from './prospect';
import { createRng, hashSeed, type Rng } from './rng';
import type { PlayerState, Position, Tier } from './types';

export type { AptGroup } from './config/aptitude';

const A = BALANCE.aptitude;

/** 숨은 적성: 재능 타입, 포지션군별 숙련도 상승 배수, 엇갈린 숨은 재능 자리 */
export interface Aptitude {
  talent: string;
  mult: Record<AptGroup, number>;
  hidden: AptGroup | null;
}

/** 포변 조언 (pending 31 3번): 시즌 종료에 생기고, 다음 시즌 untilRound 라운드 전까지 살아 있다 */
export interface PositionAdvice {
  kind: 'coach' | 'news';
  group: AptGroup;
  /** 권하는 포지션 (그 포지션군에서 지금 OVR 이 가장 높은 자리) */
  pos: PlayablePosition;
  /** 조언 때 주 포지션 */
  from: FieldPosition;
  /** 조언이 나온 시즌 */
  season: number;
  untilSeason: number;
  /** untilSeason 시즌에 이 라운드 수만큼 치르기 전까지 */
  untilRound: number;
  /** 홈 알림 카드를 닫았는지 (조언 기간은 그대로) */
  dismissed?: boolean;
}

/** 조언 뒤 포변 보너스: 그 포지션군으로 뛴 남은 경기 수 */
export interface AptBoost {
  group: AptGroup;
  games: number;
}

const rngFor = (seed: string, ...parts: (string | number)[]): Rng => createRng(hashSeed([seed, ...parts].join(':')));
const range = (rng: Rng, r: { min: number; max: number }) => Math.round((r.min + rng() * (r.max - r.min)) * 100) / 100;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

/** 포지션 → 적성 포지션군 (LWB/RWB 는 풀백, GK 는 없음) */
export function aptGroupOf(pos: Position): AptGroup | null {
  if (pos === 'GK') return null;
  if (pos === 'LWB' || pos === 'RWB') return 'fullback';
  for (const g of APT_GROUPS) if ((APT_GROUP_POSITIONS[g] as readonly string[]).includes(pos)) return g;
  return null;
}

export function talentById(id: string): TalentType | undefined {
  return TALENT_TYPES.find((t) => t.id === id);
}

/** 가상 유망주 적성 (pending 36 ③): 맞는 군 1.2~1.5, 30% 확률로 엇갈린 숨은 재능 1.4~1.6, 나머지 0.7~1.0 */
export function rollAptitude(talent: TalentType, rng: Rng): Aptitude {
  const others = APT_GROUPS.filter((g) => !talent.groups.includes(g));
  const hidden = rng() < A.hiddenChance ? pick(rng, others) : null;
  const mult = {} as Record<AptGroup, number>;
  for (const g of APT_GROUPS) {
    mult[g] = range(rng, talent.groups.includes(g) ? A.matched : g === hidden ? A.hidden : A.other);
  }
  return { talent: talent.id, mult, hidden };
}

/** 능력치에서 재능 타입 추정 (실제 선수·옛 세이브, pending 36 ⑤): 타입 능력치 평균이 가장 높은 타입 */
export function estimateTalent(attrs: FieldAttributes): TalentType {
  let best = TALENT_TYPES[0]!;
  let bestScore = -Infinity;
  for (const t of TALENT_TYPES) {
    const score = t.attrs.reduce((s, a) => s + attrs[a], 0) / t.attrs.length;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/** 실제 선수·옛 세이브 적성 (pending 36 ④⑤): 주 포지션군 1.2~1.4, 나머지 0.7~1.0, 엇갈림 없음 */
export function mainPositionAptitude(main: FieldPosition, attrs: FieldAttributes, rng: Rng): Aptitude {
  const mg = aptGroupOf(main);
  const mult = {} as Record<AptGroup, number>;
  for (const g of APT_GROUPS) mult[g] = range(rng, g === mg ? A.realMain : A.other);
  return { talent: estimateTalent(attrs).id, mult, hidden: null };
}

export function aptitudeSeed(worldSeed: string): Rng {
  return rngFor(worldSeed, 'aptitude');
}

/** 숙련도 상승 배수 (D.3 상승량에 곱한다). 적성이 없으면(NPC·테스트 선수) 1 */
export function aptitudeMult(p: { aptitude?: Aptitude }, pos: Position): number {
  const g = aptGroupOf(pos);
  if (!g || !p.aptitude) return 1;
  return p.aptitude.mult[g] ?? 1;
}

// ── 가상 유망주 생성과 시작 후보 ──

export interface StartCandidate {
  pos: PlayablePosition;
  group: AptGroup;
  ovr: number;
  /** top = 적합도 1위, good = 2~3위, wild = 와일드카드 */
  kind: 'top' | 'good' | 'wild';
  line: string;
}

export interface ProspectRoll {
  potentialTier: Tier;
  ovr: number;
  talent: TalentType;
  anchor: PlayablePosition;
  attributes: FieldAttributes;
  aptitude: Aptitude;
  candidates: StartCandidate[];
  /** 팀·이름 추첨에 이어 쓰는 난수 */
  rng: Rng;
}

/**
 * 가상 유망주 (B.2 + pending 31): 잠재력 → 시작 OVR → 재능 타입·기준 자리 → 능력치(기준 자리 OVR = 시작 OVR, 타입 능력치 기울기)
 * → 숨은 적성 → 시작 후보. anchor 를 주면 그 자리를 기준으로 맞는 재능 타입을 뽑는다 (밸런스·테스트: 포지션을 정해 시작)
 */
export function rollProspect(worldSeed: string, anchor?: PlayablePosition): ProspectRoll {
  const rng = rngFor(worldSeed, 'new-player');
  const potentialTier = rollPotentialTier(rng);
  const ovr = rollStartOvr(rng);
  const fits = anchor ? TALENT_TYPES.filter((t) => t.anchors.includes(anchor)) : TALENT_TYPES;
  const talent = pick(rng, fits.length ? fits : TALENT_TYPES);
  const base = anchor ?? pick(rng, talent.anchors);
  const attributes = generateProspectAttributes(base, ovr, rng);
  // 기울기는 기준 자리 OVR 에 안 들어가는 타입 능력치에만 (기준 자리 능력치는 재능 타입에 맞춰 이미 높다).
  // 기준 자리 OVR 이 그대로라 능력치를 깎아 맞출 일이 없고 성장 곡선이 C.36 과 같다 (C.37 측정: 깎아 맞추면 성장이 +0.8 OVR 빨라짐)
  for (const a of talent.attrs) if (attributeOvrWeight(base, a) === 0) attributes[a] = Math.min(85, attributes[a] + A.talentBoost);
  const aptitude = rollAptitude(talent, rngFor(worldSeed, 'aptitude'));
  const candidates = startCandidates(attributes, aptitude, rngFor(worldSeed, 'start-candidates'));
  return { potentialTier, ovr, talent, anchor: base, attributes, aptitude, candidates, rng };
}

/** 포지션군마다 가장 맞는 자리와 그 OVR (좌우 대칭 자리는 난수로) — 적합도 순 */
export function groupFits(attrs: FieldAttributes, rng: Rng): { group: AptGroup; pos: PlayablePosition; exact: number }[] {
  return APT_GROUPS.map((group) => {
    let best: PlayablePosition = APT_GROUP_POSITIONS[group][0]!;
    let bestV = -Infinity;
    for (const pos of APT_GROUP_POSITIONS[group]) {
      const v = positionOvrExact(attrs, pos);
      if (v > bestV + 1e-9 || (Math.abs(v - bestV) <= 1e-9 && rng() < 0.5)) {
        best = pos;
        bestV = v;
      }
    }
    return { group, pos: best, exact: bestV };
  }).sort((a, b) => b.exact - a.exact);
}

/**
 * 시작 후보 4자리 (pending 31 01:03 개정): 적합도 상위 3 포지션군 + 와일드카드 1.
 * 숨은 재능 자리가 상위 3 밖이면 50% 확률로 와일드카드가 그 자리, 아니면 적합도 4~6위 중 무작위 (숨은 재능 자리는 뺀다)
 */
export function startCandidates(attrs: FieldAttributes, apt: Aptitude, rng: Rng): StartCandidate[] {
  const C = A.candidates;
  const fits = groupFits(attrs, rng);
  const top = fits.slice(0, C.top);
  const rest = fits.slice(C.top);
  let wild = rest.find((f) => f.group === apt.hidden && rng() < C.wildHidden);
  if (!wild) {
    const pool = fits.slice(C.wildRanks[0] - 1, C.wildRanks[1]).filter((f) => f.group !== apt.hidden);
    wild = pool.length ? pick(rng, pool) : rest.find((f) => f.group !== apt.hidden) ?? rest[0]!;
  }
  const out = [...top.map((f, i) => ({ f, kind: (i === 0 ? 'top' : 'good') as StartCandidate['kind'] })), { f: wild, kind: 'wild' as const }];
  return out.map(({ f, kind }) => ({
    pos: f.pos, group: f.group, ovr: Math.round(f.exact), kind, line: coachLine(kind, apt.mult[f.group], f.pos, rng),
  }));
}

/** 코치 한 줄 평: 적성 수치는 숨기고 말투(따뜻/보통/담담)만 다르다 */
export function coachLine(kind: StartCandidate['kind'], mult: number, pos: PlayablePosition, rng: Rng): string {
  const tone = mult >= A.hintHigh ? 'warm' : mult < A.hintLow ? 'plain' : 'mid';
  return pick(rng, COACH_LINES[kind][tone]).replaceAll('{pos}', POSITION_NAMES_KO[pos]);
}

// ── 포변 조언 (pending 31 3번, 36 ①②⑥) ──

/** 지금 조언이 살아 있는지 (시즌·치른 라운드 수 기준) */
export function adviceOpen(p: Pick<PlayerState, 'advice'>, season: number, round: number): boolean {
  const a = p.advice;
  if (!a) return false;
  return season < a.untilSeason || (season === a.untilSeason && round < a.untilRound);
}

/**
 * 시즌 종료 판정: 지금 주 포지션에서 2시즌 연속 시즌 평균 평점 6.2 이하(선발 15경기 이상 = 주전으로 뛴 시즌)이고
 * 적성이 더 높은 포지션군이 있을 때만 조언한다. 처음은 감독 한마디, 그다음부터 뉴스. 시즌 종료마다 한 번만 판정 (= 시즌당 1회).
 * 다음 조언은 지난 조언 뒤 시즌들로만(겹치지 않는 2시즌), 같은 포지션군에서 최대 maxPerPosition 번
 */
export function evaluateAdvice(p: PlayerState, season: number): PositionAdvice | null {
  const D = A.advice;
  if (!p.aptitude) return null;
  const cur = aptGroupOf(p.position);
  if (!cur) return null;
  const log = p.adviceLog ?? [];
  if (log.filter((l) => aptGroupOf(l.from) === cur).length >= D.maxPerPosition) return null;
  const last = log.at(-1)?.season ?? -Infinity;
  const recent = p.history.slice(-D.seasons);
  if (recent.length < D.seasons || recent.some((r) => r.season <= last)) return null;
  const slump = recent.every((r) => r.starts >= D.minStarts && r.ratingSum / r.apps <= D.ratingMax && aptGroupOf(r.position ?? p.position) === cur);
  if (!slump) return null;
  const mine = p.aptitude.mult[cur];
  let group: AptGroup | null = null;
  for (const g of APT_GROUPS) if (g !== cur && p.aptitude.mult[g] > mine && (!group || p.aptitude.mult[g] > p.aptitude.mult[group])) group = g;
  if (!group) return null;
  const pos = [...APT_GROUP_POSITIONS[group]].sort((a, b) => proficientOvr(p, b) - proficientOvr(p, a))[0]!;
  const advice: PositionAdvice = {
    kind: log.length > 0 ? 'news' : 'coach', group, pos, from: p.position, season,
    untilSeason: season + 1, untilRound: D.windowRounds,
  };
  p.adviceLog = [...log, { season, from: p.position }];
  p.advice = advice;
  return advice;
}

/**
 * 경기 전·포지션 변경 뒤: 조언 기간이 지났으면 지우고, 살아 있는 동안 주 포지션이나 이번 경기 자리(전술 "내 위치")가
 * 그 포지션군이면 포변으로 보고 보너스(그 포지션군 10경기 숙련도 상승 ×2)를 건다. 걸었으면 true
 */
export function checkAdviceTaken(p: PlayerState, playPos: FieldPosition, season: number, round: number): boolean {
  const a = p.advice;
  if (!a) return false;
  if (!adviceOpen(p, season, round)) {
    p.advice = null;
    return false;
  }
  if (aptGroupOf(p.position) !== a.group && aptGroupOf(playPos) !== a.group) return false;
  p.aptBoost = { group: a.group, games: A.advice.boostGames };
  p.advice = null;
  return true;
}

/** 출전 한 경기의 숙련도 상승 배수: 적성 × (조언 뒤 포변 보너스면 ×2). 보너스 남은 경기는 여기서 줄인다 */
export function consumeGainMult(p: PlayerState, played: Position): number {
  let mult = aptitudeMult(p, played);
  const b = p.aptBoost;
  if (b && b.games > 0 && aptGroupOf(played) === b.group) {
    mult *= A.advice.boostMult;
    b.games--;
    if (b.games <= 0) p.aptBoost = null;
  }
  return mult;
}

/** 홈 알림 카드 문구 */
export function adviceText(p: PlayerState, a: PositionAdvice, roundsLeft: number): { eyebrow: string; title: string; body: string; window: string } {
  const t = ADVICE_TEXT[a.kind];
  const fill = (s: string) => s.replaceAll('{name}', p.name).replaceAll('{pos}', a.pos).replaceAll('{posKo}', POSITION_NAMES_KO[a.pos]).replaceAll('{cur}', a.from);
  return { eyebrow: t.eyebrow, title: fill(t.title), body: fill(t.body), window: ADVICE_TEXT.window.replaceAll('{n}', String(roundsLeft)) };
}

export function adviceTakenText(pos: string): string {
  return ADVICE_TEXT.taken.replaceAll('{pos}', pos).replaceAll('{n}', String(A.advice.boostGames));
}

/** 재능 타입별 능력치가 실제로 높게 나오는지 확인용 (밸런스 스크립트) */
export function talentAttrMean(attrs: FieldAttributes, t: TalentType): { talent: number; rest: number } {
  const rest = FIELD_ATTRIBUTES.filter((a) => !t.attrs.includes(a));
  return {
    talent: t.attrs.reduce((s, a) => s + attrs[a], 0) / t.attrs.length,
    rest: rest.reduce((s, a) => s + attrs[a], 0) / rest.length,
  };
}
