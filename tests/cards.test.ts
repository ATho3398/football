import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { CARDS, cardById, starterDeck } from '../src/config/cards';
import { afterMatch, canAdd, cardInput, deckProblems, grantLevelPicks, grantSeasonPick, initCollection, takePick } from '../src/cardCollection';
import { MyMatchRun, playMyMatch } from '../src/engine/adapter';
import { bandKind, bestChoice, type MomentPolicy } from '../src/engine/moments';
import { ENGINE } from '../src/engine/config';
import { newGame, playRound, roundMatch, selectableRealPlayers, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { posGroup } from '../src/roster';
import { deserialize, migrate, serialize } from '../src/save';

const C = BALANCE.cards;

function game(group: string, seed = 'cards'): GameState {
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === group)!;
  return newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' });
}

function startedRound(g: GameState) {
  for (let k = 0; k < 8; k++) {
    const rm = roundMatch(g);
    if (rm.plan.started) return rm;
    playRound(g);
  }
  throw new Error('선발 경기 없음');
}

const strip = (o: ReturnType<typeof playMyMatch>) => JSON.stringify([o.engine.homeGoals, o.engine.awayGoals, o.engine.players.map((p) => [p.id, p.rating, p.distance]), o.engine.events.length, o.engine.decisions.length]);

