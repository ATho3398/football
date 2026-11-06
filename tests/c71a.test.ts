// C.71a (U7-c1): 167 훈련 프리셋 편집 시트 · 168 팀 상세 개요 스쿼드 한 줄 · 169 리그 밖 선수 · 177 이름표 편집 · 182 레전더리 조건 접기
import { describe, expect, it } from 'vitest';
import { newGame, weekFreeDays } from '../src/game';
import { leftPersonVM, personDetailVM, teamDetailVM } from '../src/ui/detailVM';
import { playerVM, presetEditVM } from '../src/ui/viewModels';
import { leftPersonView, personDetailView, teamDetailView } from '../src/ui/views/detail';
import { presetEditSheet } from '../src/ui/views/training';
import { playerView } from '../src/ui/views/player';
import { bodySection, josaIGa } from '../src/ui/views/body';

describe('C.71a U7-c1', () => {
  const g = newGame({ mode: 'real', playerId: 'son', seed: 'c71a', difficulty: 'normal' });

  it('167 편집 시트: 7칸 + 요약 칸 + 종류 줄, 초안 칸을 그대로 보여 주고 고치기면 [삭제]', () => {
    const vm = presetEditVM(g, null, { name: '약발', slots: ['weakFoot', 'weakFoot', 'weakFoot', 'tech', 'recovery', 'tech', 'recovery'] }, 3);
    expect(vm.sel).toBe(3);
    expect(vm.summary).toEqual({ counts: '3·2·2', names: '약발·기술·회복' });
    expect(vm.used).toBe(Math.min(7, weekFreeDays(g)));
    const html = presetEditSheet(vm);
    expect(html).toContain('새 프리셋 만들기');
    expect(html).toContain('4번째 훈련일');
    expect(html).not.toContain('preset-del');
    expect(presetEditSheet({ ...vm, id: 'c1' })).toContain('프리셋 고치기');
    expect(presetEditSheet({ ...vm, id: 'c1' })).toContain('data-act="preset-del"');
  });

  it('168 개요: 스쿼드는 한 줄 링크(스쿼드 탭), 선수 줄은 스쿼드 탭에만', () => {
    const other = g.league.teams.find((t) => t.id !== g.player.teamId)!;
    const vm = teamDetailVM(g, other.id)!;
    const ov = teamDetailView(vm, 'overview', true);
    expect(ov).toContain('dt-squadlink');
    expect(ov).toContain(`스쿼드 ${vm.squadSize}명`);
    const rows = (h: string) => (h.match(/class="dt-row/g) ?? []).length;
    expect(rows(ov)).toBe(vm.key.length);
    expect(rows(teamDetailView(vm, 'squad', true))).toBe(vm.squadSize);
  });

  it('169 다른 선수: 몸·태그 신체 칸, 읽기 전용 안내 / 리그 밖으로 떠난 선수는 빈 화면', () => {
    const tid = g.league.teams.find((t) => t.id !== g.player.teamId)!.id;
    const p = g.rosters[tid]!.players[0]!;
    const vm = personDetailVM(g, p.id)!;
    expect(personDetailView(vm, 'body', true)).toContain('body-stats');
    expect(personDetailView(vm, 'pos', true)).toContain('주 포지션');
    expect(leftPersonVM(g, p.id)).toBeNull();
    const h = structuredClone(g);
    h.transfers.push({ at: 0, season: h.league.season, w: 'summer', id: 'gone', name: '떠난 선수', pos: 'GK', ovr: 81, age: 31, from: tid, to: 'x:rma', ce: h.league.season + 3, loy: 50, why: 'contract' } as (typeof h.transfers)[number]);
    const left = leftPersonVM(h, 'gone')!;
    expect(left.why).toBe('계약 만료');
    const html = leftPersonView(left, true);
    expect(html).toContain('리그 밖 선수예요');
    expect(html).toContain('이적 소식으로 돌아가기');
    expect(html).not.toContain('person-tab');
  });

  it('177 이름표 편집 펼침: 별명 칸 · 미리 보기 · [기본으로][저장]', () => {
    const look = { faceKey: 'p:son', avatar: '', faceNote: '', pixel: '', pixelNote: '', label: '손흥민', labelNote: '', nameEditor: null, edit: { id: 'son', nick: '쏘니', auto: '손흥민', own: true, full: '손흥민' } };
    const html = bodySection(g.player, false, 7, '', look);
    expect(html).toContain('id="nm-nick"');
    expect(html).toContain('쏘니가 안으로 파고듭니다');
    expect(html).toContain('data-act="nm-clear"');
    expect(html).toContain('data-act="nm-save"');
    expect(josaIGa('손흥민')).toBe('이');
  });

  it('182 레전더리 대회 조건 4줄은 접힌 한 줄, 펼치면 4줄', () => {
    const vm = playerVM(g);
    const base = { tab: 'pos' as const, body: '', market: null, points: 0, retired: false };
    const closed = playerView(vm, base);
    // C.76n 4a: 최고 개인상 줄이 더해져 5개
    expect(closed).toContain('대회 조건 5개');
    expect(closed).not.toContain('pl-leg__list');
    expect(playerView(vm, { ...base, legendOpen: true })).toContain('pl-leg__list');
  });
});
