// C.74d (사용자 요청 2026-10-20): 시작 방식 커스텀 · 실제 선수 2개, 커스텀 [전체 랜덤] → [이대로 시작][편집하기][다시 돌리기], 단계마다 [이 단계 랜덤]
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { customCap, validCustom } from '../src/custom';
import { newGameVM } from '../src/ui/viewModels';
import { budgetOf, customSpec, customVM, initialCustomForm, NATIONALITIES, type CustomForm } from '../src/ui/customVM';
import { fitToBudget, prospectToCustom, randomStep } from '../src/ui/customRandom';
import { customBody } from '../src/ui/views/custom';
import { NEW_GAME_UI, newGameView } from '../src/ui/views/screens';
import type { FieldPosition } from '../src/positions';

const form = (mode: 'prospect' | 'real' | 'custom') => ({ mode, name: '', position: 'ST', seed: 'c74d', difficulty: 'normal', realId: '', roll: 'c74d', others: false });

function inRange(f: CustomForm): void {
  for (const a of FIELD_ATTRIBUTES) {
    expect(f.attrs[a]).toBeGreaterThanOrEqual(BALANCE.custom.base);
    expect(f.attrs[a]).toBeLessThanOrEqual(Math.max(BALANCE.custom.base, customCap(a, f.height)));
  }
}

describe('새 게임 시작 방식 2개', () => {
  it('탭은 커스텀 · 실제 선수, 커스텀 1단계에 [전체 랜덤]·[이 단계 랜덤]', () => {
    const html = newGameView(newGameVM(form('custom')), customVM(initialCustomForm(), ''), NEW_GAME_UI);
    expect((html.match(/role="tab"|class="po-tab/g) ?? []).length).toBeGreaterThan(0);
    expect(html).toContain('>커스텀<');
    expect(html).toContain('>실제 선수<');
    expect(html).not.toMatch(/data-v="prospect"/);
    expect(html).toContain('data-act="ng-random"');
    expect(html).toContain('data-act="cu-rand"');
  });

  it('전체 랜덤 결과: 후보 4자리 · 코치 평 · [이대로 시작][편집하기][다시 돌리기], 탭은 커스텀에 불', () => {
    const pos = newGameVM(form('prospect')).candidates[0]!.id;
    const html = newGameView(newGameVM({ ...form('prospect'), position: pos }));
    expect((html.match(/class="ng-cand( is-on)?"/g) ?? []).length).toBe(4);
    expect(html).toContain('코치 평');
    expect(html).toContain('이대로 시작');
    expect(html).toContain('data-act="ng-edit"');
    expect(html).toContain('data-act="form-reroll"');
    expect(html).not.toMatch(/data-v="prospect"/);
  });

  it('커스텀 단계마다 [이 단계 랜덤], 능력치가 넘치면 [포인트에 맞추기]', () => {
    const { form: f } = prospectToCustom('c74d-over', 'ST');
    const vm = customVM(f, '');
    for (let st = 1; st <= 6; st++) expect(customBody(vm, st, '', '')).toContain(`data-act="cu-rand" data-v="${st}"`);
    if (vm.over) expect(customBody(vm, 5, '', '')).toContain('data-act="cu-fit"');
  });
});

describe('편집하기 = 랜덤 결과 → 커스텀 폼', () => {
  it('같은 시드면 같은 결과, 커스텀 범위 안, 17세 · 고른 포지션 · 고른 인종', () => {
    const a = prospectToCustom('c74d-x', 'CM', 'black');
    expect(prospectToCustom('c74d-x', 'CM', 'black')).toEqual(a);
    expect(prospectToCustom('c74d-y', 'CM', 'black')).not.toEqual(a);
    expect([a.form.age, a.form.position, a.form.appearance, a.form.facePhoto]).toEqual([17, 'CM', 'black', 'black']);
    expect(NATIONALITIES).toContain(a.form.nationality);
    expect(a.name.length).toBeGreaterThan(0);
    inRange(a.form);
  });

  it('넘친 포인트는 [포인트에 맞추기]로 줄이면 커스텀으로 시작된다', () => {
    let over = 0;
    for (const s of ['c74d-1', 'c74d-2', 'c74d-3', 'c74d-4', 'c74d-5']) {
      const { form: f, name } = prospectToCustom(s, 'ST');
      if (customVM(f, name).over) over++;
      const fit: CustomForm = { ...f, attrs: fitToBudget(f.attrs, f.position as FieldPosition, budgetOf(f), f.height) };
      expect(validCustom(fit.attrs, budgetOf(fit), fit.height)).toBe(true);
      const v = customVM(fit, name);
      expect(v.over).toBe(false);
      if (!v.start.ready) continue;
      const g = newGame({ mode: 'custom', custom: customSpec(fit, name), seed: s, difficulty: 'normal' });
      expect(g.player.age).toBe(17);
      expect(g.player.name).toBe(name);
    }
    expect(over).toBeGreaterThan(0);
  });
});

describe('이 단계 랜덤', () => {
  const base = initialCustomForm();
  it('그 단계 값만 바뀌고 같은 key 면 같은 결과', () => {
    const keys: Record<number, (keyof CustomForm)[]> = {
      1: ['age', 'position'], 2: ['height', 'weight', 'foot', 'weakFoot'], 3: ['nationality', 'appearance', 'facePhoto', 'hair'], 4: ['tags'], 5: ['attrs'], 6: ['startKind', 'startClub', 'youthClub'],
    };
    for (let st = 1; st <= 6; st++) {
      const r = randomStep(base, '이름', st, `k${st}`);
      expect(randomStep(base, '이름', st, `k${st}`)).toEqual(r);
      const changed = (Object.keys(base) as (keyof CustomForm)[]).filter((k) => JSON.stringify(base[k]) !== JSON.stringify(r.form[k]));
      for (const k of changed) expect([...keys[st]!, 'startKind', 'startClub', 'attrs']).toContain(k);
      if (st !== 1) expect(r.name).toBe('이름');
      inRange(r.form);
    }
  });

  it('능력치 단계 랜덤은 포인트 안 · 기본값보다 높은 칸이 있다', () => {
    for (const s of ['a', 'b', 'c']) {
      const r = randomStep(base, '', 5, s).form;
      expect(validCustom(r.attrs, budgetOf(r), r.height)).toBe(true);
      expect(FIELD_ATTRIBUTES.some((a) => r.attrs[a] > BALANCE.custom.base)).toBe(true);
    }
  });
});