describe('카드 효과 엔진 (부록 F, C.36)', () => {
  it('빈 덱 = 카드 없음: 자동·맡기기 결과가 카드 없는 경기와 완전히 같다 (회귀 가드)', () => {
    const g = game('CM');
    const rm = startedRound(g);
    const { cards: _c, ...plain } = rm.input;
    const none = playMyMatch(plain);
    const empty = playMyMatch({ ...plain, cards: { deck: [] } });
    expect(strip(empty)).toBe(strip(none));
    expect(empty.engine.cards).toBeUndefined();
    const del = playMyMatch({ ...plain, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
    expect(del.engine.homeGoals).toBe(none.engine.homeGoals);
    expect(del.result.rating).toBe(none.result.rating);
  });

  it('결정성: 같은 시드·덱·선택이면 같은 결과 (자동, 직접 봇)', () => {
    const g = game('ST');
    const rm = startedRound(g);
    const deck = starterDeck('attack').map((c) => c.id);
    const a1 = playMyMatch({ ...rm.input, cards: { deck } });
    const a2 = playMyMatch({ ...rm.input, cards: { deck } });
    expect(strip(a1)).toBe(strip(a2));
    expect(JSON.stringify(a1.engine.cards)).toBe(JSON.stringify(a2.engine.cards));
    const bot: MomentPolicy = (m) => bestChoice(m);
    const b1 = playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'important', policy: bot } });
    const b2 = playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'important', policy: bot } });
    expect(strip(b1)).toBe(strip(b2));
  });

  it('패/드로우 규칙: 시작 4장, 15분마다 1장, 보너스 최대 3, 패 최대 6, 플레이 카드는 소모, 패시브 2개', () => {
    const g = game('WING');
    const rm = startedRound(g);
    const deck = [...starterDeck('attack').map((c) => c.id), 'chip', 'elastico', 'momentum', 'aerialCommand', 'pacing', 'nearPost'];
    for (const control of [undefined, { mode: 'direct' as const, stop: 'all' as const, policy: (m: Parameters<MomentPolicy>[0]) => bestChoice(m, 0) }]) {
      const o = playMyMatch({ ...rm.input, cards: { deck }, ...(control ? { control } : {}) });
      const r = o.engine.cards!;
      const minutes = (rm.plan.minutes!.end - rm.plan.minutes!.start);
      expect(r.drawn).toBeLessThanOrEqual(Math.min(deck.length, C.startHand + Math.ceil((minutes + 8) / 15) + r.bonus));
      expect(r.drawn).toBeGreaterThanOrEqual(C.startHand);
      expect(r.bonus).toBeLessThanOrEqual(C.bonusDraws);
      expect(r.hand.length).toBeLessThanOrEqual(C.handMax);
      expect(r.passives.length).toBeLessThanOrEqual(C.passiveSlots);
      // 같은 카드는 덱 장수만큼만 쓴다 (한 경기에서 소모)
      const n: Record<string, number> = {};
      for (const u of r.uses) n[u.id] = (n[u.id] ?? 0) + 1;
      for (const [id, k] of Object.entries(n)) expect(k).toBeLessThanOrEqual(deck.filter((x) => x === id).length);
      expect(r.uses.length).toBeGreaterThan(0);
    }
  });

  it('결정 순간 패: 카드마다 쓸 수 있는지·이유, 플레이 카드는 4번째 선택지, 확률 카드는 선택지별 %p, 보너스 +15%p 이내', () => {
    const g = game('ST');
    const rm = startedRound(g);
    const deck = [...starterDeck('attack').map((c) => c.id), 'chip', 'nearPost', 'elastico', 'rabona', 'divingHeader'];
    const run = new MyMatchRun({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'all' } }, { teams: ['A', 'B'] });
    let m = run.advance();
    let checked = 0;
    let play = 0;
    let boost = 0;
    while (m) {
      if (m.type === 'halftime') {
        run.halftime(null);
        m = run.advance();
        continue;
      }
      for (const c of m.cards) {
        expect(cardById(c.id)).toBeTruthy();
        if (!c.usable) expect(c.reason).toBeTruthy();
        if (c.option) {
          play++;
          expect(c.option.kind).toBe('card');
          // 바탕 행동(카드 없이)보다 +15%p 넘게 오르지 않는다 (슛은 유효 슈팅 %p 상한이라 골 확률로는 더 작다)
          if (c.option.baseP !== undefined && c.option.p !== null) expect(c.option.p - c.option.baseP).toBeLessThanOrEqual(C.bonusCap + 0.011);
        }
        if (c.deltas) {
          boost++;
          expect(c.deltas.length).toBe(m.options.length);
          for (const d of c.deltas) expect(d).toBeLessThanOrEqual(C.bonusCap + 1e-9);
        }
      }
      checked++;
      run.resolve(bestChoice(m, 0));
      m = run.advance();
    }
    const out = run.finish();
    expect(checked).toBeGreaterThan(3);
    expect(play + boost).toBeGreaterThan(0);
    expect(out.engine.decisions.some((d) => d.card)).toBe(true);
  });

  it('자동 경기 카드 규칙 (F.5, C.75h 개정): 자동 모드는 킥오프 패시브 장착만, 직접 모드에서 맡기기만 하면 자동과 같다', () => {
    const g = game('CB');
    const rm = startedRound(g);
    const deck = starterDeck('defense').map((c) => c.id);
    const auto = playMyMatch({ ...rm.input, cards: { deck } });
    expect(auto.engine.cards!.uses.length).toBeGreaterThan(0);
    expect(auto.engine.cards!.uses.every((u) => u.auto && u.scene === 'kickoff')).toBe(true);
    const del = playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
    // 결정 순간 카드(반응 카드 포함)는 맡기면 쓰지 않는다: 쓴 카드 = 자동과 같은 킥오프 패시브
    expect(del.engine.cards!.uses).toEqual(auto.engine.cards!.uses);
  });

  // 기준(automation 2번 ⑤ "경기 계산 2초")은 경기 한 번 단위 (C.63): 준비(새 게임·선발 라운드 찾기)는 재지 않고, 첫 경기(냉시작 — 모듈 로드·JIT)는
  // 따로 재서 표시만 한다. 판정은 데운 뒤 자동·직접 경기 하나씩
  it('경기 계산 2초 이하 (카드 자동·봇, 경기 한 번 단위)', () => {
    const g = game('CAM');
    const rm = startedRound(g);
    const deck = starterDeck('attack').map((c) => c.id);
    const time = (f: () => unknown) => { const t = performance.now(); f(); return Math.round(performance.now() - t); };
    const auto = () => playMyMatch({ ...rm.input, cards: { deck } });
    const direct = () => playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'important', policy: (m) => bestChoice(m) } });
    const cold = time(auto);
    const a = time(auto);
    const d = time(direct);
    console.info(`[2초 테스트] 냉시작 ${cold}ms (표시만) · 자동 ${a}ms · 직접 ${d}ms`);
    expect(a).toBeLessThan(2000);
    expect(d).toBeLessThan(2000);
  });
});

