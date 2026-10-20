// C.75z (44단계): 주발 발자국 아이콘(FootPair) · 자동 진행 중 인터뷰 자동 답(손해가 가장 적은 답)
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../data/events';
import { autoAnswerInterviews, effectsPenalty, eventById, fireEvent, isInterviewEvent, leastPenaltyChoice } from '../src/events';
import { newGame } from '../src/game';
import { isPending } from '../src/inbox';
import { FootPair } from '../src/ui/components';
import { ICON_PATHS } from '../src/ui/components/iconPaths';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import { customNameAfter, customVM, initialCustomForm } from '../src/ui/customVM';
import { randomStep } from '../src/ui/customRandom';
import { customBody } from '../src/ui/views/custom';
import { PHOTO_OF } from '../src/identity';
import { setWideForTest } from '../src/ui/skin';
import { bodySection } from '../src/ui/views/body';
import { inboxDetailView } from '../src/ui/views/inbox';
import { inboxDetailVM } from '../src/ui/inboxVM';

const INTERVIEWS = EVENTS.filter(isInterviewEvent);

describe('C.75z 버전', () => {
  it('PATCH_LABEL · STAGE_LABEL', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/);
    expect(STAGE_LABEL).toMatch(/^\d+단계$/);
  });
});

describe('주발 발자국 아이콘 (FootPair)', () => {
  it('왼발·오른발 두 개, 주발은 is-main(lime) + 주발 숫자(없으면 5), 약발은 약발 숫자', () => {
    const h = FootPair({ foot: 'right', weakFoot: 3 });
    expect(h.match(/<svg class="po-foot/g)?.length).toBe(2);
    expect(h.match(/is-main/g)?.length).toBe(1);
    // 왼쪽(반전) = 약발 3, 오른쪽 = 주발 5
    const [left, right] = h.split('</svg>');
    expect(left).toContain('matrix(-1 0 0 1 24 0)');
    expect(left).toMatch(/>3<\/text>/);
    expect(left).not.toContain('is-main');
    expect(right).toContain('is-main');
    expect(right).toMatch(/>5<\/text>/);
    expect(h).toContain('aria-label="주발 오른발 5 · 약발 3"');
    const l = FootPair({ foot: 'left', weakFoot: 4, main: 5 }).split('</svg>');
    expect(l[0]).toContain('is-main');
    expect(l[1]).toMatch(/>4<\/text>/);
    expect(ICON_PATHS.foot).toBeTruthy();
  });

  it('선수 화면 몸·태그 탭: 주발 글자 칸 대신 발자국 두 개', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c75z-body', difficulty: 'normal' });
    const h = bodySection(g.player, false, 9, '<b>유스</b>', null, '');
    expect(h).toContain('po-feet');
    expect(h).toContain('bs-feet');
    expect(h.match(/<svg class="po-foot/g)?.length).toBe(2);
  });
});

describe('자동 진행 중 인터뷰 (손해가 가장 적은 답)', () => {
  it('인터뷰 이벤트는 4개(결승골·패배 뒤·다큐·언론 폭풍)이고 모두 선택형', () => {
    expect(INTERVIEWS.map((d) => d.id).sort()).toEqual(['l_mediaStorm', 'm_decisive', 'm_interviewSlip', 's_documentary']);
    for (const d of INTERVIEWS) expect(d.choices?.length).toBeGreaterThan(1);
  });

  it('손해 계산: 위상·신뢰도·동료 관계 감소, 멘탈 피로 증가, 예약 파장 이벤트까지 센다', () => {
    expect(effectsPenalty([{ rep: 2 }, { life: 'team', add: -2 }])).toBe(2);
    expect(effectsPenalty([{ rep: 2 }, { life: 'mental', add: 3 }])).toBe(3);
    // 솔직하게 → 3일 뒤 c_slipFallout (신뢰도 −2, 동료 −5)
    expect(effectsPenalty([{ rep: 1 }, { next: 'c_slipFallout', days: 3 }])).toBe(7);
    expect(effectsPenalty([{ rep: 1 }, { trust: 2 }, { life: 'team', add: 4 }])).toBe(0);
  });

  it('고른 답은 고를 수 있는 답 중 손해 최소, 같으면 기본 선택(무난한 답)', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c75z-pick', difficulty: 'normal' });
    for (const d of INTERVIEWS) {
      const it = fireEvent(g, d);
      const c = leastPenaltyChoice(d, it)!;
      const open = d.choices!.filter((x) => !it.choices?.find((y) => y.id === x.id)?.disabled);
      const min = Math.min(...open.map((x) => effectsPenalty(x.effects)));
      expect(effectsPenalty(c.effects)).toBe(min);
    }
    const at = (id: string) => { const d = eventById(id)!; return leastPenaltyChoice(d, fireEvent(g, d))!.id; };
    expect(at('m_decisive')).toBe('fans');
    expect(at('m_interviewSlip')).toBe('calm');
    expect(at('s_documentary')).toBe('no');
  });

  it('고를 수 없는 답(언론 울렁증 → 자신감)은 고르지 않는다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c75z-shy', difficulty: 'normal' });
    g.player.tags.push({ id: 'mediaShy', perm: true, season: 2018 });
    const d = eventById('m_decisive')!;
    const it = fireEvent(g, d);
    expect(it.choices?.find((x) => x.id === 'bold')?.disabled).toBeTruthy();
    expect(leastPenaltyChoice(d, it)!.id).not.toBe('bold');
  });

  it('자동 진행: 새 인터뷰는 답하고(인박스에 한 줄), 진행 전 알림·다른 선택 이벤트는 그대로 둔다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c75z-auto', difficulty: 'normal' });
    const old = fireEvent(g, eventById('s_documentary')!);
    const bench = fireEvent(g, eventById('m_benchRun')!);
    const fresh = fireEvent(g, eventById('m_interviewSlip')!);
    const rep0 = g.player.reputation;
    const lines = autoAnswerInterviews(g, new Set([old.id]));
    expect(lines).toEqual([`${fresh.title} → 차분하게 넘긴다`]);
    expect(isPending(fresh)).toBe(false);
    expect(fresh.answer?.id).toBe('calm');
    expect(fresh.answer?.text.startsWith('자동 진행 · ')).toBe(true);
    expect(g.player.reputation).toBe(rep0);
    expect(g.events?.queue.some((q) => q.id === 'c_slipFallout')).toBe(false);
    expect(isPending(old)).toBe(true);
    expect(isPending(bench)).toBe(true);
    // 인박스 상세: "자동 진행 답"
    const vm = inboxDetailVM(g, fresh.id);
    expect(vm && inboxDetailView(vm, null)).toContain('자동 진행 답');
  });

  it('직접 진행(자동 답 호출 없음): 인터뷰는 답을 기다린다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c75z-direct', difficulty: 'normal' });
    const it = fireEvent(g, eventById('m_decisive')!);
    expect(isPending(it)).toBe(true);
  });
});

describe('커스텀 기본 단계: 국적·인종을 이름보다 먼저 (U 추가 3번)', () => {
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
