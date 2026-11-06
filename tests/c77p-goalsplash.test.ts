// C.77p 골 "GOAL!" 날아오기 연출: 우리 팀 골에만 · 재생(장면·실시간·클립)에서 지나간 골만 · 건너뛰기 없음 · 설정 끔 · 움직임 줄이기
import { afterEach, describe, expect, it } from 'vitest';
import { playMyMatch } from '../src/engine/adapter';
import { clipScenes, makeMatchClips, unpackClips } from '../src/highlightClips';
import type { Replay } from '../src/replay';
import { createTeamRoster } from '../src/roster';
import {
  GOAL_SPLASH, closeGoalSplash, loadGoalSplashPref, myGoalsBetween, playGoalSplash, saveGoalSplashPref, splashDuration, splashWidth,
} from '../src/ui/goalSplash';
import { ReplayPlayer } from '../src/ui/views/replay';

const my = createTeamRoster({ id: 'h', rating: 80 }, 'c77p-h', 2018, []);
const opp = createTeamRoster({ id: 'a', rating: 74 }, 'c77p-a', 2018, []);
const play = (seed: number): Replay => playMyMatch({
  myRoster: my, oppRoster: opp, myRating: 80, oppRating: 74, home: true,
  me: { position: 'ST', attributes: my.players.find((p) => p.position === 'ST')!.attributes!, fatigue: 0, form: 0 },
  plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed, worldSeed: 'c77p',
}, { teams: ['홈', '원정'] }).replay!;

/** 양 팀 모두 골이 있는 경기 */
let found: Replay | null = null;
for (let seed = 1; seed < 40 && !found; seed++) {
  const r = play(seed);
  if (r.final[r.side]! > 0 && r.final[1 - r.side]! > 0) found = r;
}
const R = found!;
const mine = R.events.filter((x) => x.type === 'goal' && x.team === R.side);
const theirs = R.events.filter((x) => x.type === 'goal' && x.team !== R.side);

function run(p: ReplayPlayer, dt = 0.1): number {
  let n = 0;
  p.onMyGoal = () => { n++; };
  for (let i = 0; i < 200_000 && !p.ended; i++) p.advance(dt);
  return n;
}

function mem(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

describe('C.77p 골 연출 트리거', () => {
  it('테스트 경기에 우리 골·실점이 모두 있다', () => {
    expect(mine.length).toBeGreaterThan(0);
    expect(theirs.length).toBeGreaterThan(0);
  });

  it('구간 감지: 우리 팀 골만, (from, to] 반열림, 거꾸로·제자리는 0', () => {
    const g = mine[0]!;
    const c = theirs[0]!;
    expect(myGoalsBetween(R.events, R.side, g.e - 0.05, g.e)).toBe(1);
    expect(myGoalsBetween(R.events, R.side, g.e, g.e + 0.05)).toBe(0);
    expect(myGoalsBetween(R.events, R.side, c.e - 0.05, c.e + 0.05)).toBe(0);
    expect(myGoalsBetween(R.events, (1 - R.side) as 0 | 1, c.e - 0.05, c.e + 0.05)).toBe(1);
    expect(myGoalsBetween(R.events, R.side, g.e + 1, g.e - 1)).toBe(0);
    expect(myGoalsBetween(R.events, R.side, 0, R.duration)).toBe(mine.length);
  });

  it('실시간 처음부터 끝까지: 우리 골 수만큼 정확히 (실점 제외)', () => {
    const p = new ReplayPlayer(R, () => {});
    p.goLive();
    p.e = 0;
    p.speed = 4;
    expect(run(p)).toBe(mine.length);
  });

  it('장면 재생(하이라이트): 장면 안의 우리 골만 — 장면 밖 골·실점·전환 점프는 안 센다', () => {
    const p = new ReplayPlayer(R, () => {});
    const inScenes = mine.filter((g) => p.scenes.some((s) => g.e > s.start && g.e <= s.end)).length;
    expect(run(p)).toBe(inScenes);
  });

  it('하이라이트 클립 (C.77o): 클립 속 우리 골에서 나온다', () => {
    const mc = makeMatchClips(R, { season: 1, round: 1, label: 'c77p' })!;
    expect(mc).toBeTruthy();
    const rr = unpackClips(mc);
    const p = new ReplayPlayer(rr, () => {}, undefined, clipScenes(mc.clips));
    const inClips = rr.events.filter((x) => x.type === 'goal' && x.team === rr.side && p.scenes.some((s) => x.e > s.start && x.e <= s.end)).length;
    expect(inClips).toBeGreaterThan(0);
    expect(run(p)).toBe(inClips);
  });

  it('건너뛰기는 연출 없음 (진행이 아니라 점프)', () => {
    const p = new ReplayPlayer(R, () => {});
    let n = 0;
    p.onMyGoal = () => { n++; };
    p.skip();
    p.advance(1);
    expect(p.ended).toBe(true);
    expect(n).toBe(0);
  });

  it('마지막 장면 끝(finish 로 경기 끝 점프)에서 뒤쪽 골을 세지 않는다', () => {
    const p = new ReplayPlayer(R, () => {});
    const last = p.scenes.at(-1)!;
    p.idx = p.scenes.length - 1;
    p.e = last.end - 0.05;
    let n = 0;
    p.onMyGoal = () => { n++; };
    p.advance(1);
    expect(p.ended).toBe(true);
    expect(n).toBe(myGoalsBetween(R.events, R.side, last.end - 0.05, last.end));
  });
});

describe('C.77p 설정·시간표·크기', () => {
  it('설정 켬/끔 저장, 기본 켬, 저장소 오류에도 켬', () => {
    const s = mem();
    expect(loadGoalSplashPref(s)).toBe('on');
    saveGoalSplashPref('off', s);
    expect(loadGoalSplashPref(s)).toBe('off');
    saveGoalSplashPref('on', s);
    expect(loadGoalSplashPref(s)).toBe('on');
    expect(loadGoalSplashPref({ getItem: () => { throw new Error('x'); } })).toBe('on');
    expect(loadGoalSplashPref(null)).toBe('on');
  });
  it('약 1.6초 (280 날아오기 · 1200 빠지기 시작), 움직임 줄이기는 600ms 페이드', () => {
    expect(splashDuration(false)).toBe(1600);
    expect(splashDuration(true)).toBe(600);
    expect(GOAL_SPLASH.flyIn).toBe(280);
    expect(GOAL_SPLASH.exitAt).toBe(1200);
  });
  it('크기: 폰 92%(최대 520) · PC 피치 55%(최대 720)', () => {
    expect(splashWidth(false, 390, 390)).toBe(359);
    expect(splashWidth(false, 800, 800)).toBe(520);
    expect(splashWidth(true, 1280, 800)).toBe(440);
    expect(splashWidth(true, 2560, 1600)).toBe(720);
  });
});

// ── DOM 동작: 아주 작은 가짜 DOM (vitest 는 node 환경) ──

interface FakeEl { id?: string; className: string; innerHTML: string; style: { setProperty: (k: string, v: string) => void; vars: Record<string, string> }; attrs: Record<string, string>; removed: boolean; listeners: Record<string, () => void>; classList: { add: (c: string) => void; remove: (c: string) => void; has: Set<string> } }
function fakeEl(): FakeEl & Record<string, unknown> {
  const has = new Set<string>();
  const el: FakeEl & Record<string, unknown> = {
    className: '', innerHTML: '', attrs: {}, removed: false, listeners: {},
    style: { vars: {}, setProperty(k, v) { this.vars[k] = v; } },
    classList: { has, add: (c) => void has.add(c), remove: (c) => void has.delete(c) },
    setAttribute(k: string, v: string) { el.attrs[k] = v; },
    addEventListener(k: string, f: () => void) { el.listeners[k] = f; },
    remove() { el.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 100, width: 390, height: 260 }),
  };
  return el;
}

