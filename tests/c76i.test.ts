// C.76i (U8-d 재정·인박스·면담, 디자인 통합 2부 191~194 · 196 · 197② · 200 · 206 · 216 · 219 · 220 · 적용 명세 docs/ui-requests/7-13-part2-apply.md)
import { afterEach, describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { answerEvent, eventById, fireEvent } from '../src/events';
import { pushInbox } from '../src/inbox';
import { ensureManager } from '../src/manager';
import { inboxDetailVM, inboxVM } from '../src/ui/inboxVM';
import { inboxDetailBody, inboxView } from '../src/ui/views/inbox';
import { meetingVM } from '../src/ui/managerVM';
import { meetingView } from '../src/ui/views/manager';
import { financeVM } from '../src/ui/financeVM';
import { financeView } from '../src/ui/views/finance';
import { dayVM, trainingOptionsVM } from '../src/ui/viewModels';
import { calendarSection } from '../src/ui/views/home';
import { trainingSheet } from '../src/ui/views/training';
import { setWideForTest } from '../src/ui/skin';
import { PATCH_LABEL } from '../src/version';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c76i-son', difficulty: 'normal' });

afterEach(() => setWideForTest(null));

describe('C.76i 인박스 (193 · 194 · 197②)', () => {
  it('목록 줄 = 답 필요 칩 · 답할 것 탭 배지 · 빈 상태 [전체 보기]', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    const g = son();
    const it0 = fireEvent(g, eventById('s_charity')!);
    const vm = inboxVM(g, 'all');
    const row = vm.rows.find((r) => r.id === it0.id)!;
    expect(row.chip).toMatch(/^답 필요 · (\d+일 남음|오늘까지)$/);
    const html = inboxView(vm);
    expect(html).toContain('ib-item');
    expect(html).toContain('po-dotbadge');
    answerEvent(g, it0.id, 'go');
    const empty = inboxView(inboxVM(g, 'todo'));
    expect(empty).toContain('답할 것이 없어요');
    expect(empty).toContain('전체 보기');
    expect(inboxVM(g, 'all').rows.find((r) => r.id === it0.id)!.chip).toBe('답함 · 직접 간다');
  });
  it('상세: 기본 선택 칩 · 효과 미리보기 5칸 / 답한 뒤 결과 칸 + 다음 답할 것 · PC 2열', () => {
    const g = son();
    const a = fireEvent(g, eventById('s_charity')!);
    const b = fireEvent(g, eventById('s_sponsor')!);
    const d = inboxDetailVM(g, a.id)!;
    expect(d.choices.find((c) => c.def)?.id).toBe('skip');
    const go = d.choices.find((c) => c.id === 'go')!.fx!;
    expect(go.map((f) => f.label)).toEqual(['신뢰도', '폼', '위상·팬', '돈', '체력']);
    expect(go[2]!.value).toBe('+2');
    expect(go[4]!.value).toBe('−4');
    const body = inboxDetailBody(d, 'go').body;
    expect(body).toContain('효과 미리보기 · 직접 간다');
    expect(body).toContain('기본 선택');
    answerEvent(g, a.id, 'go');
    const after = inboxDetailVM(g, a.id)!;
    expect(after.next?.id).toBe(b.id);
    const ab = inboxDetailBody(after, null, true).body;
    expect(ab).toContain('ib-result');
    expect(ab).toContain('다음 답할 것');
    setWideForTest(true);
    expect(inboxView(inboxVM(g, 'all'), '<i id="side"></i>', a.id)).toContain('ib-pc');
  });
  it('197② 가장 최근 면담 결과 줄 = 남은 n경기 · 신뢰도 칩', () => {
    const g = son();
    const m = ensureManager(g);
    m.perks.slot = 5;
    pushInbox(g, { cat: 'manager', key: `meet:${g.calendar.date}:선호 슬롯 보장`, title: '감독 면담 · 선호 슬롯 보장', body: '다음 5경기', read: true });
    const r = inboxVM(g, 'all').rows[0]!;
    expect(r.tags?.map((t) => t.label)).toEqual(['남은 5경기', `신뢰도 ${Math.round(m.trust)}`]);
    expect(inboxView(inboxVM(g, 'all'))).toContain('ib-tags');
  });
});

describe('C.76i 면담 (191 · 192)', () => {
  it('낮은 신뢰: 요구 강도순 칩 · 감독/내 역할 줄 · 이걸 고르면 22 › 27', () => {
    const g = son();
    const m = ensureManager(g);
    m.meeting = 'low'; m.trust = 22;
    const vm = meetingVM(g)!;
    expect(vm.options.map((o) => o.id)).toEqual(['effort', 'complain', 'request']);
    expect(vm.options.map((o) => o.tag)).toEqual(['요구 약하게', '요구 세게', '요구 가장 세게']);
    const html = meetingView(vm, null);
    expect(html).toContain('mg-info');
    expect(html).toContain('이걸 고르면');
    expect(html).toMatch(/mg-pv__to up">27</);
    setWideForTest(true);
    expect(meetingView(vm, null)).toContain('mg-pc');
  });
  it('포지션 제안 = 지금 → 제안 두 칸 · 보상 = 받는 보상', () => {
    const g = son();
    const m = ensureManager(g);
    m.meeting = 'position';
    const pv = meetingVM(g)!;
    expect(pv.compare).not.toBeNull();
    expect(meetingView(pv, null)).toContain('포지션 비교');
    m.meeting = 'reward'; m.trust = 84;
    expect(meetingView(meetingVM(g)!, null)).toContain('받는 보상');
  });
});

describe('C.76i 재정 (206 · 219 · 220)', () => {
  it('머리말 시즌 칩 짧게 · 최근 내역 건수 · 등급별 가격 칩 · 접기 줄 · 에이전트 두 줄', () => {
    const g = son();
    const vm = financeVM(g);
    expect(vm.netShort).not.toContain('원');
    expect(vm.prices.map((p) => p.rarity)).toEqual(['common', 'rare', 'epic', 'legendary']);
    for (const s of vm.shop ?? []) expect(s.max).toBe(2);
    expect(financeView(vm, 'shop')).toContain('fn-prices');
    const life = financeView(vm, 'life');
    expect(life).toContain('fn-fold');
    expect(life).toContain('일반 에이전트');
    expect(life).toContain('고급 에이전트');
    expect(life).toContain('"자선가"까지');
  });
});

describe('C.76i 훈련·일정 (196 · 200 · 216)', () => {
  it('하루 시트 생활 묶음 · 달력 생활 칸(아이콘 + 두 글자)', () => {
    const g = son();
    const d = dayVM(g)!;
    const day = d.month.days.find((c) => !c.past && !c.today && !c.kind && !c.life);
    if (day) {
      g.training!.overrides[day.date] = 'family';
      const cell = dayVM(g)!.month.days.find((c) => c.date === day.date)!;
      expect(cell.life).toBe('family');
      expect(calendarSection(dayVM(g)!)).toContain('cal-life');
      const opts = trainingOptionsVM(g, day.date);
      if (opts) {
        const sh = trainingSheet(opts, day.date, 'family');
        expect(sh).toContain('tr-lifebox');
        expect(sh).toContain('하루 소모');
        setWideForTest(true);
        expect(trainingSheet(opts, day.date, 'family')).toContain('tr-sheet2');
      }
    }
  });
});
