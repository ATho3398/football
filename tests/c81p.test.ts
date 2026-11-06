// C.81p (53단계): 이름·점수 줄바꿈 규칙 · 점수 표기 "2 : 0" 하나 · 빠진 상태 화면(은퇴 · 결과 도장 보통/실점 · 빈 기록)
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newGame, playRound, retire, type GameState } from '../src/game';
import { outcomeBand, type DecisionOutcome } from '../src/decisionOutcome';
import { NBSP, pensText, scoreText } from '../src/text';
import { replayEvents } from '../src/replay';
import { ResultSplash, FeedItem } from '../src/ui/components';
import { playerVM } from '../src/ui/viewModels';
import { playerView } from '../src/ui/views/player';
import { matchResultView } from '../src/ui/views/matchResult';
import { RETIRED_DOCK, retiredDock, seasonMatchesSection } from '../src/ui/views/common';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import type { MatchEvent } from '../src/engine/types';

const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');

describe('점수 표기 하나 (수정 요청 4번)', () => {
  it('"2 : 0" — 앞뒤 띄우고, 띄운 칸은 줄바꿈 없는 칸', () => {
    expect(scoreText(2, 0)).toBe(`2${NBSP}:${NBSP}0`);
    expect(scoreText(2, 0).replace(/ /g, ' ')).toBe('2 : 0');
    expect(scoreText(10, 3)).not.toMatch(/[\s-](?<! )/);
    expect(pensText([4, 3]).replace(/ /g, ' ')).toBe('승부차기 4 : 3');
  });

  it('화면 코드에 옛 "a-b" 점수 조립이 남지 않는다', () => {
    const files = ['src/ui/viewModels.ts', 'src/ui/seasonVM.ts', 'src/ui/nationalVM.ts', 'src/ui/detailVM.ts', 'src/ui/views/matchResult.ts', 'src/ui/views/progress.ts', 'src/seasonHighlights.ts'];
    for (const f of files) {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/\$\{[^}]*(goalsFor|\.gf|\.hg|score\[0\]|pens\[0\])[^}]*\}-\$\{/);
    }
  });

  it('리플레이 골 피드: 점수는 글 밖 오른쪽 칸', () => {
    const ev = [{ type: 'goal', t: 600, team: 0, players: ['a', 'b'], params: { home: 1, away: 0 } }] as unknown as MatchEvent[];
    const [x] = replayEvents(ev, [{ id: 'a', name: '호베르투 피르미누' }, { id: 'b', name: '엘리아키무 망갈라' }] as never, ['리버풀', '첼시'], (t) => t);
    expect(x!.text).toContain(scoreText(1, 0));
    const html = FeedItem({ text: '골! 호베르투 피르미누 (리버풀) · 도움 엘리아키무 망갈라', kind: 'goal', score: scoreText(1, 0) });
    // 점수는 글(po-feed__t) 형제 — 이름과 같은 줄 상자에 섞이지 않는다
    expect(html).toMatch(/<span class="po-feed__t">[^<]*<\/span><b class="po-feed__score po-num score-cell">1 : 0<\/b>/);
  });

  it('경기 결과 득점 줄: 점수는 이름 칸(.grow) 밖 오른쪽 고정 칸', () => {
    const html = matchResultView({
      myTeam: '리버풀', myTeamId: 'liv', opp: '첼시', oppId: 'che', scoreLine: scoreText(1, 1), outcome: 'draw', outcomeKo: '무', comp: '리그 1R', round: 1,
      rating: 7, chips: ['선발 90분'], hasAvgMap: false, highlights: [], banners: [], report: null, my: [], myMore: [], formBonus: 0, appearance: '선발 90분',
      decisions: [], decisionReplay: false, points: 0, seasonOver: false, xp: { value: 6, gained: 52, max: 272, level: 0, levelsGained: 0 }, cardUses: [],
      goals: [{ minute: "12'", name: '호베르투 피르미누', id: null, mine: true, assist: '엘리아키무 망갈라' }, { minute: "80'", name: '스튜어트 플렉', id: null, assist: null, mine: false }],
    } as never);
    const rows = html.match(/<div class="mr-goal[^]*?<\/div>/g) ?? [];
    expect(rows.length).toBe(2);
    for (const r of rows) {
      expect(r).toMatch(/<\/span>(<span class="mr-goal__me">나<\/span>)?<b class="po-num mr-goal__score score-cell">\d : \d<\/b><\/div>$/);
    }
  });

  it('CSS: 이름은 어절 단위(keep-all), 글자 단위 최소 너비(anywhere)를 덮고, 점수 칸은 줄바꿈 없음', () => {
    expect(css).toMatch(/word-break: keep-all;/);
    const tail = css.slice(css.indexOf('C.81p 이름·점수 줄바꿈 규칙'));
    expect(tail).toMatch(/body \{ overflow-wrap: break-word; \}/);
    expect(tail).toMatch(/\.score-cell \{ flex: none; white-space: nowrap;/);
  });
});

