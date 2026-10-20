// 구단 재정 (NPC 전용, pending 62.2, 부록 C.46): 재정 등급, 시즌 연봉 총액 상한, 시즌 영입 예산, 선수 몸값.
// 사용자·플레이어는 조작하지 않는다. 쓰이는 곳: NPC 이적 목적지(감당 가능), 내 선수 제안·연봉, 1군 테스트 경쟁 제안, 재계약 판정.
// 세이브에는 시즌 예산(팀당 숫자 하나)만 담고, 쓴 돈·번 돈은 이적 기록(TransferRec.fee)에서, 연봉 총액은 로스터에서 그때그때 계산한다.
// 금액은 모두 만 원 (wageFor 와 같은 단위). 빚·파산·이적료 시장·FFP·대출은 없다

import { OUTSIDE_BY_ID } from '../data/outsideClubs';
import { BALANCE } from './config/balance';
import type { GameState } from './game';
import { leagueTeamById, type LeagueState } from './league';
import { naturalOvr, type RosterPlayer, type Rosters } from './roster';
import { wageFor, type TransferRec } from './transfer';

export type FinanceTier = 'big' | 'upper' | 'mid' | 'low';

export const TIER_KO: Record<FinanceTier, string> = { big: '빅클럽', upper: '상위', mid: '중위', low: '하위' };

