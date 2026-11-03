// C.80q (53단계): 공격 몰빵 억제 — 선발 공격 포지션(윙·CAM·ST) n명 이상이면 공격 진영 연계 저하 · 수비 전환 체력 소모 증가
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { passProbability, laneRisk } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { stackCount, stackDrainMul, stackLinkMul, stackPenalty } from '../src/engine/stack';
import { customSlots, FORMATION_SLOTS, FORMATIONS } from '../src/formations';
import { attackDir } from '../src/engine/pitch';
import { createTeamRoster } from '../src/roster';
import { stackWarnOf } from '../src/ui/viewModels';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80q-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80q-a', 2018, []);
/** 몰빵 커스텀 대형: 공격 포지션(윙·CAM·ST) 6명 (ST·CF 4명) */
const STACK6 = [-1, 1, 3, 25, 27, 2, 15, 21, 12, 23, 17];

function state(cells?: number[]) {
  const h = teamSetupFromRoster(cells ? { ...home, customSlots: customSlots(cells) } : home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 7, bigMatch: false, neutral: true }).state;
}

describe('C.80q 공격 몰빵 억제', () => {
  it('표준 대형 8종은 공격 포지션 4명 이하라 페널티 없음', () => {
    for (const f of FORMATIONS) {
      const ps = FORMATION_SLOTS[f].map((s) => s.pos);
      expect(stackCount(ps)).toBeLessThan(ENGINE.stackCap.n);
      expect(stackPenalty(ps)).toEqual({ over: 0, link: 1, drain: 1 });
      expect(stackWarnOf(ps)).toEqual({});
    }
  });

  it('배수: 4명 없음 · 5명 m 1 · 6명 m 2 (연계 1 − link·m, 체력 1 + drain·m) · 경고 문구', () => {
    const { n, link, linkBase, drain } = ENGINE.stackCap;
    expect(n).toBe(5);
    const four = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST'] as const;
    const five = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CAM', 'LM', 'RM', 'ST', 'ST'] as const;
    const six = ['GK', 'CB', 'CB', 'LB', 'RB', 'CAM', 'CAM', 'LW', 'RW', 'ST', 'ST'] as const;
    expect(stackPenalty([...four]).over).toBe(0);
    expect(stackPenalty([...five]).link).toBeCloseTo(1 - linkBase - link, 12);
    expect(stackPenalty([...six]).link).toBeCloseTo(1 - linkBase - 2 * link, 12);
    expect(stackPenalty([...six]).drain).toBeCloseTo(1 + 2 * drain, 12);
    expect(stackWarnOf([...six]).stackWarn).toBe(`공격 인원 과다(공격 6명) — 연계 −${Math.round((linkBase + 2 * link) * 100)}% · 수비 전환 체력 소모 +${Math.round(2 * drain * 100)}%`);
  });

  it('최전방 몰빵: 공격 포지션 4명이어도 ST·CF 3명이면 m stW, 4명이면 2·stW · 표준 대형은 ST·CF 최대 2명', () => {
    const st3 = ['GK', 'CB', 'CB', 'LWB', 'CDM', 'CM', 'CM', 'CAM', 'ST', 'ST', 'ST'] as const;
    const st4 = ['GK', 'CB', 'CB', 'LB', 'CDM', 'CM', 'RW', 'CF', 'CF', 'ST', 'ST'] as const;
    expect(stackCount([...st3])).toBe(4);
    const w = ENGINE.stackCap.stW;
    expect(stackPenalty([...st3]).over).toBe(w);
    expect(stackPenalty([...st4]).over).toBe(2 * w);
    for (const f of FORMATIONS) expect(FORMATION_SLOTS[f].filter((s) => s.pos === 'ST' || s.pos === 'CF').length).toBeLessThan(ENGINE.stackCap.stN);
  });

  it('경기 상태: 몰빵 팀만 걸리고, 공격 진영 패스 성공 확률(판단·실행 공통 passProbability)이 연계 배수만큼 준다', () => {
    const s = state(STACK6);
    const ov = stackPenalty(s.agents.filter((x) => x.team === 0 && x.onPitch).map((x) => x.pos)).over;
    expect(ov).toBeGreaterThanOrEqual(2);
    expect(s.teams[0].stackOver).toBe(ov);
    expect(s.teams[1].stackOver).toBe(0);
    expect(state().teams[0].stackOver).toBe(0);
    const a = s.agents.find((x) => x.team === 0 && x.onPitch && !x.gk && x.pos === 'ST')!;
    const dir = attackDir(0, s.half);
    // 공격 진영(정규화 x 0.7)에 세워 놓고 같은 패스를 잰다
    a.x = 52.5 + dir * 20;
    a.y = 34;
    const tx = a.x + dir * 8;
    const lane = laneRisk(s, a, tx, 30);
    const p2 = passProbability(s, a, tx, 30, 'pass', lane);
    const L2 = Math.max(0, 1 - ENGINE.stackCap.linkBase - ov * ENGINE.stackCap.link);
    expect(stackLinkMul(s, a)).toBeCloseTo(L2, 12);
    s.teams[0].stackOver = 0;
    const p0 = passProbability(s, a, tx, 30, 'pass', lane);
    expect(p2 / p0).toBeCloseTo(L2, 9);
    // 자기 진영 패스는 그대로
    s.teams[0].stackOver = ov;
    a.x = 52.5 - dir * 20;
    expect(stackLinkMul(s, a)).toBe(1);
  });

  it('수비 전환 체력: 상대 소유 중 자기 골 쪽으로 움직이는 공격 포지션 선수만 1 + drain·m', () => {
    const s = state(STACK6);
    const ov = s.teams[0].stackOver;
    const dir = attackDir(0, s.half);
    const st = s.agents.find((x) => x.team === 0 && x.onPitch && x.pos === 'ST')!;
    const cb = s.agents.find((x) => x.team === 0 && x.onPitch && x.pos === 'CB')!;
    const opp = s.agents.find((x) => x.team === 1 && x.onPitch && !x.gk)!;
    s.ball.owner = opp.idx;
    st.vx = -dir * 5;
    cb.vx = -dir * 5;
    expect(stackDrainMul(s, st)).toBeCloseTo(1 + ov * ENGINE.stackCap.drain, 12);
    expect(stackDrainMul(s, cb)).toBe(1);
    st.vx = dir * 5;
    expect(stackDrainMul(s, st)).toBe(1);
    st.vx = -dir * 5;
    s.ball.owner = st.idx;
    expect(stackDrainMul(s, st)).toBe(1);
  });
});
