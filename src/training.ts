// 훈련과 휴가 (25.3, 부록 C.41): 경기가 없는 날 훈련 1개, 기본 주간 계획 + 그날만 바꾸기, 훈련 XP 주간 상한, 기술 훈련 게이지.
// 하루 진행(game.ts dayStep)이 그날 계획(dayPlan)을 적용한다. 수치는 모두 BALANCE.training

import { ATTRIBUTE_GROUPS, ATTRIBUTE_NAMES_KO, GROUP_NAMES, type AttributeGroup, type FieldAttribute } from './attributes';
import { BALANCE } from './config/balance';
import { addDays, weekday, type IsoDate } from './calendar';
import { attributeOvrWeight, type FieldPosition } from './positions';
import type { PlayerState } from './types';
import { costTier, internalCost } from './growth';

const T = BALANCE.training;

export type TrainingKind = keyof typeof BALANCE.training.kinds;
export const TRAINING_KINDS: readonly TrainingKind[] = ['tech', 'weakFoot', 'intense', 'position', 'setpiece', 'video', 'recovery', 'rest'];
/** 하루 계획: 훈련 7종 + 경기 날, 휴가, 재활(부상 중 기본) */
export type DayPlan = TrainingKind | 'match' | 'vacation' | 'rehab';

export const TRAINING_NAMES_KO: Record<DayPlan, string> = {
  tech: '기술 훈련', intense: '고강도 훈련', position: '포지션·역할 훈련', setpiece: '세트피스·카드 훈련', video: '영상 분석',
  recovery: '회복 훈련', rest: '휴식', match: '경기', vacation: '휴가', rehab: '재활', weakFoot: '약발 훈련',
};
/** 달력·주간 계획 칸의 짧은 이름 */
export const TRAINING_SHORT_KO: Record<DayPlan, string> = {
  tech: '기술', intense: '고강도', position: '포지션', setpiece: '세트피스', video: '영상', recovery: '회복', rest: '휴식',
  match: '경기', vacation: '휴가', rehab: '재활', weakFoot: '약발',
};
export const TRAINING_DESC_KO: Record<TrainingKind, string> = {
  tech: '고른 묶음 게이지 +1. 다 차면 그 묶음에서 가장 낮은 능력치가 다음 칸까지 1/5 진행',
  intense: `XP를 더 받지만 부상 확률 하루 +${(T.intenseInjury.chance * 100).toFixed(1)}%`,
  position: `전술 "내 위치" 숙련도 +${T.positionProf}, 역할 시그니처 해금 +${T.roleApps}경기`,
  setpiece: `덱에서 가장 덜 쓴 카드 숙련 +${T.cardMastery}회`,
  video: '다음 경기 상대 힌트 1줄',
  weakFoot: `약발 게이지 +1. ${BALANCE.weakFoot.trainingGauge}칸이 차면 약발 +1 (시즌 최대 +${BALANCE.weakFoot.seasonMax}, 약발 5 = 양발잡이)`,
  recovery: '체력을 많이 회복하고, 연속 휴식 폼 감점을 지워요',
  rest: `체력을 가장 많이 회복해요. 경기 다음 날은 휴식 고정. 부상 중이면 회복 +${T.restHealBonus}일, ${T.restStreak}일 연속이면 폼 −1`,
};

export const BUNDLE_NAMES_KO: Record<AttributeGroup, string> = {
  ballHandling: '볼', finishing: '마무리', passing: '패스', defending: '수비', pace: '스피드', physical: '피지컬', mental: '멘탈',
};

/** 하루 훈련 결과 (화면 알림·측정) */
export interface TrainingDayResult {
  date: IsoDate;
  kind: DayPlan;
  /** 받은 XP (상한·감쇠 뒤, 소수) */
  xp: number;
  /** 피로 회복량 */
  fatigue: number;
  /** 기술 훈련 게이지가 차서 오른 능력치 */
  up?: FieldAttribute;
  bundle?: AttributeGroup;
  /** 약발 훈련으로 약발이 올랐으면 새 약발 (C.45) */
  weakFootUp?: number;
  /** 그 밖의 한 줄 (힌트, 숙련도, 카드) */
  note?: string;
  /** 고강도 훈련 부상 */
  injured?: boolean;
}

