// C.56 (34l, U5-b): 결정 순간 한 화면 · 결과 카드 · 카드 장면 시트 · 이름표 겹침 규칙(74) · 세로 잘라 보기(crop)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Moment } from '../src/engine/moments';
import type { ReplayFrame, ReplayPlayer } from '../src/replay';
import { ChoiceButton, ResultSplash } from '../src/ui/components';
import { attackFrac, clampCenter, cropLength, layoutLabels, type LabelBox, type LabelItem } from '../src/ui/pitch/renderer';
import { actionWord, momentCenter, momentView, outcomeView, type OutcomeVM } from '../src/ui/views/moment';

const measure = (t: string) => ({ w: t.length * 8 + 8, h: 14 });
const place = { below: () => 1.08, gap: 2, width: 358, height: 300 };
const overlap = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 박스 근처 밀집 장면: 12명이 60×60 칸 안에 */
function crowd(): LabelItem[] {
  const out: LabelItem[] = [];
  for (let i = 0; i < 12; i++) {
    out.push({ id: `p${i}`, x: 150 + (i % 4) * 18, y: 80 + Math.floor(i / 4) * 20, rr: 9, full: `선수이름${i} 길게`, short: `이름${i}`, me: i === 7, carrier: i === 3, dist: i });
  }
  return out;
}

describe('C.56 이름표 겹침 규칙 (74)', () => {
  it('밀집 장면에서 겹치는 이름표 0', () => {
    const boxes = layoutLabels(crowd(), measure, place);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
  });
  it('내 선수는 항상 풀네임, 공 가진 선수는 항상 보이고, 나머지는 짧은 이름이나 숨김', () => {
    const items = crowd();
    const boxes = layoutLabels(items, measure, place);
    const me = boxes.find((b) => b.id === 'p7');
    expect(me?.text).toBe('선수이름7 길게');
    expect(me?.kind).toBe('me');
    expect(boxes.find((b) => b.id === 'p3')?.kind).toBe('carrier');
    expect(boxes.length).toBeLessThan(items.length);
    expect(boxes.some((b) => b.kind === 'other' && b.text.startsWith('이름'))).toBe(true);
  });
  it('떨어져 있으면 모두 풀네임 (마커 아래)', () => {
    const items: LabelItem[] = [0, 1, 2].map((i) => ({ id: `q${i}`, x: 40 + i * 130, y: 60, rr: 9, full: `풀네임${i}`, short: `짧${i}`, me: false, carrier: false, dist: i }));
    const boxes = layoutLabels(items, measure, place);
    expect(boxes.map((b) => b.text)).toEqual(['풀네임0', '풀네임1', '풀네임2']);
    expect(boxes.every((b) => b.y > 60)).toBe(true);
  });
  it('아래 자리가 막히면 위로', () => {
    const items: LabelItem[] = [
      { id: 'a', x: 100, y: 60, rr: 9, full: '가나다라', short: '가', me: false, carrier: false, dist: 0 },
      { id: 'b', x: 100, y: 88, rr: 9, full: '마바사아', short: '마', me: false, carrier: false, dist: 1 },
    ];
    const boxes = layoutLabels(items, measure, place);
    const b = boxes.find((x) => x.id === 'b')!;
    expect(b.y).toBeGreaterThan(88);
    expect(boxes.find((x) => x.id === 'a')!.y).toBeLessThan(88 - 9);
  });
});

