// C.51 (pending 82 3번): 경기 준비 화면 — 상대 한 줄·전술·내 자리·출전·상태·덱·플레이 방식을 모으고 [경기 시작]
import { describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { prepVM, teamForm } from '../src/ui/prepVM';
import { homeView } from '../src/ui/views/home';
import { homeVM } from '../src/ui/viewModels';
import { prepView } from '../src/ui/views/prep';

function toMatchDay(g: GameState): void {
  for (let i = 0; i < 40 && !isMatchDay(g); i++) {
    playOthers(g, 'quick');
    endDay(g);
  }
  expect(isMatchDay(g)).toBe(true);
}

describe('경기 준비 (C.51)', () => {
  it('상대·대회·전술·내 자리·덱·플레이 방식과 [경기 시작]이 한 화면에', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c51-prep', difficulty: 'normal' });
    toMatchDay(g);
    const vm = prepVM(g)!;
    expect(vm).not.toBeNull();
    expect(vm.comp).toMatch(/^리그 \d+R$/);
    expect(vm.opp.rank).toBeGreaterThan(0);
    expect(vm.me.pos).toBeTruthy();
    expect(vm.deck.sets.length).toBe(g.cards.decks.length);
    const html = prepView(vm);
    for (const act of ['prep-start', 'deck-use', 'ctl-mode']) expect(html).toContain(`data-act="${act}"`);
    expect(html).toContain(vm.opp.name);
  });

  it('최근 폼은 지난 라운드 결과에서 (오래된 것 → 최근, 최대 5)', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c51-form', difficulty: 'normal' });
    // 리그 6라운드까지 (C.75z: 대표팀 소집이면 그 사이 A매치도 내 경기)
    while (g.league.round < 6) {
      toMatchDay(g);
      playOthers(g, 'quick');
      playRound(g);
    }
    const f = teamForm(g.league, g.player.teamId);
    expect(f.length).toBe(5);
    expect(f.every((m) => m === 'W' || m === 'D' || m === 'L')).toBe(true);
    // 마지막 = 방금 치른 내 경기 결과
    const last = g.league.schedule[g.league.round - 1]!.find((x) => x.home === g.player.teamId || x.away === g.player.teamId)!;
    const [a, b] = last.home === g.player.teamId ? [last.homeGoals!, last.awayGoals!] : [last.awayGoals!, last.homeGoals!];
    expect(f.at(-1)).toBe(a > b ? 'W' : a < b ? 'L' : 'D');
  });

  it('홈 [경기 시작]은 경기 준비로 (같은 act), 직접/자동은 홈 한 줄(C.70 디자인 161) + 경기 준비', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c51-home', difficulty: 'normal' });
    toMatchDay(g);
    const html = homeView(homeVM(g));
    expect(html).toContain('data-act="play"');
    expect(html).toContain('data-act="ctl-mode"');
  });

  it('경기 준비는 상태를 바꾸지 않는다 (같은 세이브·같은 설정 → 같은 결과)', () => {
    const a = newGame({ mode: 'real', playerId: 'kane', seed: 'c51-det', difficulty: 'normal' });
    const b = newGame({ mode: 'real', playerId: 'kane', seed: 'c51-det', difficulty: 'normal' });
    toMatchDay(a);
    toMatchDay(b);
    prepView(prepVM(a)!);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    playOthers(a, 'quick');
    playOthers(b, 'quick');
    expect(playRound(a).result).toEqual(playRound(b).result);
  });
});
