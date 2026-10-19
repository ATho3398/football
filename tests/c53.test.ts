// C.53 (pending 82 4번): 다른 팀·다른 선수 상세 — 디자인 157·158, 읽기 전용
import { describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { personDetailVM, teamDetailVM } from '../src/ui/detailVM';
import { prepVM } from '../src/ui/prepVM';
import { matchResultVM, worldVM } from '../src/ui/viewModels';
import { personDetailView, teamDetailView } from '../src/ui/views/detail';
import { prepView } from '../src/ui/views/prep';
import { worldView } from '../src/ui/views/screens';
import { matchResultView } from '../src/ui/views/matchResult';

function toMatchDay(g: GameState): void {
  for (let i = 0; i < 40 && !isMatchDay(g); i++) {
    playOthers(g, 'quick');
    endDay(g);
  }
}

describe('팀·선수 상세 (C.53)', () => {
  const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c53-detail', difficulty: 'normal' });
  for (let r = 0; r < 3; r++) {
    toMatchDay(g);
    playOthers(g, 'engine');
    playRound(g);
  }
  const opp = g.league.teams.find((t) => t.id !== g.player.teamId)!;

  it('팀 상세: 순위·전력·재정·전술·스쿼드·경기, 탭 4개 모두 그려진다', () => {
    const vm = teamDetailVM(g, opp.id)!;
    expect(vm.rank).toBeGreaterThan(0);
    expect(vm.squadSize).toBe(g.rosters[opp.id]!.players.length);
    expect(vm.slots.length).toBe(11);
    expect(vm.matches.length).toBe(g.league.schedule.length);
    expect(vm.matches.filter((m) => m.score).length).toBe(3);
    expect(vm.mine).toBe(false);
    for (const tab of ['overview', 'squad', 'tactics', 'matches'] as const) {
      const html = teamDetailView(vm, tab, true);
      expect(html).toContain('data-act="detail-back"');
      expect(html).toContain(tab === 'matches' ? 'data-act="team-open"' : 'data-act="person-open"');
    }
  });

  it('내 팀 상세에는 내 선수 줄이 있고 누르면 선수 화면(me)', () => {
    const vm = teamDetailVM(g, g.player.teamId)!;
    expect(vm.mine).toBe(true);
    expect(vm.squad.flatMap((x) => x.rows).some((r) => r.me && r.id === 'me')).toBe(true);
    expect(teamDetailView(vm, 'squad', false)).toContain('data-v="me"');
  });

  it('선수 상세: 1~20 능력치·몸값·계약·기록, 탭 5개, 편집 버튼 없음', () => {
    const p = g.rosters[opp.id]!.players.find((x) => x.position !== 'GK')!;
    const vm = personDetailVM(g, p.id)!;
    expect(vm.teamId).toBe(opp.id);
    expect(vm.attrs.flatMap((a) => a.cells).length).toBeGreaterThan(10);
    expect(vm.value).toBeTruthy();
    for (const tab of ['attrs', 'body', 'pos', 'record', 'contract'] as const) {
      const html = personDetailView(vm, tab, true);
      expect(html).not.toMatch(/data-act="(raise|alloc-sel|transfer-request|faceon-open)"/);
    }
    const gk = g.rosters[opp.id]!.players.find((x) => x.position === 'GK')!;
    const gvm = personDetailVM(g, gk.id)!;
    expect(gvm.attrs[0]!.cells.length).toBe(4);
    expect(personDetailVM(g, 'nobody')).toBeNull();
    expect(teamDetailVM(g, 'x:bar')).toBeNull();
  });

  it('연결: 경기 준비 [팀 상세], 순위표 팀·득점 순위 선수, 경기 결과 팀', () => {
    toMatchDay(g);
    const pv = prepVM(g)!;
    expect(prepView(pv)).toContain(`data-act="team-open" data-v="${pv.opp.id}"`);
    const w = worldView(worldVM(g), 'table');
    expect(w).toContain('data-act="team-open"');
    expect(worldView(worldVM(g), 'scorers')).toContain('data-act="person-open"');
    expect(worldView(worldVM(g), 'stars')).toContain('data-act="person-open"');
    const mr = matchResultVM(g, null)!;
    expect(matchResultView(mr)).toContain(`data-v="${mr.oppId}"`);
  });

  it('상세 VM은 상태를 바꾸지 않는다', () => {
    const before = JSON.stringify(g.league) + JSON.stringify(g.playerStats);
    teamDetailVM(g, opp.id);
    personDetailVM(g, g.rosters[opp.id]!.players[0]!.id);
    expect(JSON.stringify(g.league) + JSON.stringify(g.playerStats)).toBe(before);
  });
});
