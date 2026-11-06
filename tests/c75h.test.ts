import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { CARDS, cardById, starterDeck } from '../src/config/cards';
import { groupOfPosition } from '../src/cardCollection';
import { MyMatchRun, playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { cardRole } from '../src/engine/cards';
import { newGame, roundMatch, selectableRealPlayers } from '../src/game';
import { posGroup } from '../src/roster';

const C = BALANCE.cards;

function input(id: string, seed: string) {
  const g = newGame({ mode: 'real', playerId: id, seed, difficulty: 'normal' });
  return roundMatch(g, { cards: false });
}

/** 시작 덱 + 그 포지션군·공용 카드(시그니처·지시 제외) 6장 = 확률·플레이·세트피스·반응 카드가 섞인 14장 */
function richDeck(position: string): string[] {
  const gr = groupOfPosition(position);
  const extra = CARDS.filter((c) => (c.group === gr || c.group === 'common') && c.kind !== 'signature' && c.kind !== 'directive').slice(0, 6);
  return [...starterDeck(gr).map((c) => c.id), ...extra.map((c) => c.id)];
}

describe('C.75h 카드·결정 순간 a1 (44g-a1)', () => {
  it('카드 강화: 확률 카드 × 1.5 (R5→8, R8→12, R10→15), 보너스 상한 0.20, 플레이 카드 변형은 그대로', () => {
    expect(C.bonusCap).toBe(0.2);
    expect(C.probMul).toBe(1.5);
    const val = (id: string) => cardById(id)!.effects.find((e) => e.type === 'probDelta' || e.type === 'nextSceneBonus') as { value: number };
    expect(val('calmFinish').value).toBeCloseTo(0.08, 6);
    expect(val('focus').value).toBeCloseTo(0.12, 6);
    expect(val('penSpecial').value).toBeCloseTo(0.15, 6);
    expect(val('momentum').value).toBeCloseTo(0.12, 6);
    expect(val('aerialCommand').value).toBeCloseTo(0.09, 6);
    // 부작용(체력 안배 드리블 −3%p)과 플레이 카드 변형 값은 그대로
    expect(val('pacing').value).toBeCloseTo(-0.03, 6);
    const elastico = cardById('elastico')!.effects.find((e) => e.type === 'addOption') as { probDelta: number };
    expect(elastico.probDelta).toBeCloseTo(0.1, 6);
  });

  it('자동 경기 결정 순간 카드 금지: 자동은 킥오프 패시브 장착만 (자동 표기), 결정 순간 카드 0', () => {
    expect(C.autoMoments).toBe(false);
    const p = selectableRealPlayers().find((x) => posGroup(x.position) === 'ST')!;
    const rm = input(p.id, `c75h-auto-${p.id}`);
    const deck = richDeck(p.position);
    const out = playMyMatch({ ...rm.input, cards: { deck } });
    const uses = out.engine.cards!.uses;
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.length).toBeLessThanOrEqual(C.passiveSlots);
    for (const u of uses) {
      expect(u.auto).toBe(true);
      expect(u.scene).toBe('kickoff');
      expect(cardRole(cardById(u.id)!)).toBe('passive');
    }
    expect(out.engine.cards!.passives).toEqual(uses.map((u) => u.id));
  });

  it('맡기기 = 자동: 카드 덱 있는 경기도 전부 맡기면 자동 경기와 같다 (모든 순간 정지·1대1 포함, 미해결 7)', () => {
    const pool = selectableRealPlayers();
    let stops = 0;
    for (const grp of ['ST', 'CM', 'CB']) {
      const p = pool.find((x) => posGroup(x.position) === grp)!;
      const rm = input(p.id, `c75h-del-${p.id}`);
      for (const deck of [starterDeck(groupOfPosition(p.position)).map((c) => c.id), richDeck(p.position)]) {
        const auto = playMyMatch({ ...rm.input, cards: { deck } });
        const del = playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'all', policy: () => 'delegate' } });
        stops += del.engine.decisions.length;
        expect(del.result.rating).toBe(auto.result.rating);
        expect(del.engine.homeGoals).toBe(auto.engine.homeGoals);
        expect(del.engine.awayGoals).toBe(auto.engine.awayGoals);
        expect(JSON.stringify(del.engine.teamStats)).toBe(JSON.stringify(auto.engine.teamStats));
      }
    }
    expect(stops).toBeGreaterThan(10);
  });

  it('판단 미끄러짐 (B안): 판단 0.7 이상은 0, 낮을수록 최대 0.25까지', () => {
    const S = ENGINE.moments.delegateSlip;
    const p = (j: number) => Math.min(S.max, Math.max(0, (S.max * (S.ref - j)) / S.ref));
    expect(S).toEqual({ ref: 0.7, max: 0.25 });
    expect(p(0.75)).toBe(0);
    expect(p(0.45)).toBeCloseTo(0.089, 3);
    expect(p(0)).toBe(0.25);
  });

  it('리셋 즉발: 장면 진행 없이 패만 바꾸고 다시 계산, 장면당 1번, 결정적 (같은 시드 같은 리셋 → 같은 패)', () => {
    const p = selectableRealPlayers().find((x) => posGroup(x.position) === 'CM')!;
    const rm = input(p.id, `c75h-reset-${p.id}`);
    // 리셋이 패에 일찍 오도록 리셋 위주 덱 (엔진은 덱 규칙을 보지 않는다)
    const deck = ['reset', 'reset', 'reset', 'reset', 'reset', 'curler', 'noLook', 'focus', 'composed', 'tempo', 'driveForward', 'earlyCross'];
    const play = () => {
      const run = new MyMatchRun({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'all' } });
      let m = run.advance();
      const seen: string[] = [];
      let resets = 0;
      while (m) {
        const r = m.cards.find((c) => c.role === 'redraw' && c.usable);
        if (r && resets < 3) {
          const s = run.sim.state;
          const t = s.t;
          const tick = s.tick;
          const before = [...s.cards!.hand];
          expect(run.resetNow(r.hand)).toBe(true);
          resets++;
          // 장면은 그대로, 패만 바뀌고 다시 계산된다 (리셋 카드는 빠지고 1장 버리고 1장)
          expect(s.t).toBe(t);
          expect(s.tick).toBe(tick);
          expect(run.pending).toBe(m);
          expect(s.cards!.hand.length).toBeLessThanOrEqual(before.length - 1);
          expect(m.cards.map((c) => c.id)).toEqual(s.cards!.hand);
          // 장면당 1번: 남은 리셋은 못 쓴다
          for (const c of m.cards) if (c.role === 'redraw') expect(c.usable).toBe(false);
          const again = m.cards.find((c) => c.role === 'redraw');
          if (again) expect(run.resetNow(again.hand)).toBe(false);
          seen.push(`${m.id}:${s.cards!.hand.join(',')}`);
          // 카드 1장 제한에 안 셈: 리셋 뒤에도 쓸 수 있는 카드를 골라 확정할 수 있다
          const use = m.cards.find((c) => c.usable && c.option);
          run.resolve(use ? { opt: 'card', card: use.hand } : 'delegate');
        } else run.resolve('delegate');
        m = run.advance();
      }
      const out = run.finish();
      return { seen, resets, rating: out.result.rating, uses: out.engine.cards!.uses.map((u) => u.id).join(',') };
    };
    const a = play();
    const b = play();
    expect(a.resets).toBeGreaterThan(0);
    expect(a).toEqual(b);
  });
});
