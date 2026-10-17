import { describe, expect, it } from 'vitest';
import { decisionOutcome, OUTCOME, outcomeBand } from '../src/decisionOutcome';
import { MyMatchRun } from '../src/engine/adapter';
import type { MatchEvent } from '../src/engine/types';
import { newGame, playRound, roundMatch, selectableRealPlayers, type GameState } from '../src/game';
import { HL, selectScenes } from '../src/highlights';
import { replayPlayers, type ReplayFrame, type ReplayPlayer } from '../src/replay';
import { posGroup } from '../src/roster';

const P = (id: string, team: 0 | 1, isMe = false): ReplayPlayer => ({ id, name: id.toUpperCase(), team, number: 1, position: 'CM', isMe, gk: false });
const players = [P('me', 0, true), P('mate', 0), P('opp', 1), P('gk', 1)];
const F = (e: number, carrier: string | null, extra: Partial<ReplayFrame> = {}): ReplayFrame => ({ e, t: e, ball: { x: 50, y: 34, z: 0 }, carrier, players: [], ...extra });
const ev = (t: number, type: MatchEvent['type'], team: 0 | 1, ps: string[], params?: MatchEvent['params']): MatchEvent => ({ t, type, team, players: ps, ...(params ? { params } : {}) });

describe('결정 결과 구간 (E5 최소, C.35)', () => {
  it('패스가 끊기면 소유가 바뀐 곳에서 끝난다', () => {
    const frames = [F(10, 'me'), F(10.5, null), F(11, null), F(11.5, 'opp'), F(12, 'opp'), F(20, 'opp')];
    const o = decisionOutcome({ frames, startIdx: 0, events: [], players, type: 'onball', action: 'pass', side: 0 });
    expect(o.steps).toEqual(['패스 차단']);
    expect(o.end).toBe('turnover');
    expect(o.from).toBe(10);
    expect(o.to).toBeCloseTo(11.5 + OUTCOME.tail, 5);
  });

  it('돌파 → 슈팅 → 선방', () => {
    const frames = [F(10, 'me'), F(11, 'me'), F(12, 'me'), F(12.5, null), F(13, null), F(14, 'gk')];
    const events = [ev(12.4, 'shot', 0, ['me'], { onTarget: 1, xg: 0.2 }), ev(12.9, 'save', 1, ['gk', 'me'])];
    const o = decisionOutcome({ frames, startIdx: 0, events, players, type: 'onball', action: 'dribble', side: 0 });
    expect(o.steps).toEqual(['돌파 성공', '슈팅', '선방']);
    expect(o.end).toBe('shot');
  });

  it('패스 연결 → 동료 골, 띠는 골', () => {
    const frames = [F(10, 'me'), F(11, null), F(11.5, 'mate'), F(13, 'mate'), F(13.5, null), F(14, null), F(20, null)];
    const events = [ev(13.4, 'shot', 0, ['mate'], { onTarget: 1 }), ev(13.9, 'goal', 0, ['mate', 'me'], { home: 1, away: 0 })];
    const o = decisionOutcome({ frames, startIdx: 0, events, players, type: 'onball', action: 'through', side: 0 });
    expect(o.steps).toEqual(['패스 연결 → MATE', '슈팅', '골!']);
    expect(o.goal).toBe(0);
    expect(o.to).toBeCloseTo(14 + OUTCOME.goalTail, 5);
    expect(outcomeBand(o, undefined, 0).tone).toBe('goal');
  });

  it('결과가 없으면 최대 6초', () => {
    const frames = Array.from({ length: 100 }, (_, i) => F(10 + i * 0.5, 'me'));
    const o = decisionOutcome({ frames, startIdx: 0, events: [], players, type: 'onball', action: 'carry', side: 0 });
    expect(o.to).toBe(10 + OUTCOME.maxSpan);
    expect(o.steps).toEqual(['돌파 성공']);
    expect(o.end).toBe('timeout');
  });

  it('수비 1대1: 내가 뺏으면 태클 성공', () => {
    const frames = [F(10, 'opp'), F(10.5, 'opp'), F(11, 'me')];
    const o = decisionOutcome({ frames, startIdx: 0, events: [], players, type: 'duel', action: 'tackle', side: 0 });
    expect(o.steps).toEqual(['태클 성공']);
    expect(o.end).toBe('turnover');
  });

  it('공이 나가면 리스타트에서 끝난다', () => {
    const frames = [F(10, 'me'), F(11, null), F(12, null, { restart: 'throwIn' })];
    const o = decisionOutcome({ frames, startIdx: 0, events: [], players, type: 'onball', action: 'cross', side: 0 });
    expect(o.steps).toEqual(['크로스 → 스로인']);
    expect(o.end).toBe('dead');
  });

  it('실제 경기: 결정마다 구간이 결정 시점에서 시작해 6초(골이면 골 프레임까지) 안, 하이라이트에 결정 장면', () => {
    const p = selectableRealPlayers().find((x) => posGroup(x.position) === 'ST')!;
    const g: GameState = newGame({ mode: 'real', playerId: p.id, seed: `oc-${p.id}`, difficulty: 'normal' });
    let rm = roundMatch(g);
    for (let k = 0; k < 6 && !rm.plan.started; k++) {
      playRound(g);
      rm = roundMatch(g);
    }
    const run = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'all' } }, { teams: ['A', 'B'] });
    const s = run.sim.state;
    const ps = replayPlayers(s.input.home, s.input.away);
    let m = run.advance();
    let n = 0;
    let k = 0;
    while (m) {
      const startIdx = run.frames.length - 1;
      const e0 = run.frames[startIdx]!.e;
      const ev0 = s.events.length;
      const choice = k++ % 3 === 2 ? 'delegate' : k % m.options.length;
      const opt = choice === 'delegate' ? null : m.options[choice]!;
      run.resolve(choice);
      const next = run.advance();
      const o = decisionOutcome({ frames: run.frames, startIdx, events: s.events.slice(ev0), players: ps, type: m.type === 'react' ? 'duel' : m.type, action: opt?.action ?? null, side: m.side });
      expect(o.from).toBe(e0);
      expect(o.to).toBeGreaterThanOrEqual(o.from);
      expect(o.to - o.from).toBeLessThanOrEqual(OUTCOME.maxSpan + OUTCOME.goalTail + 1e-6);
      expect(o.steps.length).toBeGreaterThan(0);
      const rec = s.moments.log.find((r) => r.id === m!.id)!;
      expect(rec).toBeTruthy();
      expect(outcomeBand(o, rec, m.side).flow.length).toBeGreaterThan(0);
      n++;
      m = next;
    }
    expect(n).toBeGreaterThanOrEqual(3);
    const out = run.finish();
    const scenes = selectScenes(out.replay!);
    const dec = scenes.filter((x) => x.kind === 'decision');
    expect(dec.length).toBeGreaterThan(0);
    expect(dec.length).toBeLessThanOrEqual(HL.maxDecisions);
    expect(scenes.length).toBeLessThanOrEqual(HL.maxScenes);
  });
});
