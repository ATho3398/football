// U17-b (C.83b): 17차 S06 홈 3탭 · PC 3열 · 내 상태 3칸 · 접은 다음 경기 · 부상 복귀 단추 · 가이드 분모 · PC 포지션 12자리
import { afterEach, describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, playOthers, type GameState } from '../src/game';
import { injuryChance } from '../src/injury';
import { injuryReturnVM, homeVM } from '../src/ui/viewModels';
import { HOME_TABS, homeView, injuryReturnSheet, positionSheet } from '../src/ui/views/home';
import { checklistPanel } from '../src/ui/views/guide';
import { setWideForTest } from '../src/ui/skin';
import { positionOptionsVM } from '../src/ui/viewModels';
import { BALANCE } from '../src/config/balance';

afterEach(() => setWideForTest(null));
const fresh = () => newGame({ mode: 'prospect', position: 'CAM', seed: 'u17b-test', difficulty: 'normal' });
const toMatchDay = (g: GameState) => { while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); } };
const parts = { guide: '<i id="guide"></i>', alerts: '<i id="alerts"></i>', training: '<i id="train"></i>', comps: '<i id="comps"></i>', goals: '<i id="goals"></i>', links: '<i id="links"></i>', compete: '<i id="compete"></i>' };

describe('U17-b 홈 3탭 (S06, D4)', () => {
  it('폰: 탭 [오늘][시즌][경쟁] — 탭마다 맡은 조각만', () => {
    expect(HOME_TABS.map((t) => t.label)).toEqual(['오늘', '시즌', '경쟁']);
    const vm = homeVM(fresh());
    const today = homeView(vm, parts);
    for (const id of ['guide', 'alerts', 'train']) expect(today).toContain(`id="${id}"`);
    for (const id of ['comps', 'goals', 'links', 'compete']) expect(today).not.toContain(`id="${id}"`);
    expect(today).toContain('내 상태');
    const season = homeView(vm, parts, { tab: 'season' });
    for (const id of ['comps', 'goals', 'links']) expect(season).toContain(`id="${id}"`);
    expect(season).toContain('시즌 기록');
    expect(season).not.toContain('next-card');
    const comp = homeView(vm, parts, { tab: 'comp' });
    expect(comp).toContain('id="compete"');
    expect(homeView(vm, {}, { tab: 'comp' })).toContain('po-empty');
  });
  it('PC 3열: 알림은 오른쪽 열(2절 사소), 탭 없음', () => {
    setWideForTest(true);
    const html = homeView(homeVM(fresh()), parts);
    const right = html.slice(html.indexOf('<h2 class="hm3__h">경쟁'));
    expect(right).toContain('id="alerts"');
    expect(right).toContain('id="compete"');
    expect(html.slice(0, html.indexOf('<h2 class="hm3__h">경쟁'))).not.toContain('id="alerts"');
  });
  it('다음 경기: 진행 주 버튼은 독 [다음] 하나 — 카드엔 [하루 진행] · [자동 진행], 경기 날은 안내 한 줄', () => {
    const g = fresh();
    const h = homeView(homeVM(g));
    expect(h).toContain('data-act="day-one"');
    expect(h).toContain('data-act="sim-rest"');
    expect(h).not.toContain('data-act="day-continue"');
    toMatchDay(g);
    const m = homeView(homeVM(g));
    expect(m).toContain('경기는 아래 [경기]로 준비해요');
    expect(m).not.toContain('data-act="day-one"');
  });
  it('배너가 붙으면 폰 [오늘] 다음 경기는 접은 한 줄(2절 29번), 펴면 카드 · PC 는 늘 카드', () => {
    const vm = homeVM(fresh());
    const crowded = { ...vm, banners: [{ tone: 'warning' as const, title: '출장 정지 1경기' }] };
    expect(homeView(crowded)).toContain('next-card--folded');
    expect(homeView(crowded)).toContain('data-act="home-next"');
    expect(homeView(crowded, {}, { nextOpen: true })).not.toContain('next-card--folded');
    expect(homeView(vm)).not.toContain('next-card--folded');
    setWideForTest(true);
    expect(homeView(crowded)).not.toContain('next-card--folded');
  });
  it('내 상태 부상 위험 = 엔진 부상 판정 식(injuryChance 90분), 보통 = 피로·부하 0', () => {
    const g = fresh();
    g.player.fatigue = 80;
    const r = homeVM(g).condition.risk!;
    const now = injuryChance(g.player, 90, g.difficulty);
    expect(r.pct).toBe(Math.round(now * 1000) / 10);
    expect(r.mul).toBe(Math.round((now / injuryChance({ ...g.player, fatigue: 0, load: 0 }, 90, g.difficulty)) * 10) / 10);
    expect(r.mul).toBeGreaterThan(1);
    expect(homeView(homeVM(g))).toContain('부상 위험 근거 · 체력 20');
  });
  it('머리말 칩 "다음 nR"(2절 사소)', () => {
    expect(homeView(homeVM(fresh()))).toMatch(/>다음 1R</);
  });
  it('부상 배너 [복귀 시점 고르기] → 시트(2절 29번): 막바지 전이면 단추 잠금 + 언제 고르는지, 막바지면 고르기', () => {
    const g = fresh();
    g.player.injury = { grade: 'moderate', weeksTotal: 3, daysTotal: 21, daysLeft: 14, season: g.league.season, round: 0, permanent: {} };
    const b = homeVM(g).banners.find((x) => x.tone === 'injury')!;
    expect(b.action).toBe('복귀 시점 고르기');
    expect(b.act).toBe('inj-return-open');
    const early = injuryReturnVM(g)!;
    expect(early.wait).toBeGreaterThan(0);
    expect(injuryReturnSheet(early)).toContain('disabled');
    g.player.injury.ret = 'ask';
    const ask = injuryReturnVM(g)!;
    expect(ask.wait).toBeUndefined();
    expect(injuryReturnSheet(ask)).not.toContain('disabled');
    expect(homeVM(g).banners.find((x) => x.tone === 'injury')!.action).toBe('복귀 시점 고르기');
    // 시즌아웃은 선택 없음 (C.74b 규칙 그대로)
    g.player.injury = { grade: 'seasonEnding', weeksTotal: 30, daysTotal: 210, daysLeft: 200, season: g.league.season, round: 0, permanent: {} };
    expect(homeVM(g).banners.find((x) => x.tone === 'injury')!.action).toBeUndefined();
    expect(injuryReturnVM(g)).toBeNull();
    expect(BALANCE.injuryReturn.minDays).toBe(14);
  });
  it('첫 시즌 가이드 분모 고정(2절 사소), PC 포지션 시트 12자리 격자(2절 14번)', () => {
    expect(checklistPanel([{ id: 'a', label: 'A', done: true }], 3)).toContain('1/3');
    const g = fresh();
    const html = positionSheet(positionOptionsVM(g), g.player.position);
    expect(html).toContain('pos-grid');
    expect((html.match(/data-act="pos-pick"/g) ?? []).length).toBe(positionOptionsVM(g).length);
  });
});
