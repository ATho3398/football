// C.83d U17-d 17차 S10 경기 재생 · S11 경기 결과: 장면 칸 분류 · 클립 [다음 클립] · 결과 머리말 · 득점 줄 · 접힌 리포트
import { describe, expect, it } from 'vitest';
import { replayView, type ReplayVM } from '../src/ui/views/replay';
import { matchResultView } from '../src/ui/views/matchResult';

const base: ReplayVM = {
  home: '토트넘', away: '첼시', side: 0, me: { name: '손흥민', position: 'LW' },
  speed: 1, paused: false, mode: 'scene', scene: 2, at: 100, sceneLabel: '골 장면', transition: null,
  scenes: [
    { minute: "12'", label: '결정적 장면', key: 10, cls: 'chance' },
    { minute: "16'", label: '골', key: 20, cls: 'goal' },
    { minute: "45'", label: '실점', key: 300, cls: 'concede' },
    { minute: "90+3'", label: '내 최고 순간', key: 900, cls: 'best' },
  ],
};

describe('C.83d 재생 화면', () => {
  it('하이라이트: 위 줄 장면 n/전체 · [여기서부터 실시간] · 점수 한 덩어리 · 아래 고정 띠', () => {
    const h = replayView(base);
    expect(h).toContain('장면 <span class="po-num">2/4</span>');
    expect(h).toContain('여기서부터 실시간');
    expect(h).toMatch(/score-cell"><span id="rp-h">0<\/span> : <span id="rp-a">0<\/span>/);
    expect(h).toContain('class="rp-bar"');
    expect(h).toContain('보는 중');
    expect(h).toContain('is-goal');
    expect(h).toContain('is-chance');
  });
  it('실시간: 지나간 장면만 보이고 안 온 칸은 숨김 (2절 18번)', () => {
    const h = replayView({ ...base, mode: 'live', at: 25 });
    const tiles = h.match(/<div class="scene-tile[^>]*>/g)!;
    expect(tiles.filter((t) => t.includes(' hidden')).length).toBe(2);
    expect(h).toContain('하이라이트로');
    expect(h).not.toContain('90+3');
  });
  it('클립: [결과로] · [다음 클립], 마지막 클립이면 [건너뛰기]', () => {
    const c = replayView({ ...base, clips: true });
    expect(c).toContain('결과로');
    expect(c).not.toContain('여기서부터 실시간');
    expect(c).toContain('다음 클립');
    expect(c).toContain('<b>클립</b> <span class="po-num">2/4</span> · 골');
    expect(replayView({ ...base, clips: true, scene: 4 })).toContain('<span>건너뛰기</span>');
  });
});

describe('C.83d 결과 화면', () => {
  const vm = {
    myTeam: '토트넘', face: null, myTeamId: 'tot', oppId: 'che', round: 3, comp: '리그 3R', opp: '첼시', scoreLine: '2\u00a0:\u00a01',
    outcome: 'win', outcomeKo: '승', rating: 7.8, appearance: '선발 90분', formBonus: 0, chips: ['골 1'], banners: [], highlights: [], report: null,
    hasAvgMap: true, sceneCount: 7, clips: [{ kind: 'goal', label: '골', minute: "90+3'", text: '골! 나 — 2 : 1', badge: '내 골' }, { kind: 'best', label: '내 최고 순간', minute: "30'", text: '드리블' }],
    my: [], myMore: [], xp: { gained: 10, value: 50, max: 200, level: 1, levelsGained: 0 }, seasonOver: false, points: 0,
    decisions: [], decisionReplay: false, cardUses: [], env: null, cupBanner: null,
    goals: [{ minute: "90+3'", name: '손흥민', id: 'me', assist: null, mine: true }, { minute: "50'", name: '바디', id: null, assist: null, mine: false }],
  };
  it('머리말 대회 · 상대 · 점수 · 결과 한 줄 + 평점 단위, 하이라이트 한 판 · 득점 분 같은 표기', () => {
    const h = matchResultView(vm as never);
    expect(h).toContain('리그 3R · 첼시전');
    expect(h).toContain('po-hero__unit">평점');
    expect(h).toContain('mr-hl');
    expect(h).toContain('2개 이어 보기');
    expect(h).toMatch(/dec-min">90\+3(&#39;|')/); // 클립 줄
    expect(h).toMatch(/mr-goal__min">90\+3(&#39;|')/); // 득점 줄 (2절 12번: 두 목록 같은 표기)
    expect(h).toContain('mr-v17');
  });
  it('결장이면 큰 자리 "결장" + 사유', () => {
    const h = matchResultView({ ...vm, rating: null, appearance: '부상으로 결장 (재활)' } as never);
    expect(h).toContain('po-hero__value po-num">결장');
    expect(h).toContain('· 부상');
    expect(h).toContain('mr-bench');
  });
});