describe('결과 도장 "보통" · "실점" (수정 요청 9번)', () => {
  const base: DecisionOutcome = { from: 0, to: 5, steps: ['따라붙어 지연'], goal: null, end: 'end', ok: null } as DecisionOutcome;
  it('판정 없는 흐름(따라붙기·패스길 막기) = 보통, 상대 골 = 실점', () => {
    const neutral = outcomeBand(base, { result: 'neutral', delta: 0 } as never, 0);
    expect(neutral.tone).toBe('neutral');
    expect(neutral.title).toBe('보통');
    expect(ResultSplash({ result: neutral.tone, title: '지연', compact: true })).toContain('보통');
    const conceded = outcomeBand({ ...base, goal: 1, steps: ['돌파 실패', '역습', '실점'] }, { result: 'fail', delta: -0.31 } as never, 0);
    expect(conceded.tone).toBe('conceded');
    expect(ResultSplash({ result: conceded.tone, title: '역습 실점', compact: true })).toMatch(/po-splash--concede[^]*실점/);
  });
});

describe('빠진 상태 화면', () => {
  const prospect = (seed: string) => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });

  it('기록 없음(데뷔 전): 경기 기록 빈 문구', () => {
    const g = prospect('c81p-empty');
    const html = seasonMatchesSection(playerVM(g).matches);
    expect(html).toContain('아직 경기 기록이 없어요');
  });

  it('은퇴: 선수 화면에 현역 값(나이 "n세" 머리말 · 다음 위상까지 · 레벨 막대 · 꾸미기) 없음, 커리어 요약 길(새 커리어는 독)', () => {
    const g: GameState = prospect('c81p-ret');
    g.player.age = 34;
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    retire(g);
    expect(g.phase).toBe('retired');
    const vm = playerVM(g);
    for (const tab of ['attrs', 'record'] as const) {
      const html = playerView(vm, { tab, body: '', market: null, points: 0, retired: true });
      expect(html).not.toContain(`· ${vm.age}세<`);
      expect(html).not.toContain('pl-lv__bar');
      expect(html).not.toMatch(/월드클래스까지|월드클래스예요|까지 \d+점/);
      expect(html).not.toContain('꾸미기');
      expect(html).toContain('data-to="retired"');
      expect(html).toContain(`${vm.age}세 은퇴`);
    }
  });

  it('은퇴 독: 쓸 수 있는 칸만 (커리어 · 선수 · 새 게임 · 저장 · 설정), 폰·PC 같은 칸', () => {
    const html = retiredDock('player');
    expect([...RETIRED_DOCK]).toEqual(['summary', 'player', 'prog', 'saves', 'settings']);
    const bars = html.match(/<div class="po-dock[^"]*"[^]*?(?=<div class="po-dock|<\/nav>)/g) ?? [];
    expect(bars.length).toBe(2);
    for (const b of bars) {
      expect((b.match(/<button/g) ?? []).length).toBe(5);
      for (const gone of ['홈', '훈련', '상점', '덱', '전술', '인박스', '재정', '월드']) expect(b).not.toContain(`po-dock__label">${gone}<`);
    }
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('data-to="new"');
    expect(html).toContain('새 게임');
  });

  it('버전 표시', () => {
    expect(PATCH_LABEL).toBe('C.81p');
    expect(STAGE_LABEL).toBe('53단계');
  });
});
