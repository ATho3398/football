// C.76l (U8-c 새 화면, 디자인 통합 2부 229·233·234·238·239·240B · 적용 명세 docs/ui-requests/7-13-part2-apply.md)
import { afterEach, describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { newGameVM, type NewGameForm, worldVM } from '../src/ui/viewModels';
import { NEW_GAME_UI, newGameView, worldView } from '../src/ui/views/screens';
import { photoDexVM } from '../src/ui/photoVM';
import { photoDexView } from '../src/ui/views/photos';
import { Banner } from '../src/ui/components';
import { banners } from '../src/ui/views/common';
import { setWideForTest } from '../src/ui/skin';
import { PATCH_LABEL } from '../src/version';
import { DEFAULT_LEAGUES, leagueCatalog } from '../data/leagues';

const form = (x: Partial<NewGameForm> = {}): NewGameForm => ({ mode: 'prospect', name: '', position: 'ST', seed: '', difficulty: 'normal', realId: '', roll: 'c76l', others: false, leagues: [...DEFAULT_LEAGUES], ...x });
const open = { ...NEW_GAME_UI, leaguesOpen: true };

afterEach(() => setWideForTest(null));

describe('C.76l 239 리그 고르기 (새 흐름: 시작 팀 리그 = 맨 앞 · 해제 불가)', () => {
  it('PATCH_LABEL · 접힘 줄 = 리그 n개 진행 + [고르기], 펼치면 묶음 3칸 · 14개 리그 · 대륙·부 묶음', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    const vm = newGameVM(form());
    const shut = newGameView(vm, undefined, NEW_GAME_UI);
    expect(shut).toContain(`리그 ${DEFAULT_LEAGUES.length}개 진행`);
    expect(shut).toContain('data-act="ng-lg-open"');
    expect(shut).not.toContain('data-act="ng-league"');
    setWideForTest(true); // PC = 묶음을 접지 않음 → 14줄 모두
    const html = newGameView(vm, undefined, open);
    const n = leagueCatalog().length;
    expect(n).toBe(14);
    expect(html.match(/data-act="ng-league"/g)?.length).toBe(n);
    for (const v of ['default', 'mine', 'all']) expect(html).toContain(`data-act="ng-leagues" data-v="${v}"`);
    expect(html.match(/data-act="ng-leagues"/g)?.length).toBe(3);
    for (const g of ['유럽 · 1부', '유럽 · 2부', '아시아', '아메리카']) expect(html).toContain(g);
    expect(html).toContain('ng-lg__cols');
    // 기본 묶음이 고른 칸 (세그먼트)
    expect(html).toMatch(/data-act="ng-leagues" data-v="default"[^>]*aria-pressed="true"|class="[^"]*is-on[^"]*"[^>]*data-act="ng-leagues" data-v="default"/);
  });
  it('고른 팀 리그 = 맨 앞 · "고른 팀 리그 · 필수" · 해제 불가, [내 리그로] 없음', () => {
    const vm = newGameVM(form({ startTeam: undefined }));
    setWideForTest(true);
    const html = newGameView(vm, undefined, open);
    const first = html.indexOf('data-act="ng-league"');
    expect(html.slice(first, first + 300)).toContain('data-v="pl"');
    expect(html).toContain('고른 팀 리그 · 필수');
    expect(html).toMatch(/data-v="pl" role="checkbox" aria-checked="true" aria-disabled="true"/);
    expect(html).not.toContain('ng-league-mine');
    expect(html).not.toContain('내 리그로');
  });
  it('라리가 팀을 고르면 라리가가 고른 팀 리그(맨 앞), 폰은 고른 리그가 있는 묶음만 펼침', () => {
    const vm = newGameVM(form({ startTeam: 'laliga:val', leagues: ['laliga', 'pl'] }));
    expect(vm.leagues.find((l) => l.mine)?.id).toBe('laliga');
    const html = newGameView(vm, undefined, open);
    const first = html.indexOf('data-act="ng-league"');
    expect(html.slice(first, first + 300)).toContain('data-v="laliga"');
    expect(html).toContain('data-act="ng-lg-group" data-v="asia" aria-expanded="false"');
    const asia = newGameView(vm, undefined, { ...open, lgFold: { asia: true } });
    expect(asia).toContain('data-act="ng-lg-group" data-v="asia" aria-expanded="true"');
    expect(asia).toContain('data-v="kleague1"');
  });
  it('시작 팀 = 판 하나(리그 탭 + 팀 줄), PC 2열 (229 · 239 PC)', () => {
    const vm = newGameVM(form());
    const phone = newGameView(vm, undefined, NEW_GAME_UI);
    expect(phone).toContain('tp-panel');
    expect(phone).toContain('data-act="ng-pick-league"');
    expect(phone).not.toContain('ng-pc');
    setWideForTest(true);
    const pc = newGameView(vm, undefined, NEW_GAME_UI);
    expect(pc).toContain('class="ng-pc"');
    const r = pc.indexOf('ng-pc__r');
    expect(pc.indexOf('tp-panel')).toBeLessThan(r);
    expect(pc.indexOf('data-act="start"')).toBeGreaterThan(r);
  });
});

