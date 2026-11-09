// C.82i (53단계, 엔진 묶음 F3): 표준 대형 균형 — 분배 인원을 최전방 인원(슬롯 x ≥ prob.frontLine)으로 · 1대1 drop 분배(oneOnOne.share) · 결정성
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { oneOnOneAdj, type ShotCtx } from '../src/engine/keeper';
import { formFinishOf, frontCount, stFinishOf } from '../src/engine/onball';
import { matchupKey, matchupPts } from '../src/engine/fit';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster } from '../src/roster';
import type { Formation } from '../src/formations';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82i-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82i-a', 2018, []);
function sim(hf: Formation, af: Formation, seed = 3) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.formation = hf;
  w.formation = af;
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}
const fp = (r: ReturnType<ReturnType<typeof createMatch>['runToEnd']>) => `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;

describe('C.82i 묶음 F3: 표준 대형 균형', () => {
  it('상수: 엔진 106 · frontLine 0.62 · oneOnOne.share 0.3 · stFinish 1.3 · stFinishShare 1', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(106);
    expect(ENGINE.prob.frontLine).toBe(0.62);
    expect(ENGINE.keeper.oneOnOne.share).toBe(0.3);
    expect(ENGINE.prob.stFinish).toBe(1.3);
    expect(ENGINE.prob.stFinishShare).toBe(1);
  });

  it('최전방 인원: 4-3-3·3-4-3 = 3(ST + 윙 2) · 4-2-3-1·4-1-4-1 = 1(윙 0.58 은 안 셈) · 4-4-2·3-5-2·5-3-2·4-3-1-2 = 2 — frontLine 0 이면 ST·CF 수', () => {
    const P = ENGINE.prob as { frontLine: number };
    const want: Record<Formation, number> = { '4-4-2': 2, '4-3-3': 3, '4-2-3-1': 1, '3-5-2': 2, '5-3-2': 2, '4-3-1-2': 2, '4-1-4-1': 1, '3-4-3': 3 };
    const stN: Record<Formation, number> = { '4-4-2': 2, '4-3-3': 1, '4-2-3-1': 1, '3-5-2': 2, '5-3-2': 2, '4-3-1-2': 2, '4-1-4-1': 1, '3-4-3': 1 };
    const was = P.frontLine;
    try {
      for (const f of Object.keys(want) as Formation[]) {
        const s = sim(f, '4-4-2').state;
        P.frontLine = 0.62;
        expect(frontCount(s, 0), f).toBe(want[f]);
        expect(frontCount(s, 1), f).toBe(2);
        P.frontLine = 0;
        expect(frontCount(s, 0), `${f} ST 수`).toBe(stN[f]);
      }
    } finally {
      P.frontLine = was;
    }
  });

  it('ST 배수: 1명 대형 1.3 · 2명 1.15 · 3명(4-3-3) 1.1 — 초과분을 최전방 인원으로 나눈다', () => {
    const P = ENGINE.prob;
    const one = sim('4-1-4-1', '4-3-3').state;
    const st0 = one.agents.find((a) => a.team === 0 && a.pos === 'ST')!;
    const st1 = one.agents.find((a) => a.team === 1 && a.pos === 'ST')!;
    expect(stFinishOf(one, st0)).toBeCloseTo(P.stFinish, 9);
    expect(stFinishOf(one, st1)).toBeCloseTo(1 + (P.stFinish - 1) / 3, 9);
    const two = sim('4-4-2', '4-4-2').state;
    expect(stFinishOf(two, two.agents.find((a) => a.team === 0 && a.pos === 'ST')!)).toBeCloseTo(1 + (P.stFinish - 1) / 2, 9);
  });

  it('1대1 분배: 같은 슛도 최전방 1명 팀이 drop 1.3배 · 2명 그대로 · 3명 0.7배 — share 0 이면 모두 같고, front 없으면(프리킥) 분배 없음', () => {
    const O = ENGINE.keeper.oneOnOne as { share: number; drop: number };
    const base: ShotCtx = {
      fx: 0, fy: 0, svx: 0, svy: 0, d: 11, header: false, press3: 0, pressure: 0, tx: 0, ty: 0, corner: 0.9, speed: 30,
      gk: { x: 0, y: 0, vx: 0, vy: 0 }, stop: 72, body: 0, lead: 0, gk1: 72, fin: 71, nearField: 9, nearFront: 9,
    };
    const was = O.share;
    try {
      O.share = 0.3;
      const a1 = oneOnOneAdj({ ...base, front: 1 });
      const a2 = oneOnOneAdj({ ...base, front: 2 });
      const a3 = oneOnOneAdj({ ...base, front: 3 });
      expect(a2).toBeCloseTo(-O.drop, 9);
      expect(a1).toBeCloseTo(-O.drop * 1.3, 9);
      expect(a3).toBeCloseTo(-O.drop * 0.7, 9);
      expect(oneOnOneAdj(base)).toBeCloseTo(-O.drop, 9);
      expect(oneOnOneAdj({ ...base, front: 6 })).toBeCloseTo(-O.drop * 0.4, 9); // 인원 4 로 자름 — 음수 안 됨
      O.share = 0;
      expect(oneOnOneAdj({ ...base, front: 1 })).toBeCloseTo(-O.drop, 9);
      expect(oneOnOneAdj({ ...base, front: 3 })).toBeCloseTo(-O.drop, 9);
    } finally {
      O.share = was;
    }
  });

  it('대형별 배수(formFinish): 4-1-4-1 1.08 · 5-3-2 0.94 · 4-3-1-2 0.94 · 3-5-2 0.95 · 4-4-2(기준 대형) 1 · 커스텀 슬롯 팀은 1', async () => {
    const P = ENGINE.prob;
    expect(P.formFinish['4-1-4-1']).toBe(1.08);
    expect(P.formFinish['5-3-2']).toBe(0.94);
    expect(P.formFinish['4-3-1-2']).toBe(0.94);
    expect(P.formFinish['3-5-2']).toBe(0.95);
    expect(P.formFinish['4-4-2']).toBeUndefined();
    const s = sim('4-1-4-1', '5-3-2').state;
    expect(formFinishOf(s, 0)).toBe(1.08);
    expect(formFinishOf(s, 1)).toBe(0.94);
    expect(formFinishOf(sim('4-4-2', '4-3-3').state, 0)).toBe(1);
    const h = teamSetupFromRoster(home, 75, 75);
    const w = teamSetupFromRoster(away, 75, 75);
    h.formation = '4-1-4-1';
    h.customSlots = [...(await import('../src/formations')).FORMATION_SLOTS['4-1-4-1']];
    w.formation = '4-1-4-1';
    const c = createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false, neutral: true }).state;
    expect(formFinishOf(c, 0)).toBe(1); // 커스텀 슬롯(같은 모양이라도) — 표 안 씀
    expect(formFinishOf(c, 1)).toBe(1.08);
  });

  it('버스 전용 상성 키(마스터 AF 추가 관문): block + 라인 0.2 → bus 칸(균형 공중 −4·태클 −2 · 역습 −2·−1), 라인 0.35 블록은 block 칸(균형 상대 0), 없는 짝은 block 칸으로 내려간다', () => {
    const M = ENGINE.matchup as Record<string, Record<string, Record<string, number>>>;
    expect(ENGINE.tacticFit.busLine).toBe(0.3);
    expect(M.bus!.balanced!.air).toBe(-4);
    expect(M.bus!.counter!.tackle).toBe(-1);
    expect(matchupKey({ tendency: 'block', lineHeight: 0.2 })).toBe('bus');
    expect(matchupKey({ tendency: 'block', lineHeight: 0.35 })).toBe('block');
    expect(matchupKey({ tendency: 'counter', lineHeight: 0.2 })).toBe('counter');
    const st = (a: [string, number], b: [string, number]) => ({ teams: [{ tactics: { tendency: a[0], lineHeight: a[1] } }, { tactics: { tendency: b[0], lineHeight: b[1] } }] }) as unknown as Parameters<typeof matchupPts>[0];
    expect(matchupPts(st(['block', 0.2], ['balanced', 0.5]), 0, 'air')).toBe(-4);
    expect(matchupPts(st(['block', 0.2], ['counter', 0.5]), 0, 'tackle')).toBe(-1);
    expect(matchupPts(st(['block', 0.35], ['balanced', 0.5]), 0, 'air')).toBe(0); // 블록(라인 낮음)은 그대로
    expect(matchupPts(st(['block', 0.2], ['tikitaka', 0.65]), 0, 'long')).toBe(M.block!.tikitaka!.long); // bus 에 없는 짝 → block 칸
    expect(matchupPts(st(['balanced', 0.5], ['block', 0.2]), 0, 'air')).toBe(0); // 균형 → 버스: 균형 행에 block·bus 칸 없음
  });

  it('결정성: 같은 설정 두 번 같은 지문 · 4-3-3 대 4-1-4-1 경기는 share 를 끄면 달라진다(레버가 살아 있음)', () => {
    const O = ENGINE.keeper.oneOnOne as { share: number };
    const play = (seed: number) => fp(sim('4-3-3', '4-1-4-1', seed).runToEnd());
    expect(play(5)).toBe(play(5));
    const on = [1, 2, 3].map(play);
    const was = O.share;
    let off: string[];
    try {
      O.share = 0;
      off = [1, 2, 3].map(play);
    } finally {
      O.share = was;
    }
    expect(on.some((x, i) => x !== off[i])).toBe(true);
  });
});