/**
 * 훈련 프리셋 (C.52, pending 82 6번, 디자인 159): 한 주의 "자유 훈련일"(경기 날·경기 다음 날 휴식·경기 전날 영상·휴가를 뺀 날)에
 * 날짜 순서대로 slots 를 채운다 (7칸, 자유일이 적으면 앞에서부터). 경기 다음 날 휴식·경기 전날 영상 분석은 프리셋과 상관없이 그대로
 */
export interface TrainingPreset {
  id: string;
  name: string;
  slots: TrainingKind[];
}

export const PRESET_SLOTS = 7;
const fill = (...k: TrainingKind[]): TrainingKind[] => Array.from({ length: PRESET_SLOTS }, (_, i) => k[i % k.length]!);

/** 기본 프리셋 4 (C.52). 균형 = C.44 기본 계획(자유일 모두 기술)과 같다 */
export const BASE_PRESETS: readonly (TrainingPreset & { desc: string })[] = [
  { id: 'balance', name: '균형', desc: '평범한 주 · 기술 훈련 위주', slots: fill('tech') },
  { id: 'recovery', name: '회복 중심', desc: '체력이 낮을 때 · 회복과 기술을 번갈아', slots: fill('recovery', 'tech') },
  { id: 'focus', name: '기술 집중', desc: '경기 한 번 · 체력이 넉넉한 주 · 고강도 1일로 XP 더 (부상 위험 조금)', slots: fill('tech', 'tech', 'intense', 'tech', 'tech', 'tech', 'tech') },
  { id: 'busy', name: '경기 많은 주', desc: '주중 경기가 있을 때 · 회복을 늘림', slots: fill('recovery', 'recovery', 'tech') },
];
export type BasePresetId = 'balance' | 'recovery' | 'focus' | 'busy';

/** 프리셋 찾기 (기본 → 커스텀, 없으면 균형) */
export function presetById(t: Pick<TrainingState, 'customPresets'> | undefined, id: string): TrainingPreset {
  return BASE_PRESETS.find((p) => p.id === id) ?? t?.customPresets?.find((p) => p.id === id) ?? BASE_PRESETS[0]!;
}

/** 프리셋 구성 요약 "기술 4 · 고강도 1" (자유일 n 일 기준) */
export function presetSummary(slots: readonly TrainingKind[], free = 4): string {
  const n = new Map<TrainingKind, number>();
  for (const k of slots.slice(0, free)) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n].map(([k, c]) => `${TRAINING_SHORT_KO[k]} ${c}`).join(' · ');
}

export const PRESET_NAME_MAX = 12;

/** 커스텀 프리셋 만들기 (개수 제한 없음). 새 id 를 돌려준다 */
export function addCustomPreset(t: TrainingState, name: string, slots: readonly TrainingKind[]): string {
  const id = `c${(t.presetSeq = (t.presetSeq ?? 0) + 1)}`;
  (t.customPresets ??= []).push({ id, name: cleanPresetName(name, `내 프리셋 ${t.presetSeq}`), slots: cleanSlots(slots) });
  return id;
}

/** 커스텀 프리셋 고치기 (이름·칸). 기본 프리셋은 못 고친다 */
export function updateCustomPreset(t: TrainingState, id: string, name: string, slots: readonly TrainingKind[]): boolean {
  const p = t.customPresets?.find((x) => x.id === id);
  if (!p) return false;
  p.name = cleanPresetName(name, p.name);
  p.slots = cleanSlots(slots);
  return true;
}

/** 커스텀 프리셋 지우기. 쓰던 프리셋이면 균형으로 */
export function deleteCustomPreset(t: TrainingState, id: string): boolean {
  const i = t.customPresets?.findIndex((x) => x.id === id) ?? -1;
  if (i < 0) return false;
  t.customPresets.splice(i, 1);
  if (t.preset === id) t.preset = 'balance';
  return true;
}

function cleanPresetName(name: string, fallback: string): string {
  const n = name.trim().slice(0, PRESET_NAME_MAX);
  return n || fallback;
}

function cleanSlots(slots: readonly TrainingKind[]): TrainingKind[] {
  return Array.from({ length: PRESET_SLOTS }, (_, i) => (TRAINING_KINDS.includes(slots[i]!) ? slots[i]! : 'tech'));
}

