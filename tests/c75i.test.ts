import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { cardById, starterDeck } from '../src/config/cards';
import { judgeAttrs, playMyMatch, toMatchResult } from '../src/engine/adapter';
import { directiveReward, followCand, soloCand } from '../src/engine/directive';
import type { CardReport } from '../src/engine/cards';
import type { Moment, MomentChoice, MomentPolicy } from '../src/engine/moments';
import { bestChoice } from '../src/engine/moments';
import type { Candidate } from '../src/engine/onball';
import { newGame, roundMatch, selectableRealPlayers } from '../src/game';
import { ensureLife, lifeHints, lifeJudgePenalty } from '../src/life';
import { posGroup } from '../src/roster';
import { grantDirectives, initCollection, canAdd } from '../src/cardCollection';

const D = BALANCE.cards.directive;
const cand = (type: Candidate['type'], p: number, u: number, value: number): Candidate => ({ type, p, u, x: 0, y: 0, receiver: -1, value });
const report = (uses: { id: string; result: 'success' | 'fail' | 'neutral'; auto?: boolean }[]): CardReport => ({
  uses: uses.map((u) => ({ id: u.id, minute: 10, scene: 'shot', auto: u.auto ?? false, result: u.result })), drawn: 0, bonus: 0, hand: [], passives: [],
});

describe('C.75i 지시 카드 (F.4)', () => {
  it('지시 이행: 장당 신뢰 +1, 경기당 +3 까지 / 자동 사용은 세지 않는다', () => {
    expect(directiveReward(report([{ id: 'dirFollow', result: 'success' }]))!.trust).toBe(D.followTrust);
    const five = directiveReward(report(Array.from({ length: 5 }, () => ({ id: 'dirFollow', result: 'neutral' as const }))))!;
    expect(five.trust).toBe(D.followMax);
    expect(directiveReward(report([{ id: 'dirFollow', result: 'success', auto: true }]))).toBeNull();
    expect(directiveReward(report([{ id: 'focus', result: 'success' }]))).toBeNull();
  });

  it('독단: 성공 → 평점 +0.8·XP ×1.3, 실패 → 신뢰 −5, 판정 없음 → 보상 없음', () => {
    const ok = directiveReward(report([{ id: 'dirSolo', result: 'success' }]))!;
    expect(ok.rating).toBe(0.8);
    expect(ok.xpMul).toBe(1.3);
    expect(ok.trust).toBe(0);
    const bad = directiveReward(report([{ id: 'dirSolo', result: 'fail' }, { id: 'dirFollow', result: 'success' }]))!;
    expect(bad.trust).toBe(D.followTrust - D.soloFailTrust);
    expect(bad.rating).toBe(0);
    expect(bad.xpMul).toBe(1);
    expect(directiveReward(report([{ id: 'dirSolo', result: 'neutral' }]))).toBeNull();
  });

  it('후보: 지시 이행 = 효용 1위, 독단 = 개인 플레이 중 가치 최대 (효용 1위이면 없음)', () => {
    const pass = cand('pass', 0.8, 0.6, 0.3);
    const shot = cand('shoot', 0.12, 0.4, 0.12);
    const drib = cand('dribble', 0.45, 0.3, 0.5);
    expect(followCand([pass, shot, drib])).toBe(pass);
    expect(soloCand([pass, shot, drib])).toBe(drib);
    // 개인 플레이가 이미 효용 1위면 독단은 열리지 않는다
    expect(soloCand([cand('pass', 0.8, 0.2, 0.3), { ...drib, u: 0.9 }])).toBeNull();
    // 확실한 선택지(maxP 초과)는 보이지 않는다
    expect(followCand([cand('pass', 0.97, 0.9, 0.2), pass])).toBe(pass);
  });

  it('카드 3장 활성: 덱에 넣을 수 있고, 첫 경기 뒤 1장씩 받는다', () => {
    const col = initCollection('ST');
    for (const id of ['dirFollow', 'dirSolo', 'dirTrust']) expect(cardById(id)!.inactiveUntil).toBeUndefined();
    expect(grantDirectives(col)).toBe(3);
    expect(grantDirectives(col)).toBe(0);
    expect(canAdd(col, [], 'dirSolo')).toBeNull();
  });

  it('직접 모드 경기: 지시 카드 선택지 = 엔진 후보 그대로, 독단 성공 평점은 사후 가산, 감독의 신뢰는 신뢰 70 이상만', () => {
    const pool = selectableRealPlayers();
    const p = pool.find((x) => posGroup(x.position) === 'ST')!;
    const g = newGame({ mode: 'real', playerId: p.id, seed: `c75i-${p.id}`, difficulty: 'normal' });
    const rm = roundMatch(g, { cards: false });
    const deck = [...starterDeck('attack').map((c) => c.id), 'dirFollow', 'dirSolo', 'dirTrust', 'dirSolo', 'dirFollow'];
    let dirSeen = 0;
    let trustUsable = 0;
    const bot = (trust: number): MomentPolicy => (m: Moment): MomentChoice => {
      const dir = m.cards.find((c) => c.usable && (c.id === 'dirSolo' || c.id === 'dirFollow') && c.option);
      for (const c of m.cards) if (c.id === 'dirTrust' && c.usable) {
        trustUsable++;
        expect(trust).toBeGreaterThanOrEqual(D.trustMin);
      }
      if (dir) {
        dirSeen++;
        expect(dir.option!.kind).toBe('card');
        return { opt: 'card', card: dir.hand };
      }
      return bestChoice(m);
    };
    for (const trust of [50, 80]) {
      const out = playMyMatch({ ...rm.input, cards: { deck, trust }, control: { mode: 'direct', stop: 'all', policy: bot(trust) } });
      const r = directiveReward(out.engine.cards);
      const base = toMatchResult({ ...out.engine, cards: undefined }, out.side, rm.plan.started, 'normal');
      if (base.rating !== null) expect(out.result.rating).toBeCloseTo(Math.min(BALANCE.rating.max, base.rating + (r?.rating ?? 0)), 5);
      expect(out.result.xp).toBe(Math.round(base.xp * (r?.xpMul ?? 1)));
    }
    expect(dirSeen).toBeGreaterThan(0);
    expect(trustUsable).toBeGreaterThan(0);
    // 자동 경기: 지시 카드는 쓰지 않는다
    const auto = playMyMatch({ ...rm.input, cards: { deck, trust: 90 } });
    expect(auto.engine.cards!.uses.some((u) => u.id.startsWith('dir'))).toBe(false);
  });
});

