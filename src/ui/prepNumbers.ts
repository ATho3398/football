// 경기 준비 · 하프타임 숫자 (17차 S08·S09, 부록 C.83c): 화면에 보이는 상대 예상 계획 · 상성 · 전술 적합도 · 공격 인원을 엔진과 같은 함수로 센다.
// - 예상 계획 = 엔진이 상대 팀을 세울 때 쓰는 teamPlan → underdogPlan (adapter.buildMyMatch 와 같은 입력: 팀 레이팅 · 리그 평균 · worldSeed) — 시드 고정이라 실제 경기와 같다
// - 상성 = ENGINE.matchup[우리 성향][상대 예상 성향] 능력치 점수 (C.80p)
// - 적합도 = fitGaps(선발 필드 선수) × ENGINE.tacticFit.gain (±cap, C.80e) — 엔진 fitOnly 와 같은 식. 균형·수비 블록은 적합도 보정이 없다
// - 공격 인원 = stackCount (공격 포지션 수, ENGINE.stackCap.n 이상이면 연계 감점)
// 엔진은 읽기만 한다 (ENGINE_VERSION 그대로)

import { ENGINE } from '../engine/config';
import { fitGaps, FIT_TENDENCIES, type FitKind, type FitTendency } from '../engine/fit';
import { underdogPlan } from '../engine/setup';
import { stackCount, stackPenalty } from '../engine/stack';
import { LEVEL_NAMES_KO, levelOf, teamPlan, TENDENCY_NAMES_KO } from '../engine/tactics';
import type { Tendency } from '../engine/types';
import type { FieldAttributes } from '../attributes';
import type { Position } from '../types';

/** 실행 이름 (상성 · 적합도 칸) */
const KIND_KO: Record<FitKind, string> = { long: '롱패스', air: '공중볼', touch: '퍼스트 터치', short: '짧은 패스', keep: '공 지키기', run: '돌파', tackle: '태클' };
const signedInt = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

export interface OppPlanVM {
  tendency: Tendency;
  name: string;
  /** "내려앉아 지켜요" 같은 한 줄 */
  line: string;
  /** 근거 한 줄: "전력 차 13 · 12 이상이면 수비 블록 확정" */
  basis: string;
  /** 약팀 대응이 걸렸는지 (전력 차 underdogGap 이상) */
  adapted: boolean;
}

/** 상대 예상 계획 (엔진 상대 팀 세우기와 같은 함수) */
export function oppPlanOf(oppId: string, oppRating: number, myRating: number, formation: Parameters<typeof teamPlan>[2], worldSeed: string, leagueAvg: number): OppPlanVM {
  const T = ENGINE.tactics;
  const base = teamPlan(oppId, oppRating, formation, worldSeed, leagueAvg).tactics;
  const plan = underdogPlan(oppId, oppRating, myRating, base, worldSeed);
  const gap = Math.round(myRating - oppRating);
  const lh = levelOf('lineHeight', plan.lineHeight);
  const adapted = gap >= T.underdogGap;
  const name = plan.tendency === 'block' && lh === 0 ? '버스 세우기' : TENDENCY_NAMES_KO[plan.tendency];
  const line = plan.tendency === 'block' ? '내려앉아 지켜요'
    : plan.tendency === 'counter' ? '내주고 빠르게 역습해요'
    : adapted ? `라인 ${LEVEL_NAMES_KO.lineHeight[lh]} · 한 단계 내려서요`
    : plan.tendency === 'gegenpress' ? '앞에서 강하게 눌러요'
    : plan.tendency === 'tikitaka' ? '공을 오래 돌려요'
    : plan.tendency === 'direct' ? '롱볼로 바로 넘겨요'
    : '평소 전술 그대로';
  const basis = gap >= T.underdogBigGap ? `전력 차 ${gap} · ${T.underdogBigGap} 이상이면 수비 블록 확정`
    : adapted ? `전력 차 ${gap} · ${T.underdogGap} 이상이면 약팀 대응(성향·압박 조정)`
    : gap <= -T.underdogGap ? `상대가 ${-gap} 강해요 · 평소 전술`
    : `전력 차 ${Math.abs(gap)} · 평소 전술`;
  return { tendency: plan.tendency, name, line, basis, adapted };
}

