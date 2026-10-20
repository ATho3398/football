// C.75j 44e 공격 수신 지점 모델 · 압박 분포(첫 터치 슛) · 마크 배정 2선 박스 규칙 · LM/RM 컷백 존
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { setOwner } from '../src/engine/core';
import { updateMarks, updateSituations } from '../src/engine/offball';
import { receivePoint, shotModel } from '../src/engine/onball';
import { attackDir, dist, ownGoal, toNorm } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch, createState } from '../src/engine/sim';
import type { Agent, SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c75j-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c75j-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 원정(1) 공격: 공격수 att 가 홈 골 goalDist m 앞 중앙, 소유자는 그 뒤 ballDist m, 홈 수비수 mk 가 att 골 쪽 1.5 m */
function scene(goalDist: number, ballDist: number): { s: SimState; att: Agent; mk: Agent; owner: Agent; dir: 1 | -1 } {
  const s = createState(input(7));
  s.restart = null;
  const dir = attackDir(0, s.half);
  const [gx, gy] = ownGoal(dir);
  const owner = s.agents.find((a) => a.team === 1 && a.line === 2)!;
  const att = s.agents.find((a) => a.team === 1 && a.line === 3)!;
  for (const a of s.agents) if (a.team === 0 && a.line !== 0) { a.x = gx + dir * 20; a.y = 6 + a.idx * 2; }
  for (const a of s.agents) if (a.team === 1 && a.line !== 0) { a.x = gx + dir * 70; a.y = 6 + a.idx * 2; }
  att.x = gx + dir * goalDist;
  att.y = gy;
  att.vx = att.vy = 0;
  att.runUntil = 0;
  owner.x = att.x + dir * ballDist;
  owner.y = gy + 2;
  setOwner(s, owner);
  s.ball.x = owner.x;
  s.ball.y = owner.y;
  s.possTeam = 1;
  s.possSince = s.t - 10;
  for (const t of s.teams) { t.counterUntil = 0; t.counterPressers = []; t.coverUntil = 0; }
  const [p0, p1] = s.agents.filter((a) => a.team === 0 && a.line === 2);
  p0!.x = owner.x + dir * 2;
  p0!.y = owner.y;
  p1!.x = owner.x + dir * 3;
  p1!.y = owner.y + 3;
  const mk = s.agents.find((a) => a.team === 0 && a.line === 1)!;
  mk.x = att.x - dir * 1.5;
  mk.y = att.y;
  return { s, att, mk, owner, dir: (-dir) as 1 | -1 };
}

describe('C.75j 44e 수신 지점 모델 · 압박 분포 · 마크 배정 규칙', () => {
  const RV = ENGINE.onball.recv;

  it('수신 지점: 목표점 shiftDist 안에 상대가 있으면 그 반대쪽으로 shift m (패스 선에 수직 우선), 없으면 그대로', () => {
    const { s, att, mk, owner, dir } = scene(14, 12);
    owner.y = att.y; // 패스 선 = 공격 방향
    // 마커를 옆(패스 선에 수직)으로 1.5 m: 반대쪽으로 shift m
    mk.x = att.x;
    mk.y = att.y + 1.5;
    const line = 1; // 오프사이드 라인 제한 없음
    const [tx, ty] = receivePoint(s, owner, att, att.x, att.y, dir, line);
    expect(Math.abs(ty - (att.y - RV.shift))).toBeLessThan(0.05);
    expect(Math.abs(tx - att.x)).toBeLessThan(0.05);
    expect(dist(tx, ty, mk.x, mk.y)).toBeGreaterThan(1.5 + RV.shift - 0.05);
    // 상대가 멀면 그대로
    mk.y = att.y + RV.shiftDist + 1;
    expect(receivePoint(s, owner, att, att.x, att.y, dir, line)).toEqual([att.x, att.y]);
  });

  it('수신 지점: 오프사이드 라인(maxOffside m 안)을 넘지 않고 피치 안에 머문다', () => {
    const { s, att, mk, owner, dir } = scene(14, 12);
    // 마커가 공 쪽(패스 선 위)에 있으면 반대쪽 = 골 쪽으로 밀리지만, 라인 앞 maxOffside 까지만
    mk.x = att.x + (dir as number) * -1.5; // 공 쪽
    mk.y = att.y;
    const lineN = toNorm(att.x, att.y, dir)[0] + 1 / 105; // 라인이 공격수 1 m 앞
    const [tx] = receivePoint(s, owner, att, att.x, att.y, dir, lineN);
    const nx = toNorm(tx, att.y, dir)[0];
    expect(nx).toBeLessThanOrEqual(lineN - RV.maxOffside / 105 + 1e-9);
    expect(nx).toBeGreaterThan(toNorm(att.x, att.y, dir)[0] - 1e-9);
  });

  it('압박 분포: 받고 몰지 않고 firstTouch 안에 쏘는 슛은 받는 순간의 압박으로 판정한다 (몰고 가면 지금 압박)', () => {
    const { s, att, mk } = scene(12, 10);
    setOwner(s, att);
    s.ball.x = att.x;
    s.ball.y = att.y;
    att.gotBy = 'receive';
    att.carryN = 0;
    att.recvT = s.t;
    att.recvPress = 0; // 받는 순간 자유로웠다
    mk.x = att.x - (attackDir(1, s.half) as number) * 1.0; // 지금은 1 m 앞에 마커
    mk.y = att.y;
    const free = shotModel(s, att).pOn;
    att.recvPress = 1; // 받는 순간부터 압박
    const pressed = shotModel(s, att).pOn;
    expect(free).toBeGreaterThan(pressed);
    att.recvPress = 0;
    att.carryN = 1; // 몰고 갔으면 지금 압박
    expect(shotModel(s, att).pOn).toBeCloseTo(pressed, 6);
    att.carryN = 0;
    att.recvT = s.t - RV.firstTouch - 0.1; // 창이 지나면 지금 압박
    expect(shotModel(s, att).pOn).toBeCloseTo(pressed, 6);
  });

  it('마크 배정: 2선 상대는 박스(+markMidsBoxMargin) 밖이면 배정하지 않고, 박스 안으로 들어오면 배정한다', () => {
    const { s, att } = scene(20, 15);
    const dir = attackDir(0, s.half);
    const [gx, gy] = ownGoal(dir);
    // 원정 2선 한 명을 골 30 m 앞(박스 밖)에 둔다
    const mid = s.agents.find((a) => a.team === 1 && a.line === 2 && a.idx !== s.ball.owner)!;
    mid.x = gx + dir * 30;
    mid.y = gy + 4;
    updateSituations(s);
    updateMarks(s);
    const markedBy = (o: Agent) => s.agents.filter((a) => a.team === 0 && a.markIdx === o.idx).length;
    expect(markedBy(att)).toBe(1);
    expect(markedBy(mid)).toBe(0);
    // 박스 안으로
    mid.x = gx + dir * 12;
    for (const a of s.agents) if (a.team === 0) a.markUntil = 0;
    updateMarks(s);
    expect(markedBy(mid)).toBe(1);
  });

  it('결정성: 같은 시드 두 번 같은 결과', () => {
    const a = createMatch(input(21)).runToEnd();
    const b = createMatch(input(21)).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(JSON.stringify(a.teamStats)).toBe(JSON.stringify(b.teamStats));
  });

  it('버전: C.75j · 44단계 · 엔진 26', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toBe('C.75j');
    expect(STAGE_LABEL).toBe('44단계');
    expect(ENGINE.offball.plan.coverBehind).toBe(3);
  });
});