const g = globalThis as Record<string, unknown>;
const saved = { document: g.document, window: g.window, matchMedia: g.matchMedia, localStorage: g.localStorage };
function installDom(opts: { reduced: boolean; pref?: string; canvas?: boolean }): { body: FakeEl[]; canvas: FakeEl } {
  const body: FakeEl[] = [];
  const canvas = fakeEl();
  const store = new Map<string, string>(opts.pref ? [['po-goal-splash', opts.pref]] : []);
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  g.matchMedia = (q: string) => ({ matches: q.includes('reduced-motion') ? opts.reduced : false });
  g.window = { innerWidth: 390, setTimeout: () => 1, clearTimeout: () => {} };
  g.document = {
    getElementById: (id: string) => (opts.canvas === false ? null : id === 'rp-canvas' ? canvas : null),
    createElement: () => fakeEl(),
    body: { append: (e: FakeEl) => void body.push(e) },
  };
  return { body, canvas };
}

describe('C.77p 연출 띄우기 (가짜 DOM)', () => {
  afterEach(() => {
    closeGoalSplash();
    Object.assign(g, saved);
  });

  it('켬: 피치 위에 GOAL! 그림 한 겹 (srcset 폰용·원본), 1.6초, 피치 흔들기', () => {
    const { body, canvas } = installDom({ reduced: false });
    expect(playGoalSplash('rp-canvas')).toBe(true);
    expect(body).toHaveLength(1);
    const el = body[0]!;
    expect(el.className).toBe('gs-layer');
    expect(el.innerHTML).toContain('anim/goal/goal.webp');
    expect(el.innerHTML).toContain('goal-887.webp 887w');
    expect(el.style.vars['--gs-dur']).toBe('1600ms');
    expect(canvas.classList.has.has('gs-shake')).toBe(true);
  });

  it('탭하면 바로 닫힌다 · 다음 골은 앞 연출을 바꿔 띄운다', () => {
    const { body } = installDom({ reduced: false });
    playGoalSplash('rp-canvas');
    playGoalSplash('rp-canvas');
    expect(body[0]!.removed).toBe(true);
    expect(body[1]!.removed).toBe(false);
    body[1]!.listeners.pointerdown!();
    expect(body[1]!.removed).toBe(true);
  });

  it('움직임 줄이기: 날아오기·흔들기 없이 600ms 페이드', () => {
    const { body, canvas } = installDom({ reduced: true });
    expect(playGoalSplash('rp-canvas')).toBe(true);
    expect(body[0]!.className).toBe('gs-layer gs-layer--reduced');
    expect(body[0]!.style.vars['--gs-dur']).toBe('600ms');
    expect(canvas.classList.has.has('gs-shake')).toBe(false);
  });

  it('설정 끔이면 아무것도 띄우지 않는다', () => {
    const { body } = installDom({ reduced: false, pref: 'off' });
    expect(playGoalSplash('rp-canvas')).toBe(false);
    expect(body).toHaveLength(0);
  });

  it('피치가 없으면(다른 화면) 띄우지 않는다', () => {
    const { body } = installDom({ reduced: false, canvas: false });
    expect(playGoalSplash('rp-canvas')).toBe(false);
    expect(body).toHaveLength(0);
  });
});
