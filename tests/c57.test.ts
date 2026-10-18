// C.57 U5-c 홈 · 훈련·일정 · 자동 진행 · 새 기능 안내 (디자인 61~65 · 86~92 · 132 · 133 · 150, B 미페 머리말)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newGame, playRound, type CustomSpec } from '../src/game';
import { autoCustom, customBudget } from '../src/custom';
import { DayCell, HeroPanel, HERO_NAME, heroNameEm, heroNameSize, Modal } from '../src/ui/components';
import { homeVM, trainingOptionsVM, trialVM } from '../src/ui/viewModels';
import { alertCard, alertsHead, homeView, trialStrip } from '../src/ui/views/home';
import { todayRow, trainingSection, trainingSheet } from '../src/ui/views/training';
import { autoResultsHtml, autoSheet, autoLayerHtml } from '../src/ui/views/progress';
import { setSkin } from '../src/ui/skin';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

describe('미페 머리말 이름 자동 크기 (B-apply 2절)', () => {
  it('손흥민은 50px 그대로(약 125px), 최장 "바스티안 슈바인슈타이거"는 24px 이상에서 칸(244px)에 맞는다', () => {
    expect(heroNameSize('손흥민')).toBe(50);
    expect(Math.round(heroNameEm('손흥민') * 50)).toBeGreaterThanOrEqual(120);
    const long = '바스티안 슈바인슈타이거';
    const s = heroNameSize(long);
    expect(s).toBeGreaterThanOrEqual(HERO_NAME.min);
    expect(s).toBeLessThan(HERO_NAME.full);
    expect(heroNameEm(long) * s).toBeLessThanOrEqual(HERO_NAME.width);
    expect(heroNameSize('트렌트 알렉산더아놀드', true)).toBeLessThanOrEqual(HERO_NAME.compact);
    expect(heroNameSize('트렌트 알렉산더아놀드', true)).toBeGreaterThanOrEqual(HERO_NAME.min);
  });

  it('HeroPanel face: 등번호(두 자리 is-two)·사진·이름·OVR·unit, 투명 아니면 is-square', () => {
    const sq = HeroPanel({ title: '홈', back: false, face: 'facepack/players/son.png', kit: 7, name: '손흥민', eyebrow: '토트넘 홋스퍼 · LW', value: 83, unit: 'OVR · LW' });
    expect(sq).toContain('po-hero--face');
    expect(sq).toContain('is-square');
    expect(sq).toMatch(/po-hero__kit[^>]*>7</);
    expect(sq).toContain('data-fit="50"');
    expect(sq).toContain('OVR · LW');
    const cut = HeroPanel({ title: '홈', back: false, face: 'x.webp', cutout: true, kit: 23, name: '이도윤', compact: true });
    expect(cut).not.toContain('is-square');
    expect(cut).toContain('is-two');
    expect(cut).toContain('data-fit="36"');
    expect(HeroPanel({ title: '홈', back: false, value: '9.16' })).not.toContain('po-hero--face');
  });
});

describe('홈 (디자인 86~89)', () => {
  it('B 테마라도 사진이 없으면(생성 선수) 일반 머리말, A 테마도 일반 머리말 · 다음 경기 카드 버튼', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c57-home', difficulty: 'normal' });
    for (const sk of ['b', 'a'] as const) {
      setSkin(sk);
      const h = homeView(homeVM(g));
      expect(h).not.toContain('po-hero--face');
      expect(h).toContain('po-hero--compact');
    }
    setSkin('b');
    const h = homeView(homeVM(g));
    expect(h).toMatch(/계속 · 계획대로 진행|경기 시작/);
    expect(h).toContain('hm-power');
    expect(h).toContain('내 상태');
    expect(h).toContain('100 · 가득');
  });

  it('홈 vm: 등번호·소속·다음 경기 날짜', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c57-son', difficulty: 'normal' });
    const vm = homeVM(g);
    expect(vm.kit).toBeGreaterThan(0);
    expect(vm.team.length).toBeGreaterThan(0);
    expect(vm.nextDate).toMatch(/월 .*일/);
  });

  it('오늘 훈련 한 줄 → 훈련·일정, 고정·XP 줄', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c57-row', difficulty: 'normal' });
    const t = homeVM(g).training!;
    const r = todayRow(t);
    expect(r).toContain('data-v="schedule"');
    expect(r).toContain(`이번 주 훈련 XP`);
  });

  it('알림 카드 · 2개 이상이면 "알림 n · 모두 닫기"', () => {
    expect(alertsHead(1)).toBe('');
    expect(alertsHead(2)).toContain('alerts-close');
    expect(alertCard({ icon: 'star', eyebrow: '태그', title: '노익장', body: 'b', close: 'tag-notice-close' })).toContain('data-act="tag-notice-close"');
  });
});

