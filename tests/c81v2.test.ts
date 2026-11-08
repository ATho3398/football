// C.81v2 하이라이트 클립 골 문구 점수: 결과 화면은 내 팀 먼저 (재생 데이터 문구는 홈 : 원정)
import { describe, expect, it } from 'vitest';
import { clipTextMyFirst } from '../src/highlightClass';
import { scoreText } from '../src/text';

// 실제 문구와 같은 점수 표기 (scoreText = NBSP 둘레)
const goal = (h: number, a: number) => `골! 해리 케인 (토트넘 홋스퍼) · 도움 손흥민 — ${scoreText(h, a)}`;

describe('clipTextMyFirst (C.81v2)', () => {
  it('홈 · 득점: 홈 2:0 승리 골 → 그대로 "2 : 0"', () => {
    expect(clipTextMyFirst(goal(2, 0), 0)).toBe(goal(2, 0));
  });
  it('홈 · 실점: 상대가 넣어 1:1 → 그대로 "1 : 1", 1:2 → "1 : 2"', () => {
    expect(clipTextMyFirst(goal(1, 2), 0)).toBe(goal(1, 2));
  });
  it('원정 · 득점: 원정 2:0 승리(문구 "0 : 2") → 내 팀 먼저 "2 : 0"', () => {
    expect(clipTextMyFirst(goal(0, 2), 1)).toBe(goal(2, 0));
  });
  it('원정 · 실점: 홈팀 골로 1:0(문구 "1 : 0") → 내 팀 먼저 "0 : 1"', () => {
    expect(clipTextMyFirst(goal(1, 0), 1)).toBe(goal(0, 1));
  });
  it('골이 아닌 문구는 그대로', () => {
    expect(clipTextMyFirst('슈팅 (유효) 해리 케인', 1)).toBe('슈팅 (유효) 해리 케인');
  });
});

describe('결과 화면 하이라이트 클립 골 점수 = 득점 줄 점수 (실제 경기, 엔진)', () => {
  it('원정 경기에서 골 클립 점수가 내 팀 먼저 (득점 줄과 같은 점수가 있다)', async () => {
    const { newGame, playRound } = await import('../src/game');
    const { matchResultVM } = await import('../src/ui/viewModels');
    const { makeMatchClips, withClips } = await import('../src/highlightClips');
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c81v-m', difficulty: 'normal' });
    // 이 시드는 1~8라운드 홈, 9~12라운드 원정 — 앞 8경기는 빠른 계산으로 넘긴다
    while (g.league.round < 8) playRound(g, { engine: 'quick' });
    let checked = 0;
    for (let k = 0; k < 8 && checked < 2; k++) {
      let rp: import('../src/replay').Replay | null = null;
      playRound(g, { engine: 'agent', onReplay: (r) => { rp = r; } });
      const m = g.lastMatch!;
      if (!rp) continue;
      const mc = makeMatchClips(rp, { season: m.season, round: m.round, label: '' });
      if (mc) g.clips = withClips(g.clips, mc);
      const vm = matchResultVM(g, null)!;
      const clip = (vm.clips ?? []).find((c) => c.kind === 'goal' || c.kind === 'concede');
      if (!clip) continue;
      const sc = clip.text.match(/— (\d+\s*:\s*\d+)$/)?.[1];
      if (!sc) continue;
      // 득점 줄(내 팀 먼저)의 점수 목록 안에 클립 점수가 있다
      const rows: string[] = [];
      let f = 0; let a = 0;
      for (const x of vm.goals) { if (x.mine) f++; else a++; rows.push(scoreText(f, a)); }
      expect(rows).toContain(sc);
      if (!m.home) checked++;
    }
    expect(checked).toBeGreaterThan(0);
  }, 240_000);
});
