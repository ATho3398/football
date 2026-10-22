// C.76n (47a) 개인 시상: 이력서 · 투표단 투표 · 7개 상 · 발표 날짜 · 보상 · 역대 수상자 · 세이브 51
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { endDay, newGame, playRound, SAVE_FORMAT_VERSION, startNextSeason, autoMarket, type GameState } from '../src/game';
import { matchClutch } from '../src/clutch';
import { awardIds, awardsDayEnd, buildResumes, computeAwards, eligible, myAwardCounts, npcGlobalHonors, type AwardYear } from '../src/awards';
import { awardsVM } from '../src/ui/awardsVM';
import { awardsView } from '../src/ui/views/awards';
import { MY_ID } from '../src/engine/adapter';
import { daysBetween } from '../src/calendar';
import { deserialize, restore, SaveFormatError, serialize } from '../src/save';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import type { GoalRec } from '../src/engine/npcMatch';

let cached: GameState | null = null;
/** 한 시즌을 빠른 진행으로 끝낸 게임 (비시즌) */
function seasonDone(): GameState {
  if (cached) return structuredClone(cached);
  const g = newGame({ mode: 'real', playerId: 'son', seed: 'c76n', difficulty: 'normal' });
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
  cached = g;
  return structuredClone(g);
}

describe('결정적 순간 (이력서)', () => {
  const pts = (goals: GoalRec[], hg: number, ag: number) => {
    const m = new Map<string, number>();
    matchClutch(goals, hg, ag, [1, 1], (id, p) => m.set(id, (m.get(id) ?? 0) + p));
    return m;
  };
  it('결승골 · 늦은 역전골 · 결승골 도움', () => {
    const C = BALANCE.awards.resume.clutch;
    const m = pts([[10, 1, 'b', null], [50, 0, 'a', null], [85, 0, 'c', 'd']], 2, 1);
    expect(m.get('c')).toBeCloseTo(C.winner + C.lateGoAhead);
    expect(m.get('d')).toBeCloseTo(C.winnerAssist);
    expect(m.get('a')).toBeUndefined();
  });
  it('늦은 동점골 · 해트트릭', () => {
    const C = BALANCE.awards.resume.clutch;
    expect(pts([[10, 1, 'b', null], [88, 0, 'a', null]], 1, 1).get('a')).toBeCloseTo(C.lateEqualizer);
    const h = pts([[10, 0, 'x', null], [20, 0, 'x', null], [30, 0, 'x', null]], 3, 0);
    expect(h.get('x')).toBeCloseTo(C.winner + C.hatTrick);
  });
});

describe('상 정의 = 데이터 표', () => {
  it('47a 7개 상 · 투표 비율 합 1 · 공식 상은 투표 없음', () => {
    expect(awardIds().slice(0, 12)).toEqual(['ballonDor', 'theBest', 'kopa', 'yashin', 'defender', 'goldenBoy', 'goldenBoot', 'muller', 'wcBall', 'wcBoot', 'wcGlove', 'wcYoung']);
    for (const [id, d] of Object.entries(BALANCE.awards.defs)) {
      if (d.formula) { expect(d.vote, id).toBeUndefined(); continue; }
      expect(Object.values(d.vote!).reduce((t, x) => t + (x ?? 0), 0), id).toBeCloseTo(1);
      if (!d.xi) expect(d.points!.length).toBeGreaterThan(0);
    }
  });
});

