// C.81n: 결정 순간 숫자 통일 (성공 확률·위험 등급·기대 평점이 한 계산) · 내 선수 잠재력 범위 (B6)
import { describe, expect, it } from 'vitest';
import type { DecisionRecord, Moment, MomentOption } from '../src/engine/moments';
import { momentView } from '../src/ui/views/moment';
import { riskLevel, shownChance, shownEv } from '../src/ui/momentNumbers';
import { potentialHalfWidth, potentialRange, truePotential } from '../src/potential';
import { BALANCE } from '../src/config/balance';
import { newGame } from '../src/game';
import { playerOvr } from '../src/growth';
import { homeVM, playerVM } from '../src/ui/viewModels';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import dump from '../scripts/c75v-moment.json';

const d = dump as unknown as { teams: [string, string]; moment: Moment; log: DecisionRecord[] };
const o0 = d.moment.options[0]!;
const mk = (x: Partial<MomentOption>): MomentOption => ({ ...o0, offside: undefined, ...x });
const opts: MomentOption[] = [
  mk({ kind: 'safe', label: '백패스', p: 0.88, up: 0.01, down: -0.04, passive: -0.01 }),
  mk({ kind: 'balanced', label: '컷백', p: 0.45, up: 0.08, down: -0.03 }),
  mk({ kind: 'gamble', label: '크로스', p: 0.1, up: 0.06, down: -0.0 }),
  mk({ kind: 'gamble', action: 'carry', label: '몰고 가다 슛', p: 0.12, up: 0.3, down: -0.02, chain: { type: 'shoot', p: 0.4 } }),
  mk({ kind: 'gamble', label: '중거리 슛', p: 0.07, up: 0.3, down: -0.08 }),
];
const M: Moment = { ...d.moment, sureBack: false, sure: false, options: opts };
const vm = { moment: M, teams: d.teams, selected: null, card: null, stop: 'important' as const, last: d.log.at(-1) ?? null, count: 1 };

/** 렌더된 선택지 줄에서 화면 숫자를 읽는다 */
function rows(h: string) {
  return h.split('<button type="button" class="po-choice').slice(1).map((b) => {
    const num = (re: RegExp) => { const m = b.match(re); return m ? Number(m[1]!.replace("−", "-").replace("+", "").replace("±", "")) : null; };
    return {
      chance: num(/class="po-num(?: is-up| is-down)?">(\d+)<small>%/),
      up: num(/po-out--ok">[\s\S]*?<b class="po-num">([+−±-]?[\d.]+)/),
      down: num(/po-out--bad">[\s\S]*?<b class="po-num">([+−±-]?[\d.]+)/),
      passive: num(/소극적 ([+−±-]?[\d.]+)/),
      ev: num(/기대 평점<\/span><b class="po-num">([+−±-]?[\d.]+)/),
      risk: b.match(/po-risk--(low|mid|high)/)?.[1] ?? null,
      chain: b.includes('몰고 가기 → 슛'),
    };
  });
}

describe('C.81n 결정 순간 숫자', () => {
  it('버전', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?\d?$/);
    expect(STAGE_LABEL).toBe('53단계');
  });
  it('위험 등급 = 실패 평점 손실 (≤0.02 낮음 · 0.03~0.05 보통 · >0.05 높음), 판정 없음은 없음', () => {
    expect(BALANCE.display.risk).toEqual({ low: 0.02, mid: 0.05 });
    expect(opts.map((o) => riskLevel(o))).toEqual(['mid', 'mid', 'low', 'low', 'high']);
    expect(riskLevel(mk({ p: null, down: 0 }))).toBeNull();
    expect(riskLevel(mk({ down: -0.02 }))).toBe('low');
    expect(riskLevel(mk({ down: -0.05 }))).toBe('mid');
    expect(riskLevel(mk({ down: -0.06 }))).toBe('high');
  });
  it('기대 평점 = p × 성공 + (1 − p) × 실패 (+ 소극적), 크로스 10% +0.06 → +0.01 (0.006)', () => {
    expect(shownEv(opts[2]!)).toBe(0.01);
    expect(shownEv(opts[1]!)).toBeCloseTo(0.45 * 0.08 - 0.55 * 0.03, 2);
    expect(shownEv(opts[0]!)).toBeCloseTo(0.88 * 0.01 - 0.12 * 0.04 - 0.01, 2);
    // 몰고 가다 슛: 실패 평점은 몰고 가다 뺏길 때만 (1 − 첫 단 성공)
    expect(shownEv(opts[3]!)).toBeCloseTo(0.12 * 0.3 - 0.6 * 0.02, 2);
  });
  it('화면 숫자 출처 일치: 줄마다 보이는 %·성공/실패 평점으로 다시 센 기대 평점 = 보이는 기대 평점, 위험 칩 = 보이는 실패 평점 등급', () => {
    const rs = rows(momentView(vm));
    expect(rs).toHaveLength(opts.length);
    for (const r of rs) {
      const p = r.chance! / 100;
      const failP = r.chain ? 0.6 : 1 - p;
      expect(r.ev).toBeCloseTo(Math.round((p * r.up! + failP * r.down! + (r.passive ?? 0)) * 100) / 100, 5);
      const loss = Math.abs(r.down!);
      expect(r.risk).toBe(loss <= 0.02 ? 'low' : loss <= 0.05 ? 'mid' : 'high');
    }
  });
  it('확률 카드: 줄 % · [확정] % · 기대 평점이 같은 카드 반영 %', () => {
    const cm: Moment = { ...M, cards: [{ ...d.moment.cards[1]!, hand: 7, deltas: [0.05, 0.123, 0, 0, 0] }] };
    const h = momentView({ ...vm, moment: cm, card: 7, selected: 1 });
    const r = rows(h)[1]!;
    expect(r.chance).toBe(shownChance(opts[1]!, 0.123));
    expect(r.chance).toBe(57);
    expect(h).toContain(`확정 · 컷백 ${r.chance}%`);
    expect(r.ev).toBe(shownEv(opts[1]!, 0.123));
  });
  it('줄 칩은 위험 하나 (안전·균형·도박 칩 없음, 구간은 막대 제목), 칩은 이름 뒤(아래 줄)', () => {
    const h = momentView(vm);
    expect(h).not.toContain('po-kind');
    for (const b of h.split('<button type="button" class="po-choice').slice(1)) {
      const name = b.indexOf('po-choice__name');
      const risk = b.indexOf('po-risk');
      expect(name).toBeGreaterThan(-1);
      expect(risk).toBeGreaterThan(name);
    }
    expect(h).toContain('title="안전 구간 · 성공 50% 이상"');
    expect(h).toContain('title="도박 구간 · 성공 25% 미만"');
  });
  it('4번째(카드) 선택지는 플레이 카드를 고른 뒤에만 보인다', () => {
    const play = d.moment.cards.find((c) => c.option)!;
    const cm: Moment = { ...M, options: opts.slice(0, 3), cards: [play] };
    expect(rows(momentView({ ...vm, moment: cm }))).toHaveLength(3);
    const h = momentView({ ...vm, moment: cm, card: play.hand });
    expect(rows(h)).toHaveLength(4);
    expect(h).toContain('po-choice--play');
    const r = rows(h)[3]!;
    expect(r.ev).toBe(shownEv(play.option!));
  });
});