export interface TrainingState {
  /** 날짜별 변경 (그날만, 25.3 3번). 지난 날은 지운다 */
  overrides: Record<IsoDate, TrainingKind>;
  /** 기술 훈련 묶음. auto = 시즌 상한이 남은 묶음 중 포지션 OVR 비중이 가장 큰 묶음 */
  focus: AttributeGroup | 'auto';
  gauges: Record<AttributeGroup, number>;
  /** 이번 시즌 묶음별 게이지 능력치 상승 */
  seasonUps: Partial<Record<AttributeGroup, number>>;
  /** 주간 상한: 이번 주 월요일, 이번 주 훈련 XP(상한 앞 값), 아직 못 더한 소수 XP */
  week: IsoDate;
  weekXp: number;
  carry: number;
  /** 연속 휴식 일 수와 다음 경기 폼 감점 */
  restStreak: number;
  formPenalty: number;
  /** 역할 시그니처 해금 진행(경기), 카드 숙련 진행(회) 소수분 */
  roleProg: number;
  cardProg: Record<string, number>;
  /** 영상 분석으로 얻은 다음 경기 힌트 (경기 뒤 비운다), 경기 전날 분석했는지 (시작 패 +1 훅) */
  hints: string[];
  eve: boolean;
  last: TrainingDayResult | null;
  /**
   * 훈련 프리셋 (C.52): 이번 주(presetWeek) 프리셋 id. presetAuto 면 주가 바뀔 때 추천 프리셋으로 바꾼다.
   * presetManual = 이번 주에 직접 고름 (그 주만 유지, 다음 주는 다시 자동). 커스텀 프리셋은 개수 제한 없음 (id c1, c2 ...)
   */
  preset: string;
  presetWeek: IsoDate | '';
  presetAuto: boolean;
  presetManual: boolean;
  customPresets: TrainingPreset[];
  presetSeq: number;
  /** 이번 시즌 합계 (측정·화면) */
  season: { xp: number; fatigue: number; days: Partial<Record<DayPlan, number>>; ups: number };
}

export function emptyGauges(): Record<AttributeGroup, number> {
  return Object.fromEntries(GROUP_NAMES.map((g) => [g, 0])) as Record<AttributeGroup, number>;
}

export function initTraining(date: IsoDate): TrainingState {
  return {
    overrides: {}, focus: 'auto', gauges: emptyGauges(), seasonUps: {}, week: weekStart(date), weekXp: 0, carry: 0,
    restStreak: 0, formPenalty: 0, roleProg: 0, cardProg: {}, hints: [], eve: false, last: null,
    preset: 'balance', presetWeek: '', presetAuto: true, presetManual: false, customPresets: [], presetSeq: 0,
    season: { xp: 0, fatigue: 0, days: {}, ups: 0 },
  };
}

/** 그 주 월요일 */
export function weekStart(d: IsoDate): IsoDate {
  return addDays(d, -((weekday(d) + 6) % 7));
}

/**
 * 기본 주간 계획 (25.3 2번, C.44 pending 52 1번): 경기 다음 날 휴식(고정, 바꿀 수 없음), 경기 전날 영상 분석, 나머지 기술.
 * prevGap = 앞 내 경기에서 지난 날, nextGap = 다음 내 경기까지 남은 날 (없으면 null)
 */
export function defaultPlan(prevGap: number | null, nextGap: number | null, slot: TrainingKind = 'tech'): TrainingKind {
  if (isFixedRest(prevGap)) return 'rest';
  if (nextGap === 1) return 'video';
  return slot;
}

/** 프리셋과 상관없이 정해진 날 (경기 다음 날 휴식·경기 전날 영상) */
export const isPresetFixed = (prevGap: number | null, nextGap: number | null): boolean => isFixedRest(prevGap) || nextGap === 1;

/** 경기 다음 날 = 휴식 고정 (C.44) */
export const isFixedRest = (prevGap: number | null): boolean => prevGap === 1;

/** 하루 피로 회복량 */
export function planFatigue(kind: DayPlan): number {
  const F = BALANCE.fatigue;
  if (kind === 'match') return 0;
  if (kind === 'vacation') return T.vacation.fatigue;
  if (kind === 'rehab') return F.noMatchWeekRecovery / 7;
  return T.kinds[kind].fatigue;
}

/** 상한 앞 하루 XP */
export function planXp(kind: DayPlan): number {
  if (kind === 'match' || kind === 'vacation') return 0;
  if (kind === 'rehab') return BALANCE.injury.rehabXp / 7;
  return T.kinds[kind].xp;
}

