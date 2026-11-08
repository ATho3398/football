// C.82h (53단계, 엔진 묶음 F2): 게겐 뒤 공간 비용 복구(1대1 자유 반경 freeR 를 골 쪽 상대만 — oneOnOne.freeFront) · ST 배수 초과분을 팀 ST 수로 나눔(prob.stFinishShare) · 결정성
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { oneOnOneAdj, type ShotCtx } from '../src/engine/keeper';
import { stFinishOf } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82h-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82h-a', 2018, []);
function setups(hf?: string, af?: string) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  if (hf) h.formation = hf as typeof h.formation;
  if (af) w.formation = af as typeof w.formation;
  return { h, w };
}
const fp = (r: ReturnType<ReturnType<typeof createMatch>['runToEnd']>) => `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;

describe('C.82h 묶음 F2: 게겐 뒤 공간 비용 복구 · ST 2명 대형 이득', () => {
  it('상수: 엔진 105 · freeFront 1 · stFinishShare 1 · freeR 4 그대로', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(105);
    expect(ENGINE.keeper.oneOnOne.freeFront).toBe(1);
    expect(ENGINE.keeper.oneOnOne.freeR).toBe(4);
    expect(ENGINE.prob.stFinishShare).toBe(1);
  });

  it('1대1 판정: freeFront 1 이면 뒤에서 쫓는 수비(nearField 3.5, nearFront 없음)는 1대1 을 깨지 않고, 앞 3.5 m 수비(nearFront 3.5)는 깬다(장면 ㉘)', () => {
    const O = ENGINE.keeper.oneOnOne as { freeFront: number };
    const base: ShotCtx = {
      fx: 0, fy: 0, svx: 0, svy: 0, d: 11, header: false, press3: 0, pressure: 0, tx: 0, ty: 0, corner: 0.9, speed: 30,
      gk: { x: 0, y: 0, vx: 0, vy: 0 }, stop: 72, body: 0, lead: 0, gk1: 72, fin: 71,
    };
    const was = O.freeFront;
    try {
      O.freeFront = 1;
      expect(oneOnOneAdj({ ...base, nearField: 3.5, nearFront: Infinity })).toBeLessThan(0); // 뒤에서 쫓는 수비만 3.5 m — 1대1
      expect(oneOnOneAdj({ ...base, nearField: 3.5, nearFront: 3.5 })).toBe(0); // 앞 3.5 m 수비 — 1대1 아님
      expect(oneOnOneAdj({ ...base, nearField: 3.5 })).toBe(0); // nearFront 없으면 nearField 로 (옛 호출)
      expect(oneOnOneAdj({ ...base, nearField: 5, nearFront: 5 })).toBeLessThan(0);
      O.freeFront = 0;
      expect(oneOnOneAdj({ ...base, nearField: 3.5, nearFront: Infinity })).toBe(0); // 끄면 방향 무관(C.82f)
    } finally {
      O.freeFront = was;
    }
  });

  it('ST 배수: ST 1명 대형(4-2-3-1)은 stFinish 그대로, ST 2명 대형(4-4-2)은 초과분 절반 — 끄면 둘 다 stFinish', () => {
    const P = ENGINE.prob as { stFinishShare: number; stFinish: number };
    const { h, w } = setups('4-2-3-1', '4-4-2');
    const sim = createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false, neutral: true });
    const s = sim.state;
    const st0 = s.agents.find((a) => a.team === 0 && (a.pos === 'ST' || a.pos === 'CF'))!;
    const st1 = s.agents.find((a) => a.team === 1 && (a.pos === 'ST' || a.pos === 'CF'))!;
    expect(s.agents.filter((a) => a.team === 0 && (a.pos === 'ST' || a.pos === 'CF')).length).toBe(1);
    expect(s.agents.filter((a) => a.team === 1 && (a.pos === 'ST' || a.pos === 'CF')).length).toBe(2);
    const was = P.stFinishShare;
    try {
      P.stFinishShare = 1;
      expect(stFinishOf(s, st0)).toBeCloseTo(P.stFinish, 9);
      expect(stFinishOf(s, st1)).toBeCloseTo(1 + (P.stFinish - 1) / 2, 9);
      P.stFinishShare = 0;
      expect(stFinishOf(s, st0)).toBe(P.stFinish);
      expect(stFinishOf(s, st1)).toBe(P.stFinish);
    } finally {
      P.stFinishShare = was;
    }
  });

  it('결정성: 같은 설정 두 번 같은 지문 · 4-4-2 경기는 stFinishShare 를 끄면 달라진다(레버가 살아 있음)', () => {
    const P = ENGINE.prob as { stFinishShare: number };
    const play = (seed: number) => {
      const { h, w } = setups('4-4-2', '4-4-2');
      return fp(createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true }).runToEnd());
    };
    expect(play(5)).toBe(play(5));
    const on = [1, 2, 3].map(play);
    const was = P.stFinishShare;
    let off: string[];
    try {
      P.stFinishShare = 0;
      off = [1, 2, 3].map(play);
    } finally {
      P.stFinishShare = was;
    }
    expect(on.some((x, i) => x !== off[i])).toBe(true);
  });
});