describe('C.81n 잠재력 범위 (B6)', () => {
  it('반폭: 17세 ±6 → 27세 이후 ±1, 나이가 들수록 좁아짐', () => {
    expect(potentialHalfWidth(16)).toBe(6);
    expect(potentialHalfWidth(17)).toBe(6);
    expect(potentialHalfWidth(27)).toBe(1);
    expect(potentialHalfWidth(33)).toBe(1);
    for (let a = 17; a < 30; a++) expect(potentialHalfWidth(a + 1)).toBeLessThanOrEqual(potentialHalfWidth(a));
  });
  it('실제 잠재력이 범위 안 · 지금 OVR 이상 · 한 값 아님 · 같은 시드 같은 값', () => {
    for (let i = 0; i < 300; i++) {
      const age = 15 + (i % 20);
      const tier = (['normal', 'special', 'topClass', 'worldClass', 'legendary'] as const)[i % 5]!;
      const p = { age, potentialTier: tier, ...(i % 3 === 0 ? { peakTarget: 70 + (i % 25) } : {}) };
      const ovr = 50 + (i % 40);
      const seed = `s${i}`;
      const real = truePotential(p, ovr, seed);
      const [lo, hi] = potentialRange(p, ovr, seed);
      expect(lo).toBeLessThanOrEqual(real);
      expect(hi).toBeGreaterThanOrEqual(real);
      expect(lo).toBeGreaterThanOrEqual(ovr);
      expect(hi).toBeGreaterThan(lo);
      expect(hi).toBeLessThanOrEqual(99);
      expect(hi - lo).toBeLessThanOrEqual(2 * potentialHalfWidth(age));
      expect(potentialRange(p, ovr, seed)).toEqual([lo, hi]);
    }
  });
  it('가상 유망주 실제 잠재력 = 티어의 NPC 전성기 구간 안 (지금 OVR 이 더 높으면 OVR)', () => {
    for (let i = 0; i < 50; i++) {
      const v = truePotential({ age: 17, potentialTier: 'topClass' }, 40, `t${i}`);
      expect(v).toBeGreaterThanOrEqual(BALANCE.npc.peakOvr.topClass[0]);
      expect(v).toBeLessThanOrEqual(BALANCE.npc.peakOvr.topClass[1]);
    }
  });
  it('선수 화면·홈 카드가 같은 "잠재력 lo~hi" 를 보인다 (새로고침해도 같음)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c81n', difficulty: 'normal' });
    const pv = playerVM(g);
    const hv = homeVM(g);
    expect(pv.potential).toMatch(/^\d+~\d+$/);
    expect(hv.card.potential).toBe(pv.potential);
    expect(playerVM(newGame({ mode: 'prospect', position: 'ST', seed: 'c81n', difficulty: 'normal' })).potential).toBe(pv.potential);
    const [lo] = pv.potential.split('~').map(Number);
    expect(lo).toBeGreaterThanOrEqual(playerOvr(g.player));
  });
});