describe('덱과 카드 모음 (F.1·F.3, I.17 9번)', () => {
  it('시작 덱: 포지션군별 일반 8장, 덱 세트 3개, 요건 60 이하', () => {
    for (const [pos, grp] of [['ST', 'attack'], ['CM', 'midfield'], ['CB', 'defense']] as const) {
      const col = initCollection(pos);
      expect(col.decks).toHaveLength(C.deckSets);
      for (const d of col.decks) expect(d).toEqual(starterDeck(grp).map((c) => c.id));
      expect(deckProblems(col.decks[0]!)).toEqual([]);
      for (const id of col.decks[0]!) {
        const c = cardById(id)!;
        expect(c.rarity).toBe('common');
        for (const v of Object.values(c.requires)) expect(v).toBeLessThanOrEqual(60);
      }
    }
  });

  it('덱 규칙: 8~14장, 같은 카드 2장, 세트피스 3장, 가진 장수만큼', () => {
    expect(deckProblems(['focus'])).not.toEqual([]);
    const col = initCollection('ST');
    const deck = [...col.decks[0]!];
    expect(canAdd(col, deck, 'focus')).toBe('가진 장수를 다 넣었어요');
    col.owned.focus = 2;
    expect(canAdd(col, deck, 'focus')).toBeNull();
    deck.push('focus');
    col.owned.focus = 3;
    expect(canAdd(col, deck, 'focus')).toBe(`같은 카드는 ${C.maxCopies}장까지예요`);
    for (const id of ['penSpecial', 'fkCross', 'spDefense', 'panenka']) col.owned[id] = 1;
    const d2 = [...deck, 'penSpecial', 'fkCross', 'spDefense'];
    expect(canAdd(col, d2, 'panenka')).toBe(`세트피스는 ${C.maxSetPiece}장까지예요`);
    expect(deckProblems([...d2, 'panenka'])).toContain(`세트피스 카드는 ${C.maxSetPiece}장까지예요`);
    // 엔진 입력은 규칙에 맞게 자른다
    col.decks[0] = [...d2, 'panenka'];
    expect(cardInput(col).deck.filter((id) => cardById(id)!.kind === 'setPiece').length).toBe(C.maxSetPiece);
  });

  it('간이 획득 (F.1): 레벨 5마다 일반 3택 1, 시즌 종료 희귀·에픽 3택 1, 역할 10경기 → 시그니처 해금', () => {
    const col = initCollection('CM');
    grantLevelPicks(col, 12, 'CM', 'seed');
    expect(col.picks.map((p) => p.label)).toEqual(['레벨 5 달성', '레벨 10 달성']);
    for (const p of col.picks) for (const id of p.options) expect(cardById(id)!.rarity).toBe('common');
    grantLevelPicks(col, 12, 'CM', 'seed');
    expect(col.picks).toHaveLength(2);
    grantSeasonPick(col, 2026, 'CM', 'seed');
    const sp = col.picks.at(-1)!;
    expect(sp.options).toHaveLength(3);
    for (const id of sp.options) expect(['rare', 'epic']).toContain(cardById(id)!.rarity);
    const id = takePick(col, 2, 0)!;
    expect(col.owned[id]).toBe(1);
    expect(col.fresh).toContain(id);
    let unlocked: string | null = null;
    for (let k = 0; k < C.signatureUnlock; k++) unlocked = afterMatch(col, { uses: [{ id: 'focus', minute: 3, scene: 'shot', auto: true, result: 'success' }], drawn: 4, bonus: 0, hand: [], passives: [] }, 'deepPlaymaker', true) ?? unlocked;
    expect(unlocked).toBe('sig-deepPlaymaker');
    expect(col.owned['sig-deepPlaymaker']).toBe(1);
    expect(col.mastery.focus).toBe(C.signatureUnlock);
  });

  it('카드 데이터만으로 동작: 76장 모두 효과 스키마가 있고, 시그니처 31장은 역할 조건 + 4번째 선택지', () => {
    expect(CARDS).toHaveLength(76);
    for (const c of CARDS) expect(c.effects.length).toBeGreaterThan(0);
    for (const c of CARDS.filter((x) => x.kind === 'signature')) {
      expect(c.effects.some((e) => e.type === 'roleOnly')).toBe(true);
      expect(c.effects.some((e) => e.type === 'addOption')).toBe(true);
    }
    // 포지션군마다 플레이 카드 4장 이상 (수비 포함)
    for (const g of ['attack', 'midfield', 'defense'] as const) expect(CARDS.filter((c) => c.group === g && c.effects.some((e) => e.type === 'addOption')).length).toBeGreaterThanOrEqual(4);
  });

  it('세이브 15 → 16: 카드 모음이 생기고 (시작 덱), 저장·불러오기 그대로', () => {
    expect(SAVE_FORMAT_VERSION).toBe(47);
    const g = game('ST', 'cards-mig');
    g.player.level = 7;
    const raw = JSON.parse(serialize(g));
    delete raw.cards;
    raw.saveFormat = 15;
    const back = migrate(raw);
    expect(back.cards.decks[0]).toEqual(starterDeck('attack').map((c) => c.id));
    expect(back.cards.levelMark).toBe(5);
    const again = deserialize(serialize(back));
    expect(again.cards).toEqual(back.cards);
  });

  it('경기를 치르면 숙련도가 쌓이고 결과 보고에 쓴 카드가 남는다', () => {
    const g = game('CM', 'cards-play');
    let used = 0;
    for (let k = 0; k < 4; k++) {
      const rep = playRound(g);
      used += rep.cardUses?.length ?? 0;
    }
    expect(used).toBeGreaterThan(0);
    expect(Object.values(g.cards.mastery).reduce((a, b) => a + b, 0)).toBe(used);
  });
});

