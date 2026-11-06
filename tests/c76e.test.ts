// C.76e (44단계, U 추가 지시 3번 · 사용자 16:19): 커스텀 기본 단계에 국적·인종(이름 위), 이름 [랜덤]·국적 바꾸면 랜덤 이름 다시 뽑기, 외모는 사진·머리만
import { describe, expect, it } from 'vitest';
import { PHOTO_OF } from '../src/identity';
import { randomStep } from '../src/ui/customRandom';
import { customNameAfter, customVM, initialCustomForm } from '../src/ui/customVM';
import { setWideForTest } from '../src/ui/skin';
import { customBody } from '../src/ui/views/custom';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

describe('C.76e 버전', () => {
  it('PATCH_LABEL · STAGE_LABEL', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/); // C.76e 배포 때 'C.76e' · '44단계', 뒤로는 형식만
    expect(STAGE_LABEL).toMatch(/^\d+단계$/);
  });
});

describe('커스텀 기본 단계: 국적·인종을 이름보다 먼저', () => {
  it('1단계 = 국적 → 인종 → 이름(+랜덤) 순서, 3단계(외모)에는 국적·인종 없이 사진·도트 머리만', () => {
    const vm = customVM(initialCustomForm(), '');
    const s1 = customBody(vm, 1, '', '');
    const iNat = s1.indexOf('id="cu-nat"');
    const iApp = s1.indexOf('data-k="app"');
    const iName = s1.indexOf('id="f-name"');
    expect(iNat).toBeGreaterThan(-1);
    expect(iApp).toBeGreaterThan(iNat);
    expect(iName).toBeGreaterThan(iApp);
    expect(s1).toContain('data-act="cu-name-rand"');
    const s3 = customBody(vm, 3, '', '');
    expect(s3).not.toContain('id="cu-nat"');
    expect(s3).not.toContain('data-k="app"');
    expect(s3).toContain('data-k="hair"');
    expect(s3).toContain('기본 사진');
  });

  it('이름 다시 뽑기: [랜덤]은 늘, 국적·인종 변경은 빈 칸·랜덤 이름만 (직접 입력은 그대로)', () => {
    const f = { ...initialCustomForm(), nationality: 'Brazil', appearance: 'latinMideast' as const };
    expect(customNameAfter(f, '직접이름', false, false, 'k')).toBeNull();
    const a = customNameAfter(f, '', false, false, 'k');
    expect(a).toBeTruthy();
    expect(customNameAfter(f, '랜덤이름', true, false, 'k')).toBe(a);
    expect(customNameAfter(f, '직접이름', false, true, 'k')).toBe(a);
    // 국적에 맞는 이름: 같은 key 라도 국적이 다르면 다른 풀
    expect(customNameAfter({ ...f, nationality: 'Korea Republic', appearance: 'eastAsian' }, '', false, false, 'k')).not.toBe(a);
  });

  it('이 단계 랜덤: 1단계가 국적·인종도, 3단계는 사진·머리만', () => {
    const base = initialCustomForm();
    let natChanged = false;
    for (let i = 0; i < 12; i++) {
      const r1 = randomStep(base, '', 1, `c75z-1-${i}`);
      if (r1.form.nationality !== base.nationality) natChanged = true;
      const r3 = randomStep(base, '이름', 3, `c75z-3-${i}`).form;
      expect(r3.nationality).toBe(base.nationality);
      expect(r3.appearance).toBe(base.appearance);
      expect(r3.facePhoto).toBe(PHOTO_OF[base.appearance as 'eastAsian']);
    }
    expect(natChanged).toBe(true);
  });

  it('요약 줄: 기본 = 국적 · 이름 · 나이 · 포지션', () => {
    const vm = customVM(initialCustomForm(), '이도윤');
    setWideForTest(true);
    try {
      const h = customBody(vm, 2, '', '');
      expect(h).toContain('대한민국 · 이도윤 · 17세');
      expect(h).toContain('머리 자동');
    } finally { setWideForTest(null); }
  });
});
