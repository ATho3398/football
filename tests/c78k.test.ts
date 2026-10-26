// C.78k 엔진 상태 전이·기록 정합성: 실제 엔진 함수로 만든 최소 장면 (엔진 로직을 복제하지 않는다)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { setOwner, setRestart } from '../src/engine/core';
import { shoot } from '../src/engine/actions';
import { attackDir, L, toPitch, W } from '../src/engine/pitch';
import { ratingParts } from '../src/engine/rating';
import { giveCard } from '../src/engine/referee';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createState, step } from '../src/engine/sim';
import type { Agent, RestartType, SimState } from '../src/engine/state';
import { substitute } from '../src/engine/subs';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c78k-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c78k-a', 2018, []);
const input = (seed: number, extra: Partial<EngineInput> = {}): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75),
  away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, ...extra,
});

/** 경기가 열린 상태(재개 없음, 누군가 공 소유)가 될 때까지 */
function untilLive(s: SimState): void {
  for (let i = 0; i < 3000 && (s.restart || s.ball.owner < 0); i++) step(s);
}

/** 그 시각까지 진행한 뒤 열린 상태로 */
function runTo(s: SimState, t: number): void {
  while (s.t < t && !s.done) step(s);
  untilLive(s);
}

function onPitch(s: SimState, team: 0 | 1): Agent[] {
  return s.agents.filter((a) => a.onPitch && a.team === team);
}

function finishMatch(s: SimState): void {
  for (let i = 0; i < 200_000 && !s.done; i++) step(s);
  expect(s.done).toBe(true);
}

/** 재개 종류별 위치 (팀 0 이 차는 쪽) */
function restartSpot(s: SimState, type: RestartType): [number, number] {
  const dir = attackDir(0, s.half);
  if (type === 'penalty') return [dir > 0 ? L - 11 : 11, W / 2];
  if (type === 'corner') return [dir > 0 ? L : 0, 0];
  if (type === 'throwIn') return [L / 2 + dir * 10, 0];
  return toPitch(0.75, 0.4, dir);
}

describe('C.78k ① 키커가 교체·퇴장해도 재개가 사라지지 않는다', () => {
  const cases: { type: RestartType; indirect?: boolean }[] = [
    { type: 'penalty' }, { type: 'freeKick' }, { type: 'freeKick', indirect: true }, { type: 'corner' }, { type: 'throwIn' },
  ];
  for (const how of ['sub', 'red'] as const) {
    for (const c of cases) {
      it(`${c.type}${c.indirect ? '(간접)' : ''} · 키커 ${how === 'sub' ? '교체' : '퇴장'}`, () => {
        const s = createState(input(11));
        runTo(s, 20 * 60);
        const [x, y] = restartSpot(s, c.type);
        setRestart(s, c.type, 0, x, y, 'auto');
        const r = s.restart!;
        if (c.indirect) r.indirect = true;
        const t0 = s.t;
        const taker = s.agents[r.taker]!;
        expect(taker.team).toBe(0);
        const shots0 = s.teams[0].stats.shots;
        if (how === 'sub') substitute(s, taker, s.bench[0].find((b) => !b.gk)!);
        else giveCard(s, taker, 'red');
        expect(taker.onPitch).toBe(false);
        for (let i = 0; i < 2000 && s.restart; i++) step(s);
        expect(s.restart).toBeNull();
        // 같은 팀이 같은 종류로 실제 재개했다 (재개를 버렸으면 possOrigin·마지막 터치가 바뀌지 않는다)
        expect(s.possOrigin).toBe(c.type);
        expect(s.possStartT).toBeGreaterThan(t0);
        const touch = s.agents[s.ball.lastTouch]!;
        expect(touch.team).toBe(0);
        expect(touch.idx).not.toBe(taker.idx);
        if (c.type === 'penalty') {
          // PK 이벤트와 슛 1회
          expect(s.events.filter((e) => e.type === 'penalty' && e.t >= t0 && e.team === 0)).toHaveLength(1);
          expect(s.teams[0].stats.shots - shots0).toBe(1);
        }
      });
    }
  }
});