describe('시즌 끝 시상', () => {
  it('이력서: 리그 선수 + 나, 자격(야신 GK · 코파 21세 이하 · 골든보이 유럽)', () => {
    const g = seasonDone();
    const rs = buildResumes(g);
    expect(rs.length).toBeGreaterThan(200);
    expect(rs.some((r) => r.me && r.id === MY_ID)).toBe(true);
    const D = BALANCE.awards.defs;
    for (const r of rs.filter((x) => eligible(D.yashin!, x))) expect(r.group).toBe('GK');
    for (const r of rs.filter((x) => eligible(D.kopa!, x))) expect(r.age!).toBeLessThanOrEqual(21);
    for (const r of rs.filter((x) => eligible(D.defender!, x))) expect(['CB', 'FB', 'CDM']).toContain(r.group);
  });
  it('결과 저장 · 골든부츠는 바로 발표, 나머지는 다음 해 발표 날짜 · 같은 시드 같은 결과', () => {
    const g = seasonDone();
    const y = g.globalAwards!.years.at(-1)!;
    expect(y.season).toBe(2018);
    // 시즌 끝 바로 발표하는 상: 골든부츠 (+ 47b 리그 상 · 챔스 · 대륙컵, C.76t) — 날짜가 있는 상은 아직
    expect(y.shown).toContain('goldenBoot');
    for (const k of y.shown) expect(y.due[k]).toBeUndefined();
    // 2018-19 시즌 여름은 월드컵이 없다 (2022부터 4년) → 월드컵 상 없음
    expect(y.res.wcBall).toBeUndefined();
    expect(y.due.ballonDor).toBe('2019-10-28');
    expect(y.due['ballonDor:nominees']).toBe('2019-08-08');
    expect(y.due.theBest).toBe('2019-12-16');
    expect(y.res.ballonDor!.length).toBe(30);
    // 득표 합 = 투표자 × 점수 합 (반올림 차이 안)
    const total = y.res.ballonDor!.reduce((t, r) => t + r.v, 0);
    expect(Math.abs(total - 100 * 16)).toBeLessThanOrEqual(30);
    expect(y.res.ballonDor!.reduce((t, r) => t + (r.f ?? 0), 0)).toBe(100);
    // 골든부츠 = 골 × 계수 (PL 2)
    expect(y.res.goldenBoot![0]!.v).toBe(y.res.goldenBoot![0]!.g! * 2);
    // 결정적: 같은 시드 새 게임 = 같은 결과
    const h = newGame({ mode: 'real', playerId: 'son', seed: 'c76n', difficulty: 'normal' });
    while (h.phase === 'season') playRound(h, { engine: 'quick' });
    expect(h.globalAwards!.years.at(-1)!.res).toEqual(y.res);
    void computeAwards;
  });
  it('다음 시즌 하루 끝에서 후보 → 발롱도르 → 골든보이 → 더 베스트 순 발표 · 기사', () => {
    const g = seasonDone();
    autoMarket(g, 'stay');
    startNextSeason(g);
    const y = g.globalAwards!.years.at(-1)!;
    while (g.phase === 'season' && daysBetween(g.calendar.date, '2019-12-20') > 0) playRound(g, { engine: 'quick' });
    expect(y.shown).toEqual(expect.arrayContaining(['ballonDor:nominees', 'ballonDor', 'kopa', 'yashin', 'defender', 'muller', 'goldenBoy', 'theBest']));
    expect(g.inbox!.items.some((m) => m.key === 'aw:2018:ballonDor')).toBe(true);
    expect(g.inbox!.items.some((m) => m.key === 'aw:2018:ballonDor:nom')).toBe(true);
    // NPC 위상: 발롱도르 수상자는 2개로 센다
    const w = y.res.ballonDor![0]!;
    if (!w.me) expect(npcGlobalHonors(g, w.id, 2014)).toBeGreaterThanOrEqual(BALANCE.awards.standingBallonDor);
  });
});

describe('내가 받으면', () => {
  it('발롱도르: 기록(honors) · 전설 선택권 · 레전드 배지 · 위상 · XP · 트로피 · 통산', () => {
    const g = seasonDone();
    autoMarket(g, 'stay');
    startNextSeason(g);
    const y = g.globalAwards!.years.at(-1)!;
    // 내가 1위가 되게 결과를 바꾼다
    y.res.ballonDor = [{ id: MY_ID, n: g.player.name, t: g.player.teamId, p: 'WING', v: 500, f: 70, me: 1 }, ...y.res.ballonDor!.filter((r) => !r.me)];
    const rep = g.player.reputation;
    const xp = g.player.totalXp;
    const picks = g.cards.picks.length;
    awardsDayEnd(g, '2019-10-28');
    expect(g.player.honors.ballonDor).toBe(1);
    expect(g.player.badges.some((b) => b.id === 'ballonDor')).toBe(true);
    expect(g.player.reputation).toBeGreaterThan(rep);
    expect(g.player.totalXp).toBeGreaterThan(xp);
    expect(g.cards.picks.length).toBeGreaterThan(picks);
    expect(g.cards.picks.at(-1)!.label).toContain('발롱도르');
    expect(g.chapters!.list.flatMap((c) => c.trophies)).toContain('2019 발롱도르');
    expect(myAwardCounts(g).ballonDor).toBe(1);
    expect(g.inbox!.items.find((m) => m.key === 'aw:2018:ballonDor')!.title).toContain('수상');
    // 다시 불러도 두 번 주지 않는다
    awardsDayEnd(g, '2019-10-29');
    expect(g.player.honors.ballonDor).toBe(1);
  });
});