describe('결정 순간 개선 (C.40, pending 39 5항)', () => {
  it('직접 모드 정지: 판정 있는 선택지는 모두 90% 이하, 안전/균형/도박은 성공 확률 순, 고를 거리(선택지 2개 이상 또는 카드)가 있다', () => {
    const g = game('WING', 'c40');
    const rm = startedRound(g);
    const seen: Parameters<MomentPolicy>[0][] = [];
    const pol: MomentPolicy = (m) => {
      seen.push(m);
      return 'delegate';
    };
    playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'all', policy: pol } });
    expect(seen.length).toBeGreaterThan(0);
    for (const m of seen) {
      if (m.type === 'setPiece') continue;
      // 90% 초과는 빠진다 — C.75v 확실한 선택지 다시 넣기(sureBack)면 맨 위 1개만
      if (m.type !== 'react') m.options.forEach((o, i) => { if (o.p !== null && !(m.sureBack && i === 0)) expect(o.p).toBeLessThanOrEqual(ENGINE.moments.maxP + 1e-9); });
      const judged = m.options.filter((o) => o.p !== null);
      expect(judged.length >= 1 && m.options.length >= 2 || m.cards.some((c) => c.usable && (c.option || c.deltas))).toBe(true);
      if (m.type === 'onball') {
        // 확률 순 (몰고 가다 슛은 맨 끝), 라벨 = 확률 구간 (C.75v)
        const ps = m.options.filter((o) => !o.chain).map((o) => o.p!);
        expect([...ps].sort((a, b) => b - a)).toEqual(ps);
        for (const o of m.options) expect(o.kind).toBe(bandKind(o.p));
      }
    }
  });

  it('최소 정지 보장 없음: "결정적 순간만"은 0회 경기도 된다, 자동 모드는 멈추지 않는다', () => {
    const counts: number[] = [];
    for (const grp of ['CDM', 'FB']) {
      const g = game(grp, 'c40-zero');
      const rm = startedRound(g);
      counts.push(playMyMatch({ ...rm.input, cards: { deck: [] }, control: { mode: 'direct', stop: 'critical', policy: () => 'delegate' } }).engine.decisions.length);
      expect(playMyMatch({ ...rm.input, control: { mode: 'auto', stop: 'all', policy: () => 'delegate' } }).engine.decisions.length).toBe(0);
    }
    expect(Math.min(...counts)).toBeLessThan(4);
  });

  it('카드 장면 정지(공중볼·상대 슈팅·코너): 반응 카드가 패에 있을 때만, "카드 없이"를 고르면 그 카드를 쓰지 않는다', () => {
    const g = game('CB', 'c40-react');
    const rm = startedRound(g);
    const deck = starterDeck('defense').map((c) => c.id);
    const reacts: Parameters<MomentPolicy>[0][] = [];
    const out = playMyMatch({
      ...rm.input, cards: { deck },
      control: { mode: 'direct', stop: 'important', policy: (m) => {
        if (m.type !== 'react') return 'delegate';
        reacts.push(m);
        return 0;
      } },
    });
    expect(reacts.length).toBeGreaterThan(0);
    for (const m of reacts) {
      expect(['aerial', 'corner', 'oppShot', 'oppCorner', 'oppFreeKick']).toContain(m.scene);
      expect(m.options.length).toBe(1);
      expect(m.cards.some((c) => c.usable && c.option)).toBe(true);
    }
    // "카드 없이"만 골랐으면 반응 카드(몸으로 막기·세트피스 가담 헤더)는 정지한 장면에서 쓰이지 않는다
    const reactUses = (out.engine.cards?.uses ?? []).filter((u) => u.id === 'bodyBlock' || u.id === 'spHeader');
    for (const u of reactUses) expect(reacts.some((m) => m.minute === u.minute && m.scene === u.scene)).toBe(false);
    // 카드 없는 경기는 카드 장면에서 멈추지 않는다
    const none = playMyMatch({ ...rm.input, cards: { deck: [] }, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
    expect(none.engine.decisions.some((d) => ['aerial', 'corner', 'oppShot', 'oppCorner', 'oppFreeKick'].includes(d.scene))).toBe(false);
  });

  it('카드 장면 맡기기 = 지금 규칙(조건 맞는 첫 장 자동), 같은 선택이면 같은 결과', () => {
    const g = game('CB', 'c40-react');
    const rm = startedRound(g);
    const deck = starterDeck('defense').map((c) => c.id);
    const run = (pick: (m: Parameters<MomentPolicy>[0]) => ReturnType<MomentPolicy>) =>
      strip(playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'important', policy: pick } }));
    const card: MomentPolicy = (m) => {
      if (m.type !== 'react') return 'delegate';
      const c = m.cards.find((x) => x.usable && x.option)!;
      return { opt: 'card', card: c.hand };
    };
    expect(run(card)).toBe(run(card));
    expect(run(() => 'delegate')).toBe(run(() => 'delegate'));
  });
});
