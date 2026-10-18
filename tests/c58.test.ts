// C.58 U5-d 선수 5탭 · 포인트 찍기 · 새 게임 (디자인 93~96 · 113~115 · 124~131 · 134~136, B 미페 머리말 compact)
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { allocateVM, DISPLAY_GROUPS, newGameVM, playerVM } from '../src/ui/viewModels';
import { customAct, customVM, initialCustomForm } from '../src/ui/customVM';
import { marketVM } from '../src/ui/transferVM';
import { contractSection, PLAYER_TABS, playerView, type PlayerTab } from '../src/ui/views/player';
import { bodySection, tagsSheet } from '../src/ui/views/body';
import { CUSTOM_STEPS, customBody } from '../src/ui/views/custom';
import { allocateView, NEW_GAME_UI, newGameView } from '../src/ui/views/screens';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c58-son', difficulty: 'normal' });

describe('선수 화면 5탭 (디자인 93~96 · 134 · 136)', () => {
  it('탭 5개(능력치 · 몸·태그 · 포지션 · 기록 · 계약), 탭마다 본문이 바뀐다', () => {
    const g = son();
    expect(PLAYER_TABS.map((t) => t.label)).toEqual(['능력치', '몸·태그', '포지션', '기록', '계약']);
    const vm = playerVM(g);
    const html = (tab: PlayerTab) => playerView(vm, { tab, body: '<i id="body-tab"></i>', market: marketVM(g), points: 3, retired: false });
    expect(html('attrs')).toContain('ag--4');
    expect(html('attrs')).toContain('3P 찍기');
    expect(html('attrs')).toContain('data-to="allocate"');
    expect(html('body')).toContain('id="body-tab"');
    expect(html('pos')).toContain('포지션별 OVR · 숙련도');
    expect(html('pos')).toContain('레전더리 조건');
    expect(html('record')).toContain('경고와 출장');
    expect(html('record')).toContain('시즌별');
    expect(html('contract')).toContain('바이아웃');
    expect(html('contract')).toContain('재정 등급');
    // 프로필 줄 [꾸미기] = 몸·태그 탭 "내 모습"으로
    expect(html('attrs')).toMatch(/data-act="player-tab" data-v="body" data-look="1"/);
    // 테스트 환경(matchMedia 없음 · 사진 없음): 일반 compact 머리말
    expect(html('attrs')).toContain('po-hero--compact');
  });

  it('능력치 표시 묶음 = 디자인 7묶음(민첩성은 몸 다루기), 25개가 한 번씩', () => {
    expect(DISPLAY_GROUPS.map((d) => d.name)).toEqual(['몸 다루기', '마무리', '패스·시야', '수비', '스피드', '피지컬', '정신']);
    expect(DISPLAY_GROUPS[0]!.attrs).toContain('agility');
    const all = DISPLAY_GROUPS.flatMap((d) => d.attrs);
    expect(all.length).toBe(FIELD_ATTRIBUTES.length);
    expect(new Set(all)).toEqual(new Set(FIELD_ATTRIBUTES));
  });

  it('계약 탭: 조건 미달이면 이유 줄 + 잠긴 [이적 요청]', () => {
    const g = son();
    const html = contractSection(marketVM(g));
    expect(html).toContain('지금은 요청할 수 없어요');
    expect(html).toMatch(/data-act="transfer-request" disabled/);
    expect(html).toContain('이 금액 이상 제안은 구단이 거절하지 못해요');
  });

  it('몸·태그 탭: 신체 5칸 · 약발 +1 · TagChip · 내 모습 3줄, 태그 전체 시트는 4묶음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c58-tags', difficulty: 'normal' });
    g.player.tags = [
      { id: 'ironMan', season: 2018, perm: true },
      { id: 'troublemaker', season: 2018, perm: false },
      { id: 'evergreen', season: 2019, perm: false, play: true },
      { id: 'goalMachine', season: 2019, perm: true, play: true },
      { id: 'professional', season: 2018, perm: true },
    ] as typeof g.player.tags;
    const look = { faceKey: 'p:me', avatar: '<i></i>', faceNote: '기본 얼굴', pixel: '<i></i>', pixelNote: '자동', label: '이도윤', labelNote: '별명 없음', nameEditor: null };
    const html = bodySection(g.player, false, 23, '리버풀', look, 'liverpool');
    expect(html).toContain('신체 · 양발');
    expect(html).toContain('포인트 부족');
    expect(html).toContain('po-tag');
    expect(html).toContain('+1</button>');
    expect(html).toContain('경기 화면 이름표');
    expect(html).toContain('data-act="look-name"');
    const sheet = tagsSheet(g.player, '이도윤', '리버풀');
    for (const t of ['생성 태그 3', '커리어 태그', '플레이 태그 1', '스토리 태그 1']) expect(sheet).toContain(t);
    expect(sheet).toContain('해제까지 진행 중');
    expect(sheet).toContain('po-tag--story');
  });
});