describe('C.56 세로 잘라 보기 (crop)', () => {
  it('캔버스 비율이 보이는 길이를 정한다', () => {
    expect(cropLength(358, 553, true)).toBeCloseTo(1, 2);
    expect(cropLength(358, 276, true)).toBeCloseTo(0.5, 2);
    expect(cropLength(358, 230, false)).toBe(1);
    expect(clampCenter(0.95, 0.44)).toBeCloseTo(0.78, 5);
    expect(clampCenter(0.1, 0.44)).toBeCloseTo(0.22, 5);
    expect(attackFrac(105, 1)).toBe(1);
    expect(attackFrac(105, -1)).toBe(0);
  });
  it('결정 순간 칸: 슈팅 찬스면 상대 골 쪽, 내 선수는 늘 안에', () => {
    const players = new Map<string, ReplayPlayer>([
      ['gk', { id: 'gk', team: 0, number: 1, name: 'GK', position: 'GK', gk: true, isMe: false }],
      ['me', { id: 'me', team: 0, number: 7, name: '손흥민', position: 'LW', gk: false, isMe: true }],
    ] as [string, ReplayPlayer][]);
    const frame = { e: 0, t: 0, ball: { x: 88, y: 20, z: 0 }, carrier: 'me', players: [{ id: 'gk', x: 3, y: 34 }, { id: 'me', x: 88, y: 20 }] } as unknown as ReplayFrame;
    const len = 0.44;
    const c = momentCenter(frame, players, 0, 'me', [{ x: 105 }, { x: 80 }], len);
    expect(c).toBeCloseTo(1 - len / 2, 5);
    const back = momentCenter(frame, players, 0, 'me', [{ x: 10 }], len);
    expect(88 / 105).toBeLessThanOrEqual(back + len / 2);
    expect(88 / 105).toBeGreaterThanOrEqual(back - len / 2);
  });
});

const M: Moment = {
  id: 3, type: 'onball', scene: 'shot', t: 960, minute: 16, stake: 0.7, score: [2, 0], side: 0,
  options: [
    { kind: 'safe', action: 'pass', label: '잭 라이트에게 백패스', p: 0.88, success: '패스 연결', fail: '공을 뺏김', up: 0.02, down: -0.02, value: 0.02, to: { x: 70, y: 30 }, ref: 0 },
    { kind: 'balanced', action: 'pass', label: '크리스티안 에릭센에게 컷백', p: 0.65, success: '컷백 연결', fail: '차단당함', up: 0.02, down: -0.02, value: 0.03, to: { x: 92, y: 30 }, ref: 1 },
    { kind: 'gamble', action: 'shot', label: '숏', p: 0.12, success: '골', fail: '막히거나 빗나감', up: 0.99, down: 0, value: 0.1, to: { x: 105, y: 34 }, ref: 2 },
  ],
  cards: [
    { hand: 0, id: 'curler', name: '감아차기', text: '감아차기 선택지', usable: true, role: 'play', option: { kind: 'card', action: 'shot', label: '먼 포스트 감아차기', p: 0.21, baseP: 0.12, success: '골', fail: '골대 밖', up: 0.6, down: -0.1, value: 0.2, to: { x: 105, y: 30 }, ref: 2 } },
    { hand: 1, id: 'fakeShot', name: '페이크 슛', text: '확률 +8', usable: false, reason: '조건 미달', role: 'prob' },
  ],
  passives: [], me: 'me',
} as unknown as Moment;

