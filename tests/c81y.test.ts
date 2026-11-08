// C.81y 대표팀 경기 내 자리: 주 포지션 칸 → 없으면 가장 가까운 칸 (같은 쪽 측면 우선, 중앙은 가까운 줄). 클럽 경기는 전술 슬롯 그대로
import { describe, expect, it } from 'vitest';
import { nearestSlotIndex } from '../src/engine/slotPick';
import { FORMATION_SLOTS, type Formation } from '../src/formations';
import type { Position } from '../src/types';

const lineupOf = (f: Formation) => FORMATION_SLOTS[f].map((s, slot) => ({ slot, position: s.pos }));
const pick = (f: Formation, me: Position) => FORMATION_SLOTS[f][lineupOf(f)[nearestSlotIndex(lineupOf(f), FORMATION_SLOTS[f], me)]!.slot]!.pos;

// [포지션, 대형별 기대 칸]
const EXPECT: Partial<Record<Formation, Partial<Record<Position, Position>>>> = {
  '4-4-2': { LW: 'LM', RW: 'RM', LM: 'LM', RM: 'RM', ST: 'ST', CAM: 'CM', CM: 'CM', CDM: 'CM', LB: 'LB', RB: 'RB', CB: 'CB' },
  '4-3-3': { LW: 'LW', RW: 'RW', LM: 'LW', RM: 'RW', ST: 'ST', CAM: 'CM', CM: 'CM', CDM: 'CDM', LB: 'LB', RB: 'RB', CB: 'CB' },
  '4-2-3-1': { LW: 'LW', RW: 'RW', LM: 'LW', RM: 'RW', ST: 'ST', CAM: 'CAM', CM: 'CDM', CDM: 'CDM', LB: 'LB', RB: 'RB', CB: 'CB' },
  '3-5-2': { LW: 'LWB', RW: 'RWB', LM: 'LWB', RM: 'RWB', ST: 'ST', CAM: 'CM', CM: 'CM', CDM: 'CDM', LB: 'LWB', RB: 'RWB', CB: 'CB' },
  '4-1-4-1': { LW: 'LM', RW: 'RM', LM: 'LM', RM: 'RM', ST: 'ST', CAM: 'CM', CM: 'CM', CDM: 'CDM', LB: 'LB', RB: 'RB', CB: 'CB' },
  '3-4-3': { LW: 'LW', RW: 'RW', LM: 'LWB', RM: 'RWB', ST: 'ST', CAM: 'CM', CM: 'CM', CDM: 'CM', LB: 'LWB', RB: 'RWB', CB: 'CB' },
};

describe('nearestSlotIndex (C.81y)', () => {
  for (const [f, row] of Object.entries(EXPECT) as [Formation, Partial<Record<Position, Position>>][]) {
    for (const [me, want] of Object.entries(row) as [Position, Position][]) {
      it(`${f} · ${me} → ${want}`, () => expect(pick(f, me)).toBe(want));
    }
  }
  it('측면은 같은 쪽: 4-4-2 LW 는 왼쪽 칸(y<0.5), RW 는 오른쪽 칸', () => {
    const L = lineupOf('4-4-2');
    expect(FORMATION_SLOTS['4-4-2'][L[nearestSlotIndex(L, FORMATION_SLOTS['4-4-2'], 'LW')]!.slot]!.y).toBeLessThan(0.5);
    expect(FORMATION_SLOTS['4-4-2'][L[nearestSlotIndex(L, FORMATION_SLOTS['4-4-2'], 'RW')]!.slot]!.y).toBeGreaterThan(0.5);
  });
  it('같은 칸이 여럿이면 명단 뒤쪽(OVR 낮은) 선수 자리: 4-4-2 CM 두 칸 중 뒤', () => {
    const L = lineupOf('4-4-2');
    const cms = L.map((p, i) => ({ p, i })).filter(({ p }) => p.position === 'CM').map(({ i }) => i);
    expect(nearestSlotIndex(L, FORMATION_SLOTS['4-4-2'], 'CM')).toBe(cms.at(-1));
  });
  it('GK 칸은 고르지 않는다', () => {
    for (const f of Object.keys(EXPECT) as Formation[]) expect(pick(f, 'GK' as Position)).not.toBe('GK');
  });
});

describe('대표팀 경기 엔진 · 준비 화면 그림 (C.81y)', () => {
  it('손흥민(LW) 한국 대표팀: 엔진 내 칸 = 준비 화면 그림 칸 = 왼쪽 측면, 나 1명, 11명', async () => {
    const { newGame } = await import('../src/game');
    const { ensureNational, natRoster, natPreviewLineup, nationRating } = await import('../src/national');
    const { buildMyMatch } = await import('../src/engine/adapter');
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c81y', difficulty: 'normal' });
    const nat = ensureNational(g);
    const opp = nat.nation === 'Japan' ? 'Brazil' : 'Japan';
    const pv = natPreviewLineup(g, opp);
    expect(pv.slots.filter((s) => s.me).length).toBe(1);
    expect(pv.slots.length).toBe(11);
    expect(['LM', 'LW', 'LWB']).toContain(pv.myPos);
    const myR = nationRating(nat.nation); const oppR = nationRating(opp);
    for (const nearestSlot of [true, false]) {
      const sim = buildMyMatch({
        myRoster: natRoster(g, nat.nation), oppRoster: natRoster(g, opp), myRating: myR, oppRating: oppR, home: true,
        me: { position: 'LW', attributes: g.player.attributes, fatigue: 0, form: 0 },
        plan: { started: true, minutes: { start: 0, end: 90 } }, difficulty: 'normal', seed: 1, worldSeed: g.worldSeed, leagueAvg: (myR + oppR) / 2,
        ...(nearestSlot ? { nearestSlot: true } : {}),
      });
      const mine = sim.state.agents.filter((a) => a.team === 0);
      expect(mine.length).toBe(11);
      expect(mine.filter((a) => a.spec.isMe).length).toBe(1);
      const me = mine.find((a) => a.spec.isMe)!;
      if (nearestSlot) expect(me.pos).toBe(pv.myPos);
    }
  }, 120_000);
});