describe('C.76l 233 · 234 실제 선수 묶음', () => {
  it('레전드 팩 묶음 3칸(전체 · 기본 레전드 · 도르트문트) → 고른 묶음만 · 배지', () => {
    const vm = newGameVM(form({ mode: 'real', legends: 'on' }));
    const u = { ...NEW_GAME_UI, realTab: 'legend' as const, rshow: 500 };
    const all = newGameView(vm, undefined, u);
    for (const k of ['all', 'base', 'bvb']) expect(all).toContain(`data-k="lpack" data-v="${k}"`);
    const bvbN = vm.legendList.filter((r) => r.bvb).length;
    expect(bvbN).toBeGreaterThan(0);
    const bvb = newGameView(vm, undefined, { ...u, lpack: 'bvb' });
    expect(bvb.match(/class="real-row ng-row/g)?.length).toBe(bvbN);
    expect(bvb).toContain(`도르트문트 레전드 ${bvbN}명`);
    expect(bvb).toContain('ng-badge is-bvb');
    const base = newGameView(vm, undefined, { ...u, lpack: 'base' });
    expect(base.match(/class="real-row ng-row/g)?.length).toBe(vm.legendList.length - bvbN);
  });
  it('미래 스타: 고를 수 없음 · 등장 → 전성기, 내 리그 밖 = "다른 리그" 배지. 고르기 전 머리말에 숫자 없음', () => {
    const vm = newGameVM(form({ mode: 'real', futureStars: 'on' }));
    const html = newGameView(vm, undefined, { ...NEW_GAME_UI, realTab: 'future' });
    expect(html).toContain('고를 수 없어요');
    expect(html).toContain('등장 → 전성기');
    if (vm.futureList.some((p) => p.waiting)) expect(html).toContain('ng-badge is-wait');
    expect(html).not.toContain('po-hero__value');
  });
  it('월드 리그 스타 레전드 줄 = 팩 배지 · 전성기', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c76l-w', difficulty: 'normal', legends: true });
    const html = worldView(worldVM(g), 'stars');
    if (worldVM(g).legends.length) {
      expect(html).toContain('ng-badge');
      expect(html).toMatch(/전성기 \d+/);
    }
  });
});

describe('C.76l 238 도감 · 240B 배너', () => {
  const g = newGame({ mode: 'real', playerId: 'son', seed: 'c76l-dex', difficulty: 'normal' });
  g.photos = { cards: ['kante', 'hazard', 'son'].map((id, i) => ({ id, d: `2018-08-1${i}` as `${number}-${number}-${number}`, s: 2018, vs: 'chelsea', jersey: false, first: { t: 'chelsea', o: 80 } })) };
  it('폰 = 접는 선택(고른 값 늘 보임) + 오름/내림, 펼치면 8가지 · 고른 줄 체크 / PC = 세그먼트 8칸', () => {
    const vm = photoDexVM(g, 'ovr', true);
    const shut = photoDexView(vm);
    expect(shut).toContain('data-act="pc-sort-open"');
    expect(shut).toContain('<b>능력치</b>');
    expect(shut).toContain('내림차순');
    expect(shut).not.toContain('pc-select__menu');
    const menu = photoDexView(vm, true);
    expect(menu.match(/class="pc-select__opt/g)?.length).toBe(8);
    expect(menu).toMatch(/pc-select__opt is-on" role="option" aria-selected="true" data-act="pc-sort" data-v="ovr"/);
    setWideForTest(true);
    const pc = photoDexView(vm);
    expect(pc).not.toContain('pc-sort-open');
    expect(pc.match(/data-act="pc-sort"/g)?.length).toBe(8);
  });
  it('뒷면: 처음 만났을 때 · 다시 누르면 앞면', () => {
    const html = photoDexView(photoDexVM(g, 'no', false, 'son'));
    expect(html).toContain('처음 만났을 때');
    expect(html).toContain('다시 누르면 앞면');
  });
  it('새 포토카드 배너: album 아이콘 · 라임 면(fill) · [도감 보기]', () => {
    const html = banners([{ tone: 'info', icon: 'album', title: '새 포토카드 3장', action: '도감 보기', act: 'go', to: 'dex' }]);
    expect(html).toContain('po-banner--fill');
    expect(html).toContain('data-to="dex"');
    expect(Banner({ title: 'x' })).not.toContain('po-banner--fill');
  });
});