function bundleWeight(pos: FieldPosition, g: AttributeGroup): number {
  const attrs = ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[];
  return attrs.reduce((t, a) => t + attributeOvrWeight(pos, a), 0) / attrs.length;
}

/** 묶음의 이번 시즌 상승이 상한에 닿았는지 */
export function bundleCapped(t: TrainingState, g: AttributeGroup): boolean {
  return (t.seasonUps[g] ?? 0) >= T.gauge.bundleSeasonMax || t.season.ups >= T.gauge.seasonMax;
}

/** 오늘 기술 훈련 묶음 */
export function techBundle(t: TrainingState, pos: FieldPosition): AttributeGroup {
  if (t.focus !== 'auto') return t.focus;
  const open = GROUP_NAMES.filter((g) => !bundleCapped(t, g));
  const pool = open.length ? open : GROUP_NAMES;
  return pool.reduce((best, g) => (bundleWeight(pos, g) > bundleWeight(pos, best) ? g : best));
}

/** 묶음에서 가장 낮은 능력치 (같으면 포지션 OVR 비중이 큰 쪽) */
export function lowestInBundle(p: Pick<PlayerState, 'attributes' | 'position'>, g: AttributeGroup): FieldAttribute {
  const attrs = ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[];
  return attrs.reduce((lo, a) => {
    const d = p.attributes[a] - p.attributes[lo];
    return d < 0 || (d === 0 && attributeOvrWeight(p.position, a) > attributeOvrWeight(p.position, lo)) ? a : lo;
  });
}

/**
 * 게이지 칸 수: gauge.full(40, C.44) × 그 묶음 가장 낮은 능력치의 내부 +1 비용 배수 (6.2, C.41, C.49부터 포인트와 별개). 낮은 능력치(비용 1)는 40, 고값은 비용만큼 길어진다
 * (포인트 비용을 건너뛰는 공짜 고값 상승을 막는다)
 */
export function gaugeNeed(p: Pick<PlayerState, 'attributes' | 'position'>, g: AttributeGroup): number {
  const a = lowestInBundle(p, g);
  return T.gauge.full * internalCost(p.attributes[a], costTier(p));
}

/** 기술 훈련 하루: 게이지 + (1 × 고령 감쇠), 차면 가장 낮은 능력치 +1 (상한 안에서). 오른 능력치를 돌려준다 */
export function techDay(t: TrainingState, p: PlayerState, g: AttributeGroup, mult = 1): FieldAttribute | undefined {
  const need = gaugeNeed(p, g);
  t.gauges[g] = Math.min(need, Math.round(((t.gauges[g] ?? 0) + T.gauge.per * mult) * 100) / 100);
  if (t.gauges[g]! < need || bundleCapped(t, g)) return undefined;
  const a = lowestInBundle(p, g);
  if (p.attributes[a] >= BALANCE.growth.maxAttribute) return undefined;
  p.attributes[a] += 1;
  t.gauges[g] = 0;
  t.seasonUps[g] = (t.seasonUps[g] ?? 0) + 1;
  t.season.ups++;
  return a;
}

/** 훈련 XP: 주간 상한(상한 앞 값) → 고령 감쇠 × 난이도. 소수는 모아 두고 정수만 돌려준다 */
export function takeXp(t: TrainingState, date: IsoDate, raw: number, mult: number): { gained: number; whole: number } {
  const wk = weekStart(date);
  if (wk !== t.week) {
    t.week = wk;
    t.weekXp = 0;
  }
  const allowed = Math.max(0, Math.min(raw, T.weeklyXpCap - t.weekXp));
  t.weekXp += allowed;
  const gained = allowed * mult;
  t.carry += gained;
  const whole = Math.floor(t.carry + 1e-9);
  t.carry -= whole;
  t.season.xp += gained;
  return { gained, whole };
}

/** 새 시즌: 시즌 상한·합계를 비운다 (게이지는 이어진다) */
export function newTrainingSeason(t: TrainingState): void {
  t.seasonUps = {};
  t.season = { xp: 0, fatigue: 0, days: {}, ups: 0 };
  t.hints = [];
  t.eve = false;
  t.overrides = {};
}

export const attrNameKo = (a: FieldAttribute): string => ATTRIBUTE_NAMES_KO[a];