describe('화면 · 세이브', () => {
  it('시상 화면: 발표된 상은 득표 표, 안 된 상은 발표 예정 · 역대 수상자', () => {
    const g = seasonDone();
    const vm = awardsVM(g, null, null);
    expect(vm.cards.find((c) => c.id === 'goldenBoot')!.status).toBe('shown');
    expect(vm.cards.find((c) => c.id === 'ballonDor')!.status).toBe('pending');
    const html = awardsView(vm, 'year');
    expect(html).toContain('골든부츠');
    expect(html).toContain('발표');
    const hist = awardsView(awardsVM(g, null, 'goldenBoot'), 'history');
    expect(hist).toContain('2019');
  });
  it('세이브 왕복 · 52 는 이어 할 수 없음', () => {
    const g = seasonDone();
    expect(SAVE_FORMAT_VERSION).toBe(57);
    const back = deserialize(serialize(g));
    expect(back.globalAwards!.years.at(-1)!.res.ballonDor!.length).toBe(30);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 52;
    expect(() => restore(raw)).toThrow(SaveFormatError);
  });
  it('버전 라벨', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/); // 병렬 패치 병합에도 통과 (C.76q)
    expect(STAGE_LABEL).toBe('47단계');
  });
  it('하루 끝 훅은 발표 날짜 전에는 아무것도 하지 않는다', () => {
    const g = seasonDone();
    const y: AwardYear = g.globalAwards!.years.at(-1)!;
    const before = [...y.shown];
    awardsDayEnd(g, '2019-08-07');
    expect(y.shown).toEqual(before);
    void endDay;
  });
});

describe('월드컵 상 · 레전더리 조건 4a', () => {
  it('월드컵 해: 출전국 명단에 골을 나눈 이력서 → 골든볼 · 골든부트 · 골든글러브 · 영플레이어', async () => {
    const { wcResumes } = await import('../src/awards');
    const { runTournament } = await import('../src/national');
    const g = seasonDone();
    const rec = runTournament(g, 'wc', 2022, '2022-06-01', false, () => undefined as never).rec;
    const rs = wcResumes(g, rec);
    const nations = new Set(rec.groups.flatMap((x) => x.table.map((r) => r.team)));
    expect(new Set(rs.map((r) => r.nation)).size).toBe(nations.size);
    // 나라 골 합 = 그 나라 선수 골 합
    const champ = rec.champion;
    const gf = rec.groups.flatMap((x) => x.table).find((r) => r.team === champ)!.gf + rec.ko.flatMap((st) => st.ties).reduce((t, x) => t + (x.a === champ ? x.ga : x.b === champ ? x.gb : 0), 0);
    expect(rs.filter((r) => r.nation === champ).reduce((t, r) => t + r.goals, 0)).toBe(gf);
    const year = computeAwards(g, rec);
    expect(year.res.wcBall!.length).toBeGreaterThan(0);
    expect(year.res.wcBoot![0]!.g).toBeGreaterThan(0);
    expect(year.res.wcGlove![0]!.p).toBe('GK');
    expect(year.due.wcBall).toBeUndefined();
  });
  it('[발롱도르 1 또는 최고 개인상 3] 그리고 (트레블 · 월드컵 · 발롱 3 · 최고 개인상 6), 시즌당 최대 2', async () => {
    const { legendaryHonorsMet, topAwardCount, legendaryConditions } = await import('../src/growth');
    const H = (o: object) => ({ ballonDor: 0, trebles: 0, worldCups: 0, ...o });
    expect(legendaryHonorsMet(H({ ballonDor: 1, trebles: 1 }))).toBe(true);
    expect(legendaryHonorsMet(H({ top: { 2019: 1, 2020: 1, 2021: 1 }, worldCups: 1 }))).toBe(true);
    expect(legendaryHonorsMet(H({ top: { 2019: 3 }, worldCups: 1 }))).toBe(false);
    expect(topAwardCount(H({ top: { 2019: 3, 2020: 2, 2021: 2 } }))).toBe(6);
    expect(legendaryHonorsMet(H({ top: { 2019: 2, 2020: 2, 2021: 2 } }))).toBe(true);
    expect(legendaryHonorsMet(H({ ballonDor: 1 }))).toBe(false);
    expect(legendaryConditions(950, H({ top: { 2019: 1 } }) as never)[1]!.label).toContain('지금 1회');
  });
  it('최고 개인상(더 베스트)을 받으면 honors.top 그 시즌 +1', () => {
    const g = seasonDone();
    autoMarket(g, 'stay');
    startNextSeason(g);
    const y = g.globalAwards!.years.at(-1)!;
    y.res.theBest = [{ id: MY_ID, n: g.player.name, t: g.player.teamId, p: 'WING', v: 300, f: 50, me: 1 }, ...y.res.theBest!.filter((r) => !r.me)];
    awardsDayEnd(g, '2019-12-16');
    expect(g.player.honors.top?.[2018]).toBe(1);
  });
});
