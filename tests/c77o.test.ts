// C.77o P단계 1차 (24.4·24.5·24.6): 마커 렌더러 기본 구현 스냅샷, 보간 순수 함수, 경기 후 하이라이트 3개(앞뒤 8초) 저장·재생·세이브 이전
import { describe, expect, it } from 'vitest';
import { playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { CLIP, clipReplay, clipScenes, findClips, makeMatchClips, pickClips, unpackClips, withClips, type MatchClips } from '../src/highlightClips';
import { frameAt, interpolateFrame, scoreAt, type Replay, type ReplayFrame } from '../src/replay';
import { createTeamRoster } from '../src/roster';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { deserialize, restore, SaveFormatError, serialize } from '../src/save';
import { numberCircleRenderer, type MarkerInput } from '../src/ui/pitch/renderer';
import { ReplayPlayer } from '../src/ui/views/replay';

const my = createTeamRoster({ id: 'h', rating: 78 }, 'c77o-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 72 }, 'c77o-a', 2018, []);
const play = (seed: number) => playMyMatch({
  myRoster: my, oppRoster: opp, myRating: 78, oppRating: 72, home: true,
  me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
  plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed, worldSeed: 'c77o',
}, { teams: ['홈', '원정'] }).replay!;

/** 캔버스 호출 기록 (그리기 겉모습 비교용): 메서드 호출과 속성 설정을 순서대로 */
function recorder(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const r = (v: unknown) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...a: unknown[]) => { log.push(`${k}(${a.map(r).join(',')})`); return { width: 10 }; };
    },
    set(t, k: string, v) { log.push(`${k}=${r(v)}`); t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

describe('C.77o 24.4 MarkerRenderer 기본 구현 (숫자 원) 겉모습', () => {
  const base: MarkerInput = { id: 'p1', teamId: 0, ours: true, number: 9, role: 'ST', isMe: false, state: 'normal', gk: false };
  const cases: [string, MarkerInput][] = [
    ['우리 팀', base],
    ['상대 팀', { ...base, teamId: 1, ours: false, number: 4, role: 'CB' }],
    ['공 가진 선수', { ...base, state: 'carrier' }],
    ['내 선수', { ...base, isMe: true }],
    ['내 선수 + 공', { ...base, isMe: true, state: 'carrier' }],
    ['골키퍼', { ...base, number: 1, role: 'GK', gk: true }],
  ];
  for (const [name, m] of cases) {
    it(`${name}: 그리기 호출이 스냅샷과 같다`, () => {
      const { ctx, log } = recorder();
      numberCircleRenderer.draw(ctx, m, 100, 50, 10, 0.25);
      expect(log).toMatchSnapshot();
    });
  }
});

describe('C.77o 24.5 interpolateFrame 순수 함수', () => {
  const a: ReplayFrame = { e: 10, t: 10, ball: { x: 0, y: 0, z: 0 }, carrier: 'p1', players: [{ id: 'p1', x: 0, y: 0 }, { id: 'p2', x: 50, y: 30 }], restart: 'throwIn' };
  const b: ReplayFrame = { e: 11, t: 11, ball: { x: 10, y: 4, z: 2 }, carrier: 'p3', players: [{ id: 'p1', x: 2, y: 4 }, { id: 'p3', x: 70, y: 10 }] };
  it('alpha 는 0~1 로 자른다', () => {
    expect(interpolateFrame(a, b, -1)).toEqual(interpolateFrame(a, b, 0));
    expect(interpolateFrame(a, b, 2).players[0]).toEqual({ id: 'p1', x: 2, y: 4 });
  });
  it('공 x·y·z 와 시간 e·t 를 같은 비율로 보간', () => {
    const m = interpolateFrame(a, b, 0.25);
    expect(m.ball).toEqual({ x: 2.5, y: 1, z: 0.5 });
    expect(m.e).toBeCloseTo(10.25, 10);
    expect(m.t).toBeCloseTo(10.25, 10);
  });
  it('공 가진 선수는 가운데에서 바뀐다, 재개 상태는 앞 프레임', () => {
    expect(interpolateFrame(a, b, 0.49).carrier).toBe('p1');
    expect(interpolateFrame(a, b, 0.5).carrier).toBe('p3');
    expect(interpolateFrame(a, b, 0.7).restart).toBe('throwIn');
    expect(interpolateFrame(b, a, 0.3).restart).toBeUndefined();
  });
  it('앞에만 있는 선수(교체 아웃)는 그 자리, 뒤에만 있는 선수(교체 인)는 뒤 위치로 붙는다', () => {
    const m = interpolateFrame(a, b, 0.5);
    expect(m.players).toEqual([{ id: 'p1', x: 1, y: 2 }, { id: 'p2', x: 50, y: 30 }, { id: 'p3', x: 70, y: 10 }]);
  });
  it('입력을 바꾸지 않는다', () => {
    const copy = JSON.parse(JSON.stringify(a));
    interpolateFrame(a, b, 0.6);
    expect(a).toEqual(copy);
  });
});

describe('C.77o 24.6 경기 후 하이라이트 3개', () => {
  const r = play(5);
  const clips = pickClips(r);
  it('골 · 결정적 장면 · 내 최고 순간, 종류마다 하나, 핵심 앞뒤 8초, 서로 겹치지 않는다', () => {
    expect(clips.length).toBeGreaterThan(0);
    expect(clips.length).toBeLessThanOrEqual(3);
    expect(new Set(clips.map((c) => c.kind)).size).toBe(clips.length);
    if (r.events.some((x) => x.type === 'goal')) expect(clips.some((c) => c.kind === 'goal')).toBe(true);
    for (const c of clips) {
      expect(c.start).toBeCloseTo(Math.max(0, c.key - CLIP.pad), 6);
      expect(c.end).toBeCloseTo(Math.min(r.duration, c.key + CLIP.pad), 6);
    }
    for (let i = 1; i < clips.length; i++) expect(clips[i]!.key - clips[i - 1]!.key).toBeGreaterThanOrEqual(CLIP.gap);
  });
  it('같은 재생 데이터면 같은 클립 (결정적)', () => {
    expect(pickClips(play(5))).toEqual(clips);
  });
  it('여러 경기에서 내 최고 순간은 내가 관여한 장면', () => {
    for (const seed of [1, 2, 3]) {
      const rr = play(seed);
      const me = rr.players.find((p) => p.isMe)!.id;
      const best = pickClips(rr).find((c) => c.kind === 'best');
      if (!best) continue;
      const ev = rr.events.filter((x) => x.players.includes(me) && Math.abs(x.e - best.key) < 6);
      const dec = (rr.decisions ?? []).some((d) => d.e === best.key);
      expect(ev.length > 0 || dec).toBe(true);
    }
  });
  it('내 도움 골은 내 최고 순간 칸, 골 칸은 다른 골 (같은 장면 두 번 없음). 골이 하나뿐이면 골 칸', () => {
    const ev = (e: number, type: 'goal' | 'shot', players: string[], extra: object = {}) => ({ e, minute: String(Math.floor(e / 60)), type, team: 0 as const, text: `${type}${e}`, big: type === 'goal', players, ...extra });
    const syn = (events: ReturnType<typeof ev>[]) => ({ ...r, events, decisions: [] }) as Replay;
    const two = pickClips(syn([ev(300, 'shot', ['x'], { xg: 0.3, onTarget: true }), ev(301, 'goal', ['x', r.players.find((p) => p.isMe)!.id]), ev(1200, 'shot', ['y'], { xg: 0.2, onTarget: true }), ev(1201, 'goal', ['y']), ev(2000, 'shot', ['z'], { xg: 0.4 })]));
    expect(two.find((c) => c.kind === 'best')!.key).toBe(300);
    expect(two.find((c) => c.kind === 'goal')!.key).toBe(1200);
    expect(two.find((c) => c.kind === 'chance')!.key).toBe(2000);
    const one = pickClips(syn([ev(300, 'shot', ['x'], { xg: 0.3, onTarget: true }), ev(301, 'goal', ['x', r.players.find((p) => p.isMe)!.id])]));
    expect(one.map((c) => c.kind)).toEqual(['goal']);
  });
  it('클립 재생 데이터: 구간 안 프레임만, 압축 왕복 뒤 같은 위치(0.1 m), 스코어 그대로', () => {
    const cr = clipReplay(r, clips);
    expect(cr.frames.length).toBeLessThan(r.frames.length / 20);
    for (const f of cr.frames) expect(clips.some((c) => f.e >= c.start - 0.01 && f.e <= c.end + 0.01)).toBe(true);
    const mc = makeMatchClips(r, { season: 2018, round: 3, label: '3R 원정 2-1' })!;
    const back = unpackClips(JSON.parse(JSON.stringify(mc)) as MatchClips);
    for (const c of clips) {
      for (const e of [c.start + 0.5, c.key, c.end - 0.5]) {
        const x = frameAt(back, e), y = frameAt(r, e);
        expect(Math.abs(x.ball.x - y.ball.x)).toBeLessThan(0.11);
        for (const p of y.players) {
          const q = x.players.find((z) => z.id === p.id)!;
          expect(Math.abs(q.x - p.x)).toBeLessThan(0.11);
        }
        expect(scoreAt(back, e)).toEqual(scoreAt(r, e));
      }
    }
  });
  it('재생기: 클립 장면만 차례로 재생하고 끝난다', () => {
    const mc = makeMatchClips(r, { season: 2018, round: 3, label: 'x' })!;
    let changes = 0;
    const p = new ReplayPlayer(unpackClips(mc), () => { changes++; }, undefined, clipScenes(mc.clips));
    expect(p.scenes.length).toBe(mc.clips.length);
    expect(p.mode).toBe('scene');
    expect(p.e).toBeCloseTo(mc.clips[0]!.start, 6);
    const seen = new Set<number>();
    for (let i = 0; i < 2000 && !p.ended; i++) {
      p.advance(0.1);
      if (p.mode === 'scene') {
        seen.add(p.idx);
        const sc = mc.clips[p.idx]!;
        expect(p.e).toBeGreaterThanOrEqual(sc.start - 1e-6);
        expect(p.e).toBeLessThanOrEqual(sc.end + 1e-6);
      }
    }
    expect(p.ended).toBe(true);
    expect(seen.size).toBe(mc.clips.length);
    expect(changes).toBeGreaterThan(0);
  });
  it(`최근 ${CLIP.keep}경기만, 같은 경기는 바꿔 넣는다`, () => {
    const mc = makeMatchClips(r, { season: 2018, round: 0, label: '' })!;
    let list: MatchClips[] = [];
    for (let i = 1; i <= CLIP.keep + 3; i++) list = withClips(list, { ...mc, round: i });
    expect(list.length).toBe(CLIP.keep);
    expect(list[0]!.round).toBe(4);
    list = withClips(list, { ...mc, round: 8, label: '새' });
    expect(list.length).toBe(CLIP.keep);
    expect(findClips(list, 2018, 8)!.label).toBe('새');
    expect(findClips(list, 2018, 1)).toBeUndefined();
  });
  it('엔진 무영향: 클립을 골라도 재생 데이터·결과가 그대로', () => {
    const r2 = play(5);
    const snap = JSON.stringify(r2);
    makeMatchClips(r2, { season: 1, round: 1, label: '' });
    expect(JSON.stringify(r2)).toBe(snap);
    expect(ENGINE.time.frameInterval).toBe(0.5);
  });
});

describe(`C.77o 세이브 형식 ${SAVE_FORMAT_VERSION}`, () => {
  it('clips 저장 왕복, 옛 세이브(56)는 이어 할 수 없음', () => {
    expect(SAVE_FORMAT_VERSION).toBe(57);
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c77o-s', difficulty: 'normal' });
    const r: Replay = play(5);
    g.clips = withClips(g.clips, makeMatchClips(r, { season: 2018, round: 1, label: '1R' })!);
    const back = deserialize(serialize(g));
    expect(back.clips).toEqual(g.clips);
    expect(unpackClips(back.clips![0]!).frames.length).toBe(clipReplay(r, g.clips[0]!.clips).frames.length);
    const old = JSON.parse(serialize(g));
    old.saveFormat = 56;
    expect(() => restore(old)).toThrow(SaveFormatError);
  });
});
