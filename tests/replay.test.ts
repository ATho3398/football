import { describe, expect, it } from 'vitest';
import { playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { eventsUntil, frameAt, interpolateFrame, scoreAt, type ReplayFrame } from '../src/replay';
import { createTeamRoster } from '../src/roster';

const my = createTeamRoster({ id: 'h', rating: 75 }, 'rp-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 75 }, 'rp-a', 2018, []);
const match = (capture: boolean) => playMyMatch({
  myRoster: my, oppRoster: opp, myRating: 75, oppRating: 75, home: true,
  me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
  plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed: 77, worldSeed: 'rp',
}, capture ? { teams: ['홈', '원정'] } : undefined);

describe('E5-lite 경기 재생 (24번, E.13)', () => {
  const plain = match(false);
  const cap = match(true);
  const r = cap.replay!;
  it('프레임을 기록해도 결과가 같다 (결정성)', () => {
    expect(cap.engine.homeGoals).toBe(plain.engine.homeGoals);
    expect(cap.engine.events).toEqual(plain.engine.events);
    expect(r.final).toEqual([plain.engine.homeGoals, plain.engine.awayGoals]);
  });
  it('프레임은 frameInterval 간격으로 경기 끝까지, 매 프레임 22명 이하와 공', () => {
    expect(r.frames.length).toBeGreaterThan((2 * ENGINE.time.halfSeconds) / ENGINE.time.frameInterval);
    for (let i = 1; i < r.frames.length; i++) expect(r.frames[i]!.e).toBeGreaterThan(r.frames[i - 1]!.e);
    for (const f of r.frames) expect(f.players.length).toBeLessThanOrEqual(22);
    expect(r.players.find((p) => p.isMe)).toBeDefined();
  });
  it('보간: alpha 0 / 1 은 양 끝, 0.5 는 가운데. 한쪽에만 있는 선수는 그 위치', () => {
    const a: ReplayFrame = { e: 0, t: 0, ball: { x: 0, y: 0, z: 0 }, carrier: 'p1', players: [{ id: 'p1', x: 0, y: 0 }, { id: 'out', x: 5, y: 5 }] };
    const b: ReplayFrame = { e: 1, t: 1, ball: { x: 10, y: 4, z: 2 }, carrier: 'p2', players: [{ id: 'p1', x: 10, y: 20 }, { id: 'in', x: 7, y: 7 }] };
    const m = interpolateFrame(a, b, 0.5);
    expect(m.players.find((p) => p.id === 'p1')).toEqual({ id: 'p1', x: 5, y: 10 });
    expect(m.players.find((p) => p.id === 'out')).toEqual({ id: 'out', x: 5, y: 5 });
    expect(m.players.find((p) => p.id === 'in')).toEqual({ id: 'in', x: 7, y: 7 });
    expect(m.ball).toEqual({ x: 5, y: 2, z: 1 });
    expect(interpolateFrame(a, b, 0).players[0]).toEqual(a.players[0]);
    expect(interpolateFrame(a, b, 1).players[0]).toEqual(b.players[0]);
  });
  it('끝 시점의 스코어는 최종 결과, 이벤트 피드는 시간 순 (최신이 앞)', () => {
    expect(scoreAt(r, r.duration)).toEqual(r.final);
    const evs = eventsUntil(r, r.duration);
    for (let i = 1; i < evs.length; i++) expect(evs[i - 1]!.e).toBeGreaterThanOrEqual(evs[i]!.e);
    expect(evs.filter((e) => e.type === 'goal')).toHaveLength(r.final[0] + r.final[1]);
    expect(frameAt(r, r.duration / 2).e).toBeCloseTo(r.duration / 2, 1);
  });
  it('골 이벤트 시점에 공이 골문 근처에 있다 (24.8)', () => {
    for (const g of r.events.filter((e) => e.type === 'goal')) {
      const f = frameAt(r, g.e);
      const nearGoal = Math.min(f.ball.x, ENGINE.pitch.length - f.ball.x);
      expect(nearGoal).toBeLessThan(25);
    }
  });
});