export interface MatchupVM {
  /** 우리 쪽 칸 "압박·태클 +2" (없으면 null) */
  mine: string | null;
  /** 상대 쪽 칸 */
  theirs: string | null;
  /** 짧은 판정: 유리 · 불리 · 차이 없음 */
  tone: 'up' | 'down' | 'flat';
}

function matchupText(a: Tendency, b: Tendency): { text: string | null; sum: number } {
  const row = (ENGINE.matchup as Partial<Record<Tendency, Partial<Record<Tendency, Partial<Record<FitKind, number>>>>>>)[a]?.[b];
  if (!row) return { text: null, sum: 0 };
  const parts = (Object.entries(row) as [FitKind, number][]).filter(([, v]) => v !== 0);
  if (!parts.length) return { text: null, sum: 0 };
  const sum = parts.reduce((t, [, v]) => t + v, 0);
  // 같은 값끼리 묶어 "짧은 패스·공 지키기 +3"
  const by = new Map<number, string[]>();
  for (const [k, v] of parts) by.set(v, [...(by.get(v) ?? []), KIND_KO[k]]);
  return { text: [...by.entries()].map(([v, ks]) => `${ks.join('·')} ${signedInt(v)}`).join(' · '), sum };
}

/** 상성 (C.80p ENGINE.matchup): 우리 성향 vs 상대 예상 성향 */
export function matchupOf(mine: Tendency, opp: Tendency): MatchupVM {
  const a = matchupText(mine, opp);
  const b = matchupText(opp, mine);
  return { mine: a.text, theirs: b.text, tone: a.sum > b.sum ? 'up' : a.sum < b.sum ? 'down' : 'flat' };
}

export interface FitPlayerIn { pos: Position; attrs?: FieldAttributes }

/** 성향 적합도 점수 (엔진 fitOnly 와 같은 식: gain × 선수단 차이, ±cap). 보정이 없는 성향(균형·수비 블록)은 null */
export function tacticFitPts(tendency: Tendency, lineup: readonly FitPlayerIn[]): number | null {
  const F = ENGINE.tacticFit;
  if (!F.on || !(FIT_TENDENCIES as readonly string[]).includes(tendency)) return null;
  const gains = Object.values((F.gain as Record<string, Partial<Record<FitKind, number>>>)[tendency] ?? {}) as number[];
  if (!gains.length) return null;
  const field = lineup.filter((p): p is Required<FitPlayerIn> => p.pos !== 'GK' && !!p.attrs);
  const gap = fitGaps(field.map((p) => ({ attrs: p.attrs, pos: p.pos })))[tendency as FitTendency] ?? 0;
  return Math.round(Math.max(-F.cap, Math.min(F.cap, Math.max(...gains) * gap)));
}

export interface FitVM { pts: number | null; text: string; tone: 'good' | 'ok' | 'bad' | 'none' }

/** 적합도 칸 글자: "+6점" · "보정 없음". ±3 점 이상이면 적합/안 맞음 */
export function fitVM(pts: number | null): FitVM {
  if (pts === null) return { pts, text: '보정 없음', tone: 'none' };
  return { pts, text: `${signedInt(pts)}점`, tone: pts >= 3 ? 'good' : pts <= -3 ? 'bad' : 'ok' };
}

export const FIT_TONE_KO: Record<FitVM['tone'], string> = { good: '적합', ok: '보통', bad: '안 맞음', none: '보정 없음' };
export const fitCap = (): number => ENGINE.tacticFit.cap;

export interface AttackVM { n: number; limit: number; warn: boolean; text: string }

/** 공격 인원 (ENGINE.stackCap): 공격 포지션 수 · 기준 이상이면 연계 감점 경고 */
export function attackOf(positions: readonly Position[]): AttackVM {
  const n = stackCount(positions);
  const limit = ENGINE.stackCap.n;
  const pen = stackPenalty(positions);
  const warn = pen.over > 0;
  return { n, limit, warn, text: warn ? `연계 −${Math.round((1 - pen.link) * 100)}% · 수비 전환 체력 소모 +${Math.round((pen.drain - 1) * 100)}%` : `${limit}명 이상 올리면 연계가 떨어져요` };
}