describe('1군 테스트 띠 (디자인 132)', () => {
  const spec: CustomSpec = {
    position: 'ST', age: 17, attributes: autoCustom('ST', customBudget(17, []), 180), body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 },
    tags: [], nationality: 'England', appearance: 'white', start: { kind: 'youth', club: 'liv' },
  };
  it('경기 칸 n/3: 치른 경기는 평점, 다음 경기는 상대 이름 + 빈 칸, 방출·합격 선', () => {
    const g = newGame({ mode: 'custom', custom: spec, seed: 'c57-trial', difficulty: 'normal' });
    expect(trialVM(g)!.cells.length).toBe(3);
    playRound(g, { engine: 'quick' });
    const t = trialVM(g)!;
    expect(t.games).toBe(1);
    expect(t.cells[0]!.rating).not.toBeNull();
    expect(t.cells[1]!.next).toBe(true);
    const h = trialStrip(t);
    expect(h).toContain('1군 테스트');
    expect(h).toContain('6.0 방출');
    expect(h).toContain('7.0 합격');
    expect(homeView(homeVM(g))).toContain('ft-strip');
  });
});

describe('훈련·일정 (디자인 91·92·150)', () => {
  const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c57-train', difficulty: 'normal' });
  const t = homeVM(g).training!;
  it('주간 7칸 = DayCell (요일·날짜·2글자), 오늘 꼬리표', () => {
    const h = trainingSection(t, false);
    expect((h.match(/class="po-day /g) ?? []).length).toBe(7);
    expect(h).toContain('po-day__today');
    for (const d of t.week) expect(h).toContain(`>${d.short.slice(0, 2)}<`);
  });
  it('DayCell: 고정이면 자물쇠, 경기면 match', () => {
    const c = DayCell({ kind: 'match', day: '토', date: '9.22', label: '경기', fixed: true });
    expect(c).toContain('po-day--match');
    expect(c).toContain('po-day__lock');
  });
  it('하루 훈련 시트: 줄 고르기(train-pick) → [○○으로] 확정, [프리셋대로]', () => {
    const iso = t.week.find((d) => !d.locked)?.date;
    if (!iso) return;
    const o = trainingOptionsVM(g, iso)!;
    const sheet = trainingSheet({ ...o, weakFoot: '지금 0/30 · 시즌 +0/1' }, iso, 'weakFoot');
    expect(sheet).toContain('data-act="train-pick"');
    expect(sheet).toContain('약발 훈련으로');
    expect(sheet).toContain('프리셋대로');
    expect(sheet).toContain('지금 0/30');
    expect(trainingSheet(o, iso, 'rest')).toContain('휴식으로');
  });
});

describe('자동 진행 (디자인 61~64) · 새 기능 안내 (65)', () => {
  it('시트: 경기 수 칩 · 직접 입력 · 아직 없는 대회는 잠긴 칩 묶음 · 아래 큰 버튼', () => {
    const vm = { remaining: 37, quick: [1, 3, 5, 10], date: '8월 13일 (월)', targets: [
      { id: 'derby', label: '더비', available: true, next: { date: '9월 1일 (토)', iso: '2018-09-01', text: '아스널전', before: 2, left: 2 } },
      { id: 'a', label: '국가대표 A매치', available: false, next: null },
    ] };
    const h = autoSheet(vm, 5);
    expect(h).toContain('시즌 끝 · 37');
    expect(h).toContain('auto-locked__chip');
    expect(h).toContain('5경기 자동 진행');
    expect(h).toContain('po-sheet__foot');
  });
  it('레이어 카드: n / m경기 · 최근 결과 · 순위·쌓인 포인트 · 중단', () => {
    expect(autoLayerHtml()).toContain('auto-layer__results');
    const r = autoResultsHtml([{ label: '2R', opp: '풀럼', gf: 3, ga: 1, rating: 7.4 }, { label: '3R', opp: '맨유', gf: 0, ga: 1, rating: 6.3 }]);
    expect(r).toContain('3-1 승');
    expect(r).toContain('0-1 패');
  });
  it('새 기능 Modal 꼬리표', () => {
    expect(Modal({ title: '이제 팀 전술을 내가 정해요', badge: '새 기능', icon: 'star' })).toContain('po-modal__badge');
  });
});

describe('마무리', () => {
  it('버전 C.57 · 34m단계, CSS 블록', () => {
    // C.58부터 다음 패치 번호 (tests/c58.test.ts)
    expect(PATCH_LABEL).toMatch(/^C\.\d+/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
    expect(readFileSync('src/ui/style.css', 'utf8')).toContain('C.57 U5-c');
  });
});