describe('포인트 찍기 (디자인 113, C.49 규칙 유지)', () => {
  it('compact 머리말 · OVR 한 줄 · 비용 칩 · 4열 편집 박스 · 규칙은 접힘', () => {
    const g = son();
    g.player.unspentPoints = 6;
    const vm = allocateVM(g, 83, false, g.player.attributes, []);
    const html = allocateView(vm, 'dribbling', 0);
    expect(html).toContain('po-hero--compact');
    expect(html).toContain('al-ovr');
    expect(html).toContain('1칸 <b>1P</b>');
    expect(html).toContain('ag--4');
    expect(html).toMatch(/al-rule-text" hidden/);
    expect(allocateView(vm, null, 0, true)).not.toMatch(/al-rule-text" hidden/);
    expect(html).toContain('data-act="alloc-done"');
  });
});

describe('새 게임 (디자인 124~131)', () => {
  const form = (mode: 'prospect' | 'real' | 'custom', legends = 'off') => ({ mode, name: '', position: 'ST', seed: 'c58', difficulty: 'normal', realId: '', legends, roll: 'c58', others: false });

  it('랜덤: 후보 4자리 2×2 · 신체·태그 · 능력치 접힘 줄(펼치면 바둑판) · 시작 옵션', () => {
    const vm = newGameVM(form('prospect'));
    const html = newGameView(vm);
    expect((html.match(/class="ng-cand( is-on)?"/g) ?? []).length).toBe(4);
    expect(html).toContain('신체 · 태그');
    expect(html).toContain('펼치기');
    expect(html).not.toContain('ag-grid');
    expect(newGameView(vm, undefined, { ...NEW_GAME_UI, attrsOpen: true })).toContain('ag-grid');
    expect(html).toContain('시작 옵션');
    expect(html).toContain('id="f-name"');
    expect(html).toContain('id="f-seed"');
  });

  it('실제 선수: 레전드 팩을 켜면 [실제 선수 n | 레전드 n] 묶음 탭, 10명 + 더 보기, 포지션군 거르기', () => {
    const vm = newGameVM(form('real', 'on'));
    expect(vm.legendList.length).toBeGreaterThan(20);
    const leg = newGameView(vm, undefined, { ...NEW_GAME_UI, realTab: 'legend' });
    expect(leg).toContain(`레전드 ${vm.legendList.length}`);
    expect((leg.match(/class="real-row ng-row/g) ?? []).length).toBe(10);
    expect(leg).toMatch(/20명 더 보기 · \d+명 남음/);
    expect(leg).toContain('지금 → 전성기');
    const df = newGameView(vm, undefined, { ...NEW_GAME_UI, realTab: 'legend', rgroup: 'df', rshow: 200 });
    expect(df).not.toMatch(/ · (ST|CF|CAM|CM) · 유스/);
    const real = newGameView(newGameVM(form('real')));
    expect(real).not.toContain('레전드 0');
    expect(real).toContain('실제 선수');
  });

  it('커스텀 6단계: 점 6개 · PointBar · 1단계만 모드 탭 · 아래 [이전][다음 · 단계명] · 마지막은 [시작]', () => {
    expect([...CUSTOM_STEPS]).toEqual(['기본', '몸', '외모', '태그', '능력치', '시작']);
    let f = initialCustomForm();
    const vm = () => customVM(f, '이도윤');
    const s1 = customBody(vm(), 1, '<i id="mode"></i>', '<i id="opts"></i>');
    expect((s1.match(/class="cu-dot /g) ?? []).length).toBe(6);
    expect(s1).toContain('po-pointbar');
    expect(s1).toContain('id="mode"');
    expect(s1).toContain('다음 · 몸');
    expect(s1).not.toContain('이전');
    f = customAct(f, 'age', '1');
    const s2 = customBody(vm(), 2, '', '');
    expect(s2).toContain('이전');
    expect(s2).toContain('다음 · 외모');
    expect(s2).toContain('po-stepper');
    expect(s2).toMatch(/cu-dot is-done/);
    const s6 = customBody(vm(), 6, '', '<i id="opts"></i>');
    expect(s6).toContain('id="opts"');
    expect(s6).toContain('data-act="start"');
    expect(customBody(vm(), 5, '', '')).toContain('data-act="cu-sel"');
  });

  it('버전', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]*단계$/);
  });
});