describe('C.75i 판단 스탯 생활 영향', () => {
  it('정신 상태(100 − 멘탈 피로) 40 미만 비례, 외국인은 적응도도, 합 상한 −5, 힌트 문장', () => {
    const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: 'c75i-life', difficulty: 'normal' });
    const l = ensureLife(g);
    l.mental = 30;
    l.adapt = 90;
    expect(lifeJudgePenalty(g)).toBe(0);
    expect(lifeHints(g).some((h) => h.startsWith('집중이 흐트러져요'))).toBe(false);
    l.mental = 70;
    expect(lifeJudgePenalty(g)).toBe(Math.round(10 * BALANCE.life.judge.per * 10) / 10);
    expect(lifeHints(g).some((h) => h.startsWith('집중이 흐트러져요'))).toBe(true);
    l.mental = 100;
    l.adapt = 0;
    g.player.nationality = 'Brazil';
    expect(lifeJudgePenalty(g)).toBe(BALANCE.life.judge.max);
    g.player.nationality = 'England';
    l.mental = 30;
    expect(lifeJudgePenalty(g)).toBe(0);
    const attrs = { ...g.player.attributes, vision: 70, composure: 3 };
    const out = judgeAttrs(attrs, 5);
    expect(out.vision).toBe(65);
    expect(out.composure).toBe(1);
    expect(out.shooting).toBe(attrs.shooting);
    expect(judgeAttrs(attrs, 0)).toBe(attrs);
  });

  it('엔진 입력: 생활 페널티가 있으면 내 선수 시야·침착성만 낮아진다', () => {
    const g = newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed: 'c75i-life2', difficulty: 'normal' });
    ensureLife(g).mental = 100;
    const rm = roundMatch(g, { cards: false });
    expect(rm.input.me.judgePen).toBe(lifeJudgePenalty(g));
    ensureLife(g).mental = 20;
    expect(roundMatch(g, { cards: false }).input.me.judgePen).toBeUndefined();
  });
});