/** 시즌 예산 (세이브) */
export interface FinanceState {
  /** 예산을 정한 이적 시즌 (여름 이적시장 = 다가올 시즌) */
  season: number;
  /** 팀 id → 그 시즌 영입 예산 (등급 기본 + 순위 상금) */
  budgets: Record<string, number>;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const isOutsideClub = (id: string): boolean => id.startsWith('x:');

/** 재정 등급: PL 팀은 표, 리그 밖 클럽·다른 리그 팀(C.76c)은 레이팅으로 (가상 팀은 중위) */
export function financeTier(id: string): FinanceTier {
  const F = BALANCE.finance;
  if (F.teamTier[id]) return F.teamTier[id]!;
  if (!isOutsideClub(id) && !leagueTeamById(id)) return 'mid';
  const r = OUTSIDE_BY_ID[id]?.rating ?? leagueTeamById(id)?.rating ?? 70;
  return r >= F.outsideTier.big ? 'big' : r >= F.outsideTier.upper ? 'upper' : r >= F.outsideTier.mid ? 'mid' : 'low';
}

export const tierLabel = (id: string): string => TIER_KO[financeTier(id)];

function interp(table: readonly (readonly [number, number])[], x: number): number {
  if (x <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i]!;
    if (x <= x1) {
      const [x0, y0] = table[i - 1]!;
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return table[table.length - 1]![1];
}

/** NPC 위상 근사 (연봉·몸값 계산용) */
export const npcReputation = (ovr: number): number => interp(BALANCE.finance.npcRep, ovr);

/**
 * 몸값 (만 원): OVR·나이·잠재력(전성기 OVR)·위상·남은 계약 연수. 남은 계약 0년(자유계약·만료) = 0.
 * 500만 원 단위, 상한 maxValue (천문학적 금액 없음)
 */
export function marketValue(o: { ovr: number; age: number; peak?: number; reputation?: number; yearsLeft: number }): number {
  const V = BALANCE.finance.value;
  const yl = Math.max(0, Math.floor(o.yearsLeft));
  const cm = V.contract[Math.min(yl, V.contract.length - 1)]!;
  if (cm <= 0) return 0;
  const age = V.age.find(([a]) => o.age <= a)![1];
  const pot = 1 + Math.min(V.potMax, Math.max(0, (o.peak ?? o.ovr) - o.ovr) * V.potPerPoint);
  const rep = 1 + Math.min(V.repMax, Math.max(0, o.reputation ?? npcReputation(o.ovr)) / V.repDiv);
  const raw = V.base * Math.pow(V.growth, o.ovr - 70) * age * pot * rep * cm;
  return clamp(Math.round(raw / V.unit) * V.unit, V.unit, V.maxValue);
}

/** 로스터 선수 몸값 (시즌 기준: 남은 계약 = contractEnd − season) */
export function npcValue(p: RosterPlayer, season: number, reputation?: number): number {
  return marketValue({ ovr: naturalOvr(p), age: p.age, peak: p.peakOvr, yearsLeft: p.contractEnd - season, reputation });
}

/** 몸값 표시 ("0" = 자유계약) */
export function valueLabel(v: number): string {
  if (v <= 0) return '자유계약 (0)';
  return v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '')}억 원` : `${v.toLocaleString('ko-KR')}만 원`;
}

// ── 연봉 ──

/**
 * NPC 연봉 (만 원/년) = 위상 → 주급 곡선 × 52. 위상을 주지 않으면 OVR 근사 (이적·예산 계산).
 * 선수 상세 화면은 NPC 위상(worldStats.npcStanding: 기록·수상 포함)을 넘긴다 (C.68b, pending 104 ① — 시뮬 경로는 그대로, 엔진 다듬기 블록에서 검토)
 */
export function npcAnnualWage(p: RosterPlayer, teamRating: number, reputation?: number): number {
  const ovr = naturalOvr(p);
  return wageFor(reputation ?? npcReputation(ovr), ovr, teamRating) * 52;
}

/** 팀 연봉 총액 (만 원/년, 로스터 NPC). 내 선수가 그 팀이면 extra 로 더한다 */
export function wageBill(rosters: Rosters, teamId: string, teamRating: number, exceptId?: string): number {
  const r = rosters[teamId];
  if (!r) return 0;
  return r.players.reduce((t, p) => (p.id === exceptId ? t : t + npcAnnualWage(p, teamRating)), 0);
}

export const wageCap = (id: string): number => BALANCE.finance.wageCap[financeTier(id)];

// ── 예산 ──

/** 시즌 예산 = 등급 기본 + 지난 시즌 순위 상금. ranks 는 팀 id → 순위(1~20) */
export function seasonBudgets(league: Pick<LeagueState, 'teams'>, ranks: Record<string, number>): Record<string, number> {
  const F = BALANCE.finance;
  const n = league.teams.length;
  return Object.fromEntries(league.teams.map((t) => [t.id, F.budget[financeTier(t.id)] + (n + 1 - (ranks[t.id] ?? n)) * F.prizePerRank]));
}

/** 그 시즌 이적 기록의 산 돈·판 돈 (fee 없는 옛 기록은 0) */
export function seasonFlows(recs: readonly TransferRec[], season: number): { spent: Record<string, number>; sold: Record<string, number> } {
  const spent: Record<string, number> = {};
  const sold: Record<string, number> = {};
  for (const r of recs) {
    if (r.season !== season || !r.fee) continue;
    spent[r.to] = (spent[r.to] ?? 0) + r.fee;
    sold[r.from] = (sold[r.from] ?? 0) + r.fee;
  }
  return { spent, sold };
}

/** 남은 영입 예산 = 시즌 예산 + 판 몸값 × saleShare − 쓴 돈 (0 아래로 안 내려감). 리그 밖 클럽은 등급 예산 × outsideBudgetShare (한 선수 기준) */
export function remainingBudget(state: Pick<GameState, 'finance' | 'transfers'>, teamId: string, season: number): number {
  const F = BALANCE.finance;
  // 다른 리그 팀 (C.76c): 예산 표(내 리그 팀)에 없으면 리그 밖 클럽처럼
  if (isOutsideClub(teamId) || (state.finance && !(teamId in state.finance.budgets))) return F.budget[financeTier(teamId)] * F.outsideBudgetShare;
  const base = state.finance?.season === season ? state.finance.budgets[teamId] ?? 0 : F.budget[financeTier(teamId)];
  const { spent, sold } = seasonFlows(state.transfers ?? [], season);
  return Math.max(0, base + (sold[teamId] ?? 0) * F.saleShare - (spent[teamId] ?? 0));
}

/** 남은 연봉 여력 (만 원/년). 리그 밖 클럽은 한 선수 기준 등급 상한 × outsideWageShare */
export function wageRoom(state: Pick<GameState, 'rosters'>, teamId: string, teamRating: number, exceptId?: string): number {
  const F = BALANCE.finance;
  // 다른 리그 팀 (C.76c): 로스터가 없으면 리그 밖 클럽처럼
  if (isOutsideClub(teamId) || (state.rosters && !state.rosters[teamId])) return F.wageCap[financeTier(teamId)] * F.outsideWageShare;
  return wageCap(teamId) - wageBill(state.rosters, teamId, teamRating, exceptId);
}

/** 감당 가능: 남은 영입 예산 ≥ 몸값, 남은 연봉 여력 ≥ 연봉 */
export function affordable(budgetLeft: number, room: number, value: number, annualWage: number): boolean {
  return budgetLeft >= value && room >= annualWage;
}

/** 시즌 예산 정하기 (여름 이적시장 직전·새 게임·옛 세이브 변환). ranks 없으면 레이팅 순 */
export function ensureFinance(state: Pick<GameState, 'finance' | 'league'>, season: number, ranks?: Record<string, number>): void {
  if (state.finance?.season === season) return;
  const r = ranks ?? Object.fromEntries([...state.league.teams].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).map((t, i) => [t.id, i + 1]));
  state.finance = { season, budgets: seasonBudgets(state.league, r) };
}