describe('C.78k ② 하프타임 뒤 전반 시각이 남지 않는다', () => {
  it('전반 추가시간 슛 뒤 후반 첫 슛은 리바운드가 아니고, 원터치·커버·역압박 등 전반 시각이 후반으로 이어지지 않는다', () => {
    const s = createState(input(5));
    runTo(s, s.halfEnd - 3);
    expect(s.half).toBe(1);
    // 전반 끝: 팀 0 공격수가 상대 박스에서 슛, 원터치 실행 중·돌파 후 커버 중·역압박 중 (엔진이 쓰는 그 필드들)
    const dir = attackDir(0, 1);
    const st = onPitch(s, 0).find((a) => a.line === 3)!;
    [st.x, st.y] = toPitch(0.9, 0.5, dir);
    setOwner(s, st);
    shoot(s, st, false);
    expect(s.lastShotT[0]).toBeGreaterThan(ENGINE.time.halfSeconds);
    const t1 = s.t;
    st.otUntil = t1 + 0.25;
    s.teams[1].coverUntil = t1 + 2;
    s.teams[1].coverAgent = onPitch(s, 1)[3]!.idx;
    s.teams[1].counterUntil = t1 + 3;
    s.teams[1].wonAt = t1;
    s.teams[0].lostAt = t1;
    for (let i = 0; i < 5000 && s.half === 1; i++) step(s);
    expect(s.half).toBe(2);
    untilLive(s);
    const t = s.t;
    expect(t).toBeLessThan(t1);
    for (const tm of s.teams) {
      expect(tm.coverUntil).toBeLessThanOrEqual(t);
      expect(tm.counterUntil).toBeLessThanOrEqual(t);
      expect(tm.wonAt).toBeLessThanOrEqual(t);
      expect(tm.lostAt).toBeLessThanOrEqual(t);
      expect(tm.brokeAt).toBeLessThanOrEqual(t);
      expect(tm.sitCandSince).toBeLessThanOrEqual(t);
    }
    for (const a of s.agents) expect(a.otUntil).toBeLessThanOrEqual(t);
    expect(s.lastShotT[0]).toBeLessThanOrEqual(t);
    if (s.lastPass) expect(s.lastPass.t).toBeLessThanOrEqual(t);
    // 후반 첫 슛 (팀 0, 박스 안): 리바운드(경로 5)가 아니다
    const dir2 = attackDir(0, 2);
    const a = onPitch(s, 0).find((x) => x.line === 3)!;
    [a.x, a.y] = toPitch(0.9, 0.5, dir2);
    setOwner(s, a);
    shoot(s, a, false);
    expect(a.shotPath).not.toBe(5);
  });
});

describe('C.78k ③ GK 선방 평점 = 본인 실제 선방', () => {
  it('풀타임 GK: 평점 입력 선방 = 본인 선방 (경기 끝 leftAt 이 있어도 절반이 아니다)', () => {
    const s = createState(input(21));
    finishMatch(s);
    const gks = s.agents.filter((a) => a.line === 0 && a.onPitch);
    expect(gks).toHaveLength(2);
    expect(gks.some((g) => g.stats.saves > 0)).toBe(true);
    for (const g of gks) {
      expect(g.leftAt).not.toBeNull();
      expect(ratingParts(s, g, s.elapsed, true).saves).toBe(g.stats.saves);
      expect(g.stats.saves).toBe(s.teams[g.team].stats.saves);
    }
    for (const a of s.agents.filter((x) => x.line !== 0)) expect(ratingParts(s, a, s.elapsed, true).saves).toBe(0);
  });
});

describe('C.78k ④ GK 퇴장 대응: 나가는 공격수·들어오는 GK 기록', () => {
  it('나가는 공격수의 포지션·줄·평점 그룹 보존, 허위 선방 0, 새 GK 는 퇴장 GK 슬롯, 팀 10명', () => {
    const s = createState(input(31));
    runTo(s, 30 * 60);
    const gk0 = onPitch(s, 0).find((a) => a.line === 0)!;
    const before = new Map(onPitch(s, 0).map((a) => [a.idx, { pos: a.pos, line: a.line, sx: a.sx, statPos: a.stats.position }]));
    giveCard(s, gk0, 'red');
    const out = s.agents.find((a) => a.team === 0 && !a.onPitch && a !== gk0)!;
    const newGk = onPitch(s, 0).find((a) => a.line === 0)!;
    const b = before.get(out.idx)!;
    expect(out.pos).toBe(b.pos);
    expect(out.line).toBe(b.line);
    expect(out.sx).toBe(b.sx);
    expect(out.stats.position).toBe(b.statPos);
    expect(newGk.gk).not.toBeNull();
    expect(newGk.pos).toBe('GK');
    expect(newGk.stats.position).toBe('GK');
    expect(newGk.stats.slot).toBe(gk0.stats.slot);
    expect(onPitch(s, 0)).toHaveLength(10);
    finishMatch(s);
    const po = ratingParts(s, out, s.elapsed, true);
    expect(po.group).not.toBe('GK');
    expect(po.saves).toBe(0);
    expect(ratingParts(s, newGk, s.elapsed, true).saves).toBe(newGk.stats.saves);
    expect(ratingParts(s, gk0, s.elapsed, true).saves).toBe(gk0.stats.saves);
    expect(gk0.stats.saves + newGk.stats.saves).toBe(s.teams[0].stats.saves);
  });
});

/** 내 선수를 팀 0 선발(slot 유지) 또는 벤치에 둔 입력 */
function myInput(seed: number, where: 'lineup' | 'bench', mm: { start: number; end: number }): { input: EngineInput; myId: string } {
  const inp = input(seed);
  const list = where === 'lineup' ? inp.home.lineup : inp.home.bench;
  const k = list.findIndex((p) => !p.gk && (where === 'bench' || p.slot >= 0) && p.position !== 'GK');
  const spec = { ...list[k]!, isMe: true };
  list[k] = spec;
  return { input: { ...inp, myPlayerId: spec.id, myMinutes: mm }, myId: spec.id };
}

