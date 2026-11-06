// 결정 순간 선택지 숫자 (부록 C.81n): 화면에 보이는 성공 확률·위험 등급·기대 평점을 한 곳에서 계산한다.
// 성공 확률 = 화면 % (확률 카드 변화 포함, 0~99) · 위험 등급 = 화면 실패 평점(절댓값) 기준 BALANCE.display.risk ·
// 기대 평점 = p × 성공 평점 + (1 − p) × 실패 평점(음수) + 소극적 감점 — 화면 숫자만으로 다시 셀 수 있다.
// 몰고 가다 슛(2단)은 실패 평점이 몰고 가다 뺏길 때만 붙어 실패 몫 확률 = 1 − 첫 단 성공 확률.
// 판정 확률(엔진)은 그대로, 표시만 맞춘다.

import { BALANCE } from '../config/balance';
import type { DecisionRecord, MomentOption } from '../engine/moments';

export type RiskLevel = 'low' | 'mid' | 'high';
export const RISK_KO: Record<RiskLevel, string> = { low: '낮음', mid: '보통', high: '높음' };
/** 결정 기록 + 화면이 보여 준 위험 등급 (C.81v): 직접 모드 결정 화면에서 채운다 (엔진은 읽지 않는다, 옛 기록엔 없음) */
export type DecisionWithRisk = DecisionRecord & { risk?: RiskLevel };

const r2 = (x: number) => Math.round(x * 100) / 100;

const pct = (p: number) => Math.round(Math.max(0, Math.min(0.99, p)) * 100);

/**
 * 화면에 보이는 성공 % (판정 없음 = null): 바탕 % + 카드 변화 %p (0~99). 선택지 줄 큰 숫자 · [확정] 버튼이 같은 값.
 * dp = 확률 카드 변화(확률 단위). 카드 선택지(4번째)는 바탕 행동 확률 baseP + (p − baseP)
 */
export function shownChance(o: Pick<MomentOption, 'p' | 'kind' | 'baseP'>, dp = 0): number | null {
  if (o.p === null) return null;
  const card = o.kind === 'card' && o.baseP !== undefined;
  const base = pct(card ? o.baseP! : o.p);
  const d = Math.round((card ? o.p - o.baseP! : dp) * 100);
  return Math.max(0, Math.min(99, base + d));
}

/** 위험 등급: 실패 시 평점 손실 (화면 2자리 값) ≤ low 낮음, ≤ mid 보통, 그 위 높음. 판정 없는 선택지는 null */
export function riskLevel(o: Pick<MomentOption, 'p' | 'down'>): RiskLevel | null {
  if (o.p === null) return null;
  const loss = Math.abs(r2(o.down));
  const R = BALANCE.display.risk;
  return loss <= R.low + 1e-9 ? 'low' : loss <= R.mid + 1e-9 ? 'mid' : 'high';
}

/** 기대 평점 (화면 숫자로 계산, 2자리) */
export function shownEv(o: Pick<MomentOption, 'p' | 'kind' | 'baseP' | 'up' | 'down' | 'passive' | 'chain'>, dp = 0): number {
  const c = shownChance(o, dp);
  const p = c === null ? 1 : c / 100;
  const failP = o.chain ? 1 - pct(o.chain.p) / 100 : 1 - p;
  return r2(p * r2(o.up) + failP * r2(o.down) + r2(o.passive ?? 0));
}
