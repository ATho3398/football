// 결정 순간 모양 측정 (C.75a): 정책을 감싸 정지마다 고를 거리 수(판정 있는 선택지 + 카드가 연 선택지, 맡기기 제외)·1개짜리 정지·
// 박스 안 슛 선택지 노출률을 센다. balance-moments·balance-cards 가 같이 쓴다
import type { Candidate } from '../src/engine/onball';
import type { Moment, MomentPolicy } from '../src/engine/moments';

export interface ShapeStats {
  stops: number;
  hist: Record<string, number>;
  one: number;
  /** 소유 정지 중 박스 안 / 그중 슛 선택지 보임 / 슛 후보(xG ≥ 0.06)가 있던 정지 / 그중 슛 보임 */
  box: number;
  boxShot: number;
  shotCand: number;
  shotShown: number;
  /** 드리블 후보가 있던 소유 정지 / 그중 드리블 보임 */
  drib: number;
  dribShown: number;
}

export function newShape(): ShapeStats {
  return { stops: 0, hist: {}, one: 0, box: 0, boxShot: 0, shotCand: 0, shotShown: 0, drib: 0, dribShown: 0 };
}

export function choicesOf(m: Moment): number {
  // 세트피스의 "엔진 판단대로"(판정 없음)는 맡기기와 같아 뺀다 (엔진 enoughChoices 와 같은 셈)
  const opts = m.type === 'setPiece' ? m.options.filter((o) => o.p !== null).length : m.options.length;
  return opts + m.cards.filter((c) => c.usable && c.option).length;
}

export function shaped(st: ShapeStats, pol: MomentPolicy): MomentPolicy {
  return (m) => {
    st.stops++;
    const n = choicesOf(m);
    const k = n >= 4 ? '4+' : String(n);
    st.hist[k] = (st.hist[k] ?? 0) + 1;
    if (n < 2) st.one++;
    if (m.type === 'onball') {
      const cands = ((m as Moment & { cands?: Candidate[] }).cands ?? []);
      const shown = [...m.options, ...m.cards.filter((c) => c.usable && c.option).map((c) => c.option!)];
      const hasShot = shown.some((o) => o.action === 'shoot');
      if (m.box) {
        st.box++;
        if (hasShot) st.boxShot++;
      }
      if (cands.some((c) => c.type === 'shoot' && c.p >= 0.06)) {
        st.shotCand++;
        if (hasShot) st.shotShown++;
      }
      if (cands.some((c) => c.type === 'dribble')) {
        st.drib++;
        if (shown.some((o) => o.action === 'dribble')) st.dribShown++;
      }
    }
    return pol(m);
  };
}

export function shapeLine(st: ShapeStats, games: number): string {
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '-');
  const h = ['1', '2', '3', '4+'].map((k) => `${k}개 ${st.hist[k] ?? 0}`).join(' / ');
  return `정지 ${st.stops} (경기당 ${(st.stops / Math.max(1, games)).toFixed(2)}) · 고를 거리 ${h} · 1개 이하 정지 ${st.one + (st.hist['0'] ?? 0)}`
    + ` · 박스 안 소유 정지 ${st.box} 중 슛 보임 ${pct(st.boxShot, st.box)} · 슛 후보(xG≥0.06) 정지 ${st.shotCand} 중 슛 보임 ${pct(st.shotShown, st.shotCand)}`
    + ` · 드리블 후보 정지 ${st.drib} 중 드리블 보임 ${pct(st.dribShown, st.drib)}`;
}