describe('C.78k ⑤ 경기 중 부상 퇴장 (myMinutes.end < 90)', () => {
  it('공을 가진 채 부상이면 경기를 멈추고 그 팀 간접 프리킥으로 재개 (공 주인 없는 채로 두지 않는다)', () => {
    const { input: inp, myId } = myInput(41, 'lineup', { start: 0, end: 30 });
    const s = createState(inp);
    runTo(s, 30 * 60 - 0.25);
    const me = s.agents.find((a) => a.id === myId)!;
    expect(me.onPitch).toBe(true);
    setOwner(s, me);
    me.cooldown = 10;
    while (me.onPitch) step(s);
    expect(s.t / 60).toBeLessThan(30.1);
    const r = s.restart!;
    expect(r).not.toBeNull();
    expect(r.type).toBe('freeKick');
    expect(r.indirect).toBe(true);
    expect(r.team).toBe(me.team);
    expect(s.agents[r.taker]!.onPitch).toBe(true);
    expect(s.events.some((e) => e.type === 'injury' && e.players[0] === myId)).toBe(true);
    for (let i = 0; i < 2000 && s.restart; i++) step(s);
    expect(s.possOrigin).toBe('freeKick');
    expect(s.agents[s.ball.lastTouch]!.team).toBe(me.team);
  });

  it('교체권 없이 빠지면 퇴장과 같은 재배치 (같은 줄 간격, 수적 열세 소모)', () => {
    const { input: inp, myId } = myInput(42, 'lineup', { start: 0, end: 30 });
    const s = createState(inp);
    runTo(s, 29 * 60);
    s.teams[0].subsLeft = 0;
    const me = s.agents.find((a) => a.id === myId)!;
    const line = me.line;
    while (me.onPitch) step(s);
    expect(onPitch(s, 0)).toHaveLength(10);
    for (const a of onPitch(s, 0)) expect(a.drainMul).toBe(ENGINE.referee.shortDrain);
    // 같은 줄(공격 줄은 수적 열세로 한 명이 내려갈 수 있어 간격만) y 슬롯이 균등하다
    const ys = onPitch(s, 0).filter((a) => a.line === line).map((a) => a.sy).sort((x, y) => x - y);
    const gaps = ys.slice(1).map((y, i) => y - ys[i]!);
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 6);
  });
});

describe('C.78k ⑥ 내 선수 투입 예약: 팀당 3명 + 출전 보장', () => {
  const subsOf = (s: SimState, team: 0 | 1, from = 0) => s.events.filter((e) => e.type === 'sub' && e.team === team && e.t >= from).length;

  it('남은 교체가 1장뿐이면 AI 는 그 1장을 내 투입 몫으로 남긴다 (교체 3명 넘지 않음)', () => {
    const { input: inp, myId } = myInput(51, 'bench', { start: 75, end: 90 });
    const s = createState(inp);
    runTo(s, 57 * 60);
    const t0 = s.t;
    s.teams[0].subsLeft = 1;
    // AI 교체를 부르게 팀 0 필드 선수 스태미나를 낮춘다
    for (const a of onPitch(s, 0)) a.stamina = 20;
    finishMatch(s);
    const me = [...s.agents, ...s.bench[0]].find((a) => a.id === myId)!;
    expect(me.enteredAt).toBeGreaterThanOrEqual(75 * 60 - 1);
    expect(subsOf(s, 0, t0)).toBe(1);
    expect(s.teams[0].subsLeft).toBe(0);
  });

  it('충돌: 예약분만 남았을 때 GK 퇴장이면 필드 선수가 GK 를 맡고 내 투입은 그대로', () => {
    const { input: inp, myId } = myInput(52, 'bench', { start: 75, end: 90 });
    const s = createState(inp);
    runTo(s, 60 * 60);
    const t0 = s.t;
    s.teams[0].subsLeft = 1;
    const gk0 = onPitch(s, 0).find((a) => a.line === 0)!;
    giveCard(s, gk0, 'red');
    expect(subsOf(s, 0, t0)).toBe(0);
    const keeper = onPitch(s, 0).find((a) => a.line === 0)!;
    expect(keeper.spec.slot).toBeGreaterThanOrEqual(0);
    finishMatch(s);
    const me = s.agents.find((a) => a.id === myId);
    expect(me).toBeDefined();
    expect(subsOf(s, 0, t0)).toBe(1);
    expect(s.teams[0].subsLeft).toBe(0);
  });

  it('자연 경기: 교체 3명 이하, 내 선수는 투입 시각에 들어온다', () => {
    for (const seed of [61, 62, 63]) {
      const { input: inp, myId } = myInput(seed, 'bench', { start: 70, end: 90 });
      const s = createState(inp);
      finishMatch(s);
      expect(subsOf(s, 0)).toBeLessThanOrEqual(3);
      expect(s.teams[0].subsLeft).toBeGreaterThanOrEqual(0);
      const me = s.agents.find((a) => a.id === myId)!;
      expect(me.enteredAt).toBeGreaterThanOrEqual(70 * 60 - 1);
    }
  });
});
