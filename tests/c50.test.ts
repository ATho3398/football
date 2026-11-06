// C.50 (pending 82 2·5·1번): 경기 끝 = 결과 화면만(하이라이트는 [하이라이트 다시보기]), 독 홈 가운데, 선수 이름 한국 통용 표기
import { describe, expect, it } from 'vitest';
import { A_GRADE_PLAYERS } from '../data/players';
import { LEGEND_ROWS } from '../data/players/legends';
import { newGame, playRound } from '../src/game';
import { LEGEND_BY_ID } from '../src/legends';
import type { Replay } from '../src/replay';
import { deserialize, SaveFormatError, serialize } from '../src/save';
import { matchResultVM } from '../src/ui/viewModels';
import { matchResultView } from '../src/ui/views/matchResult';

describe('선수 이름 한국 통용 표기 (C.50)', () => {
  it('레전드: 이름 + 성, 브라질 등은 통칭 한 단어. 짧은 이름도 맞춤', () => {
    const by = new Map(LEGEND_ROWS.map((l) => [l.id, l]));
    const want: [string, string, string][] = [
      ['lg-cruyff', '요한 크루이프', '크루이프'], ['lg-ronaldo9', '호나우두', '호나우두'], ['lg-xavi', '사비 에르난데스', '사비'],
      ['lg-bergkamp', '데니스 베르캄프', '베르캄프'], ['lg-pele', '펠레', '펠레'], ['lg-zico', '지코', '지코'], ['lg-ronaldinho', '호나우지뉴', '호나우지뉴'],
    ];
    for (const [id, name, short] of want) {
      expect(by.get(id)!.nameKo).toBe(name);
      expect(by.get(id)!.shortKo).toBe(short);
    }
    // 긴 본명이 남지 않았다: 4단어 이상은 반 데 사르(성 자체가 여러 단어)뿐
    expect(LEGEND_ROWS.filter((l) => l.nameKo.split(' ').length >= 4).map((l) => l.id)).toEqual(['lg-vandersar']);
    expect(A_GRADE_PLAYERS.find((p) => p.id === 'hazard')!.nameKo).toBe('에덴 아자르');
  });

  it('옛 세이브(29)는 이어 할 수 없음, 지금 형식 왕복은 통용 표기 그대로 (NPC·내 선수)', () => {
    const g = newGame({ mode: 'real', playerId: 'lg-cruyff', seed: 'c50-mig', difficulty: 'normal' });
    expect(g.player.name).toBe('요한 크루이프');
    const back = deserialize(serialize(g));
    expect(back.player.name).toBe(LEGEND_BY_ID.get('lg-cruyff')!.nameKo);
    expect(back.npcs.find((n) => n.id === 'hazard')!.nameKo).toBe('에덴 아자르');
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 29;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(SaveFormatError);
  });
});

describe('경기 결과 화면 [하이라이트 다시보기] (C.50)', () => {
  it('재생 기록이 있으면 버튼, 없으면 없음', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c50-hl', difficulty: 'normal' });
    let rp: Replay | null = null;
    let tries = 0;
    do playRound(g, { onReplay: (r) => { rp = r; } }); while (!rp && ++tries < 6);
    expect(rp).not.toBeNull();
    expect(matchResultView(matchResultVM(g, rp)!)).toContain('data-act="hl-rewatch"');
    expect(matchResultView(matchResultVM(g, null)!)).not.toContain('hl-rewatch');
  });
});
