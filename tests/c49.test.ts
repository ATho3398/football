// C.49 (pending 80): 성장 포인트를 1~20 화면 칸 단위로. 1P = 찍기 한 번 = 화면 +1칸, 비용 1/2/3, 세이브 남은 포인트 ÷ 5 올림
import { describe, expect, it } from 'vitest';
import { attrDisplay, displayProgress } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { raiseAttribute } from '../src/growth';
import { deserialize, serialize } from '../src/save';
import { allocateVM } from '../src/ui/viewModels';
import { allocateView } from '../src/ui/views/screens';

describe('포인트 = 화면 칸 (C.49)', () => {
  it('레벨업 1P, 약발 10P, 레벨당 상한 없음', () => {
    expect(BALANCE.growth.pointsPerLevel).toBe(1);
    expect(BALANCE.weakFoot.pointCost).toBe(10);
    expect('maxRaisePerLevel' in BALANCE.growth).toBe(false);
  });

  it('찍기 한 번 = 화면 +1칸, 칸 안 진행은 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c49-raise', difficulty: 'normal' });
    const p = g.player;
    p.attributes.shooting = 61; // 화면 12, 칸 안 진행 일부
    p.unspentPoints = 1;
    const prog = displayProgress(61);
    expect(raiseAttribute(p, 'shooting')).toBe(true);
    expect(p.attributes.shooting).toBe(66);
    expect(attrDisplay(66)).toBe(13);
    expect(displayProgress(66)).toBeCloseTo(prog, 6);
    expect(p.unspentPoints).toBe(0);
  });

  it('포인트 찍기 화면: 비용 1·2·3P, 조각 칸 표시 없음, 막히면 "부족"', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c49-vm', difficulty: 'normal' });
    g.player.unspentPoints = 1;
    g.player.attributes.shooting = 80; // 일반 실력: 화면 16 → 2P
    const vm = allocateVM(g, 60, false, { ...g.player.attributes });
    const cells = vm.attrs.flatMap((x) => x.cells);
    const shoot = cells.find((c) => c.attr === 'shooting')!;
    expect(shoot.edit).toMatchObject({ cost: 2, steps: 1, reach: 0, blocked: true, short: true });
    expect(cells.every((c) => c.edit!.cost === null || [1, 2, 3].includes(c.edit!.cost))).toBe(true);
    const html = allocateView(vm, 'shooting', 0);
    expect(html).toContain('2P 부족');
    expect(html).toContain('칸당 <b>1P</b>');
    expect(html).not.toMatch(/\d\/\d칸/);
    expect(html).not.toContain('상한');
  });
});

describe('세이브 28 → 29 (C.49)', () => {
  it('남은 포인트 ÷ 5 올림, allocation 없앰', () => {
    expect(SAVE_FORMAT_VERSION).toBe(36);
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'c49-mig', difficulty: 'normal' });
    for (const [old, now] of [[0, 0], [5, 1], [7, 2], [11, 3]] as const) {
      const raw = JSON.parse(serialize(g));
      raw.saveFormat = 28;
      raw.player.unspentPoints = old;
      raw.player.allocation = { levels: 2, raised: { pace: 3 } };
      const back = deserialize(JSON.stringify(raw));
      expect(back.saveFormat).toBe(36);
      expect(back.player.unspentPoints).toBe(now);
      expect('allocation' in back.player).toBe(false);
    }
  });
});