describe('C.56 결정 순간 한 화면 (77~79)', () => {
  it('ChoiceButton compact: 유형·확률 막대, 카드 변화는 옛 확률 취소선 + ▲', () => {
    const h = ChoiceButton({ kind: 'balanced', name: '컷백', chance: 65, chanceDelta: 8, deltaSource: '카드', success: { text: '연결', rating: '+0.02' }, fail: { text: '차단', rating: '−0.02' }, compact: true, selected: true, act: 'mo-pick', data: { v: 1 } });
    expect(h).toContain('po-choice--compact');
    expect(h).toContain('is-selected');
    expect(h).toContain('<s class="po-num">65%</s>');
    expect(h).toContain('73<small>%</small>');
    expect(h).toContain('▲+8');
  });
  it('확정 버튼 = 고른 선택지 행동 + 확률, 패 = 카드 그림 한 줄(C.66), 정지 빈도는 한 화면 아래', () => {
    const h = momentView({ moment: M, teams: ['토트넘 홋스퍼', '레스터 시티'], selected: 0, card: null, stop: 'important', last: null, count: 1 });
    expect(h).toContain('확정 · 백패스 88%');
    expect(h).toContain('moment mo-fold');
    expect((h.match(/class="po-card po-card--hand /g) ?? []).length).toBe(2);
    expect(h).toContain('aria-disabled="true"');
    expect(h.indexOf('mo-more')).toBeGreaterThan(h.indexOf('mo-confirm'));
    expect(actionWord('먼 포스트 감아차기')).toBe('감아차기');
  });
  it('플레이 카드를 고르면 4번째 선택지(플레이 카드 칩 + 바탕 대비 변화)', () => {
    const h = momentView({ moment: M, teams: ['토트넘', '레스터'], selected: 3, card: 0, stop: 'important', last: null, count: 1 });
    expect(h).toContain('po-choice--play');
    expect(h).toContain('<span class="po-choice__card">감아차기</span>');
    expect(h).toContain('확정 · 감아차기 21%');
    expect(h).toContain('감아차기를 골랐어요 · 4번째 선택지');
  });
  it('카드 장면 시트 (80): [안 쓰고 계속] = 카드 없이, [카드 쓰기] = 카드 선택지', () => {
    const react = { ...M, type: 'react', options: [{ ...M.options[0]!, label: '카드 없이' }], cards: [M.cards[0]!] } as Moment;
    const h = momentView({ moment: react, teams: ['토트넘', '레스터'], selected: 1, card: 0, stop: 'important', last: null, count: 2 });
    expect(h).toContain('카드를 쓸까요?');
    expect(h).toContain('data-act="mo-pick-confirm" data-v="0"');
    expect(h).toContain('data-act="mo-pick-confirm" data-v="1"');
    expect(h).toContain('감아차기 쓰기');
    expect(h).not.toContain('mo-delegate');
  });
});

describe('C.56 결정 결과 (81~84)', () => {
  const base: OutcomeVM = {
    moment: M, teams: ['토트넘', '레스터'], choice: '안전 · 잭 라이트에게 백패스 (88%)', kind: 'safe',
    band: { tone: 'success', title: '성공', flow: '패스 연결 → 라이트 받음', delta: '평점 +0.02' }, headline: '패스 연결', ratingDelta: 0.02, rating: 7.2, card: null, score: [2, 0], shown: false,
  };
  it('재생 중 = [결과 바로 보기], 결과 = 결과 카드 + 평점 + [계속]', () => {
    expect(outcomeView(base)).toContain('결과 바로 보기');
    expect(outcomeView(base)).not.toContain('po-splash');
    const shown = outcomeView({ ...base, shown: true });
    expect(shown).toContain('po-splash--ok');
    expect(shown).toContain('패스 연결');
    expect(shown).toContain('7.2');
    expect(shown).toContain('>계속<');
  });
  it('카드 사용 (84): 내 선택 옆 칩 + 아래 안내', () => {
    const h = outcomeView({ ...base, shown: true, card: '감아차기', kind: 'card' });
    expect(h).toContain('카드 사용');
    expect(h).toContain('감아차기 카드를 썼어요');
  });
  it('ResultSplash 실패·보통', () => {
    expect(ResultSplash({ result: 'fail', title: '공을 뺏김' })).toContain('po-splash--bad');
    expect(ResultSplash({ result: 'neutral', title: '보통' })).toContain('po-splash--flat');
  });
});

describe('C.56 화면 규칙', () => {
  const css = readFileSync('src/ui/style.css', 'utf8');
  it('폰 한 화면: 독 위까지 높이 고정, 피치 칸이 남는 높이', () => {
    expect(css).toMatch(/\.mo-fold \{ height: calc\(100dvh - var\(--fold-dock, 0px\)\)/);
    expect(css).toContain('.has-nav .mo-fold { --fold-dock: 72px; }');
    expect(css).not.toContain('.oc-band');
  });
  it('엔진은 읽기만 (평점 표시) — 엔진 파일을 바꾸지 않는다', () => {
    const main = readFileSync('src/ui/main.ts', 'utf8');
    expect(main).toContain("import { ratingFromParts, ratingParts } from '../engine/rating';");
  });
});
