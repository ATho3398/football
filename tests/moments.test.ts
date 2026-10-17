import { describe, expect, it } from 'vitest';
import { CARDS, starterDeck } from '../src/config/cards';
import { MyMatchRun, playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { SCENE_LABEL, type MomentPolicy, type SceneId } from '../src/engine/moments';
import { ATTACK_MAX, customProblem, presetCells } from '../src/formations';
import { newGame, playRound, roundMatch, selectableRealPlayers, type GameState } from '../src/game';
import { posGroup } from '../src/roster';
import { migrate } from '../src/save';

function game(group: string, seed = 'mom'): GameState {
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === group)!;
  return newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' });
}

/** 선발로 뛰는 라운드까지 진행 */
function startedRound(g: GameState) {
  for (let k = 0; k < 6; k++) {
    // 카드 없이 (C.34 결정 순간 규칙 확인용, 카드는 tests/cards.test.ts)
    const rm = roundMatch(g, { cards: false });
    if (rm.plan.started) return rm;
    playRound(g);
  }
  throw new Error('선발 경기 없음');
}

const delegate: MomentPolicy = () => 'delegate';

describe('결정 순간 (E.11, C.34)', () => {
  it('맡기기만 하면 자동 경기와 같다 (같은 시드, 결정성)', () => {
    const g = game('WING');
    const rm = startedRound(g);
    const auto = playMyMatch(rm.input);
    const del = playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'all', policy: delegate } });
    expect(del.engine.decisions.length).toBeGreaterThan(0);
    expect(del.engine.homeGoals).toBe(auto.engine.homeGoals);
    expect(del.engine.awayGoals).toBe(auto.engine.awayGoals);
    expect(del.result.rating).toBe(auto.result.rating);
    expect(del.my?.distance).toBe(auto.my?.distance);
  });

  it('직접 모드: 멈춘 순간에 선택지 1~3개(안전/균형/도박), 확률 0~1, 같은 선택이면 같은 결과', () => {
    const g = game('ST');
    const rm = startedRound(g);
    const play = () => {
      const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'important' } }, { teams: ['A', 'B'] });
      const seen: string[] = [];
      let m = run.advance();
      let k = 0;
      while (m) {
        expect(m.options.length).toBeGreaterThanOrEqual(1);
        expect(m.options.length).toBeLessThanOrEqual(3);
        expect(new Set(m.options.map((o) => o.kind)).size).toBe(m.options.length);
        for (const o of m.options) if (o.p !== null) expect(o.p).toBeGreaterThanOrEqual(0), expect(o.p).toBeLessThanOrEqual(1);
        expect(SCENE_LABEL[m.scene]).toBeTruthy();
        seen.push(`${m.minute}:${m.scene}`);
        // 번갈아 도박 / 맡기기
        run.resolve(k++ % 2 === 0 ? m.options.length - 1 : 'delegate');
        m = run.advance();
      }
      const out = run.finish();
      return { seen, out };
    };
    const a = play();
    const b = play();
    expect(a.seen.length).toBeGreaterThanOrEqual(1);
    expect(a.seen.length).toBeLessThanOrEqual(ENGINE.moments.maxStops);
    expect(b.seen).toEqual(a.seen);
    expect(b.out.result.rating).toBe(a.out.result.rating);
    expect(a.out.engine.decisions.length).toBe(a.seen.length);
    expect(a.out.replay?.frames.length).toBeGreaterThan(100);
    for (let i = 1; i < a.out.replay!.frames.length; i++) expect(a.out.replay!.frames[i]!.e).toBeGreaterThan(a.out.replay!.frames[i - 1]!.e);
  });

  it('정지 빈도: 모든 순간 ≥ 결정적 순간만, 자동 모드는 멈추지 않는다', () => {
    const g = game('CM');
    const rm = startedRound(g);
    const n = (stop: 'all' | 'important' | 'critical') => playMyMatch({ ...rm.input, control: { mode: 'direct', stop, policy: delegate } }).engine.decisions.length;
    expect(n('all')).toBeGreaterThanOrEqual(n('critical'));
    expect(playMyMatch({ ...rm.input, control: { mode: 'auto', stop: 'all', policy: delegate } }).engine.decisions.length).toBe(0);
  });

  it('화면에서 진행한 경기 결과를 그대로 라운드에 쓴다 (다시 계산하지 않는다)', () => {
    const g1 = game('CB', 'same');
    const g2 = game('CB', 'same');
    const rm = roundMatch(g1);
    const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'important' } });
    while (run.advance()) run.resolve('delegate');
    const r1 = playRound(g1, { engineOut: run.finish() });
    const r2 = playRound(g2);
    expect(r1.result).toEqual(r2.result);
    expect(g1.player.fatigue).toBe(g2.player.fatigue);
  });
});

describe('카드 데이터 76장 (F.4, C.34)', () => {
  it('76장: 공용 18 + 포지션군 24 + 시그니처 31 + 지시 3, id 중복 없음', () => {
    expect(CARDS.length).toBe(76);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(76);
    expect(CARDS.filter((c) => c.kind === 'signature').length).toBe(31);
    expect(CARDS.filter((c) => c.kind === 'directive').length).toBe(3);
    for (const g of ['attack', 'midfield', 'defense'] as const) expect(CARDS.filter((c) => c.group === g).length).toBe(8);
  });

  it('포지션군마다 플레이 카드 4장 이상, 시작 덱 8장 (요건 60 이하), 장면 id 는 E.11 목록 안', () => {
    for (const g of ['attack', 'midfield', 'defense'] as const) {
      expect(CARDS.filter((c) => c.group === g && c.kind === 'play').length).toBeGreaterThanOrEqual(4);
      const deck = starterDeck(g);
      expect(deck.length).toBe(8);
      for (const c of deck) for (const v of Object.values(c.requires)) expect(v).toBeLessThanOrEqual(60);
    }
    const scenes = new Set(Object.keys(SCENE_LABEL) as SceneId[]);
    for (const c of CARDS) for (const s of c.scenes) expect(scenes.has(s)).toBe(true);
    expect(CARDS.filter((c) => c.rarity === 'epic').map((c) => c.name).sort()).toEqual(['라보나 크로스', '엘라스티코', '파넨카'].sort());
    expect(CARDS.filter((c) => c.rarity === 'legendary').map((c) => c.name)).toEqual(['바이시클 킥']);
  });
});

describe('커스텀 포메이션 공격 줄 최대 4명 (C.34 임시 규칙)', () => {
  it('공격 줄 5명 이상은 놓을 수 없고, 옛 세이브의 그런 대형은 프리셋으로 되돌린다', () => {
    const c = presetCells('4-3-3');
    // 중원 셋을 2선 공격 칸으로 → 공격 6명
    const mids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((i) => c[i]! >= 10 && c[i]! < 20).slice(0, 3);
    const free = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29].filter((x) => !c.includes(x));
    const heavy = c.map((x, i) => (mids.includes(i) ? free[mids.indexOf(i)]! : x));
    expect(heavy.slice(1).filter((x) => x >= 20).length).toBeGreaterThan(ATTACK_MAX);
    expect(customProblem(heavy)).toContain('공격 줄은 4명까지');
    const g = game('ST', 'mig');
    const raw = JSON.parse(JSON.stringify({ ...g, rosters: undefined }));
    raw.saveFormat = 13;
    delete raw.control;
    raw.tactics = { ...raw.tactics, custom: heavy };
    const s = migrate(raw);
    expect(s.control).toEqual({ mode: 'direct', stop: 'important' });
    expect(s.tactics.custom).toBeNull();
  });
});
