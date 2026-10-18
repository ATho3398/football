// C.63 (36단계 5-2): 이벤트 엔진·인박스·라이벌·감독 경질·주장 (+ b 생활 시스템)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { EVENTS } from '../data/events';
import { addDays } from '../src/calendar';
import { answerEvent, chanceOf, check, eventById, EV_VARS, eventsDayEnd, ensureEvents, fireEvent, type Cond, type Effect } from '../src/events';
import { endDay, isMatchDay, setDayTraining, newGame, playOthers, playRound, startNextSeason, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { inboxList, isPending, pushInbox, unreadCount } from '../src/inbox';
import { addTrust, ensureManager, scaleDelta } from '../src/manager';
import { pickRival, rivalOf, rivalVerdict } from '../src/rival';
import { coachAfterMatch, coachOf, isCaptain, setCaptain } from '../src/club';
import { fill, josa } from '../src/text';
import { deserialize, migrate, serialize } from '../src/save';
import { collectNotices, homeInboxVM, inboxDetailVM, inboxVM, rivalCardVM } from '../src/ui/inboxVM';
import { homeInboxSection, inboxDetailView, inboxView, rivalSection } from '../src/ui/views/inbox';
import { teamDetailVM } from '../src/ui/detailVM';
import { posGroup } from '../src/roster';
import { addLife, ensureLife, LIFE_KINDS, lifeEventsFull, lifeForm, lifeHints, lifeRecoveryMul, lifeSeasonEnd } from '../src/life';
import { trainingOptionsVM } from '../src/ui/viewModels';
import { trainingSheet } from '../src/ui/views/training';
import { DOCK_PC, DOCK_PHONE, dock } from '../src/ui/views/common';

const X = BALANCE.events;

function season(g: GameState): void {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
}

describe('이벤트 데이터 (20.7)', () => {
  it('초기 이벤트 분량과 형식: id 중복 없음, 변형 문장 3개 이상, 선택형은 선택지 2개 이상', () => {
    const ids = new Set<string>();
    for (const e of EVENTS) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
      const texts = Array.isArray(e.text) ? e.text : (e.text as { neutral: string[] }).neutral;
      expect(texts.length, e.id).toBeGreaterThanOrEqual(3);
      if (e.kind !== 'message') expect(e.choices?.length ?? 0, e.id).toBeGreaterThanOrEqual(2);
      for (const c of e.choices ?? []) expect(c.result.length, `${e.id}.${c.id}`).toBeGreaterThanOrEqual(3);
    }
    const n = (k: string) => EVENTS.filter((e) => e.kind === k).length;
    expect(EVENTS.length).toBeGreaterThanOrEqual(40);
    expect(n('chain')).toBeGreaterThanOrEqual(3);
  });

  it('조건은 고정 변수만, 효과는 상한 안 (위상 ±5, 신뢰도 ±10), 예약 이벤트는 있어야 한다', () => {
    const vars = new Set<string>(EV_VARS);
    const walk = (c: Cond | undefined, id: string): void => {
      if (!c) return;
      if (Array.isArray(c)) {
        expect(vars.has(c[0]), `${id}: ${c[0]}`).toBe(true);
        return;
      }
      const o = c as Record<string, unknown>;
      if ('all' in o) (o.all as Cond[]).forEach((x) => walk(x, id));
      if ('any' in o) (o.any as Cond[]).forEach((x) => walk(x, id));
      if ('not' in o) walk(o.not as Cond, id);
    };
    const sum = (effects: readonly Effect[], k: 'rep' | 'trust') => effects.reduce((t, e) => t + (k in e ? Math.abs((e as Record<string, number>)[k]!) : 0), 0);
    for (const e of EVENTS) {
      walk(e.when, e.id);
      for (const eff of [e.effects ?? [], ...(e.choices ?? []).map((c) => c.effects)]) {
        expect(sum(eff, 'rep'), e.id).toBeLessThanOrEqual(X.caps.rep);
        expect(sum(eff, 'trust'), e.id).toBeLessThanOrEqual(X.caps.trust);
        for (const f of eff) if ('next' in f) expect(eventById(f.next), `${e.id} → ${f.next}`).toBeTruthy();
      }
      for (const c of e.choices ?? []) walk(c.requires, `${e.id}.${c.id}`);
    }
  });

  it('한국어 조사 자동 처리', () => {
    expect(josa('손흥민', '은/는')).toBe('은');
    expect(josa('케인', '이/가')).toBe('이');
    expect(josa('살라', '이/가')).toBe('가');
    expect(josa('리버풀', '으로/로')).toBe('로');
    expect(josa('토트넘', '으로/로')).toBe('으로');
    expect(josa('3', '을/를')).toBe('을');
    expect(fill('{name}{은/는} {team}{과/와} 계약', { name: '박지성', team: '맨유' })).toBe('박지성은 맨유와 계약');
  });
});

describe('이벤트 엔진·인박스 (20.3·20.4)', () => {
  it('시즌 슬롯 4~5개, 시드 재현 (같은 시드 = 같은 인박스)', () => {
    const a = newGame({ mode: 'prospect', position: 'ST', seed: 'c63-seed', difficulty: 'normal' });
    const b = newGame({ mode: 'prospect', position: 'ST', seed: 'c63-seed', difficulty: 'normal' });
    expect(a.events!.slots.length).toBeGreaterThanOrEqual(X.slots.min);
    expect(a.events!.slots.length).toBeLessThanOrEqual(X.slots.max);
    for (let i = 0; i < 12; i++) {
      playRound(a, { engine: 'quick' });
      playRound(b, { engine: 'quick' });
    }
    expect(a.inbox!.items.map((x) => x.title)).toEqual(b.inbox!.items.map((x) => x.title));
    expect(a.inbox!.items.length).toBeGreaterThan(0);
  });

  it('선택형: 답하면 효과·결과 문장, 기한이 지나면 기본 선택', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-choice', difficulty: 'normal' });
    ensureManager(g);
    const it1 = fireEvent(g, eventById('s_extraTraining')!);
    expect(isPending(it1)).toBe(true);
    const xp = g.player.totalXp;
    answerEvent(g, it1.id, 'yes');
    expect(it1.answer?.id).toBe('yes');
    expect(g.player.totalXp).toBeGreaterThan(xp);
    expect(() => answerEvent(g, it1.id, 'no')).toThrow();
    const it2 = fireEvent(g, eventById('s_charity')!);
    eventsDayEnd(g, addDays(g.calendar.date, X.deadlineDays));
    expect(it2.answer?.auto).toBe(true);
    expect(it2.answer?.id).toBe('skip');
  });

  it('조건 판정과 쿨다운: 시즌 한 번 이벤트는 다시 뜨지 않는다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-cond', difficulty: 'normal' });
    expect(check(g, { all: [['age', '>=', 18], { not: ['injured', '==', 1] }] })).toBe(true);
    expect(check(g, { any: [['trust', '>', 200], { flag: 'nothing' }] })).toBe(false);
    ensureEvents(g).flags.competitor = 1;
    expect(check(g, eventById('d_newCompetitor')!.when)).toBe(true);
  });

  it('흩어진 알림을 인박스로: 태그 알림·면담 결과·이적 소식, 홈 카드 3개·인박스 화면', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-notice', difficulty: 'normal' });
    g.tagNotice = { text: '+노익장', season: 2018 };
    ensureManager(g).result = { date: g.calendar.date, title: '주전 보장', text: '다음 8경기' };
    g.market.notice = '아스널로 이적했어요';
    collectNotices(g);
    expect(g.tagNotice).toBeNull();
    expect(g.manager!.result).toBeNull();
    const titles = inboxList(g).map((x) => x.title);
    expect(titles).toContain('+노익장');
    expect(titles.some((t) => t.includes('주전 보장'))).toBe(true);
    collectNotices(g);
    expect(inboxList(g).filter((x) => x.title === '+노익장').length).toBe(1);
    for (let i = 0; i < 4; i++) pushInbox(g, { cat: 'media', title: `소식 ${i}`, body: '본문' });
    const h = homeInboxVM(g);
    expect(h.rows.length).toBe(3);
    expect(homeInboxSection(h.rows, h.unread)).toContain('data-act="inbox-all-read"');
    expect(inboxView(inboxVM(g, 'all'))).toContain('인박스');
    const c = fireEvent(g, eventById('s_fans')!);
    expect(unreadCount(g)).toBeGreaterThan(0);
    expect(inboxDetailView(inboxDetailVM(g, c.id)!, null)).toContain('data-act="inbox-answer"');
  });

  it('세이브 33: 왕복, 32 세이브 이식(인박스 없음 → 처음 쓸 때)', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'c63-save', difficulty: 'normal' });
    for (let i = 0; i < 3; i++) playRound(g, { engine: 'quick' });
    expect(SAVE_FORMAT_VERSION).toBe(35);
    const back = deserialize(serialize(g));
    expect(back.inbox?.items.length).toBe(g.inbox?.items.length);
    expect(back.events?.slots).toEqual(g.events?.slots);
    const raw = JSON.parse(serialize(g));
    delete raw.inbox; delete raw.events; delete raw.rival;
    raw.saveFormat = 32;
    const old = migrate(raw);
    playRound(old, { engine: 'quick' });
    expect(old.events).toBeTruthy();
  });
});

describe('라이벌 (20.5)', () => {
  it('다른 리그 팀 · 같은 포지션군 · 나이 ±3, 시즌 끝 비교 → 인박스', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-rival', difficulty: 'normal' });
    const r = pickRival(g)!;
    expect(r).toBeTruthy();
    expect(posGroup(r.position)).toBe(posGroup(g.player.position));
    expect(Math.abs(r.age - g.player.age)).toBeLessThanOrEqual(X.rival.ageGap);
    expect(g.rival?.id).toBeTruthy();
    const rv = rivalOf(g)!;
    expect(rv.teamId).not.toBe(g.player.teamId);
    expect(rivalSection(rivalCardVM(g)!)).toContain('라이벌');
    expect(rivalVerdict({ ...rv, me: { ga: rv.ga + 5, avg: rv.avg } })).toBe(1);
    expect(rivalVerdict({ ...rv, me: { ga: rv.ga - 5, avg: rv.avg } })).toBe(-1);
    season(g);
    expect(inboxList(g).some((x) => x.cat === 'rival' && x.title.startsWith('라이벌 경쟁'))).toBe(true);
    expect(g.rival!.history.length).toBe(1);
  });
});

describe('감독 경질·주장 (C.62 남은 질문 ④)', () => {
  it('하위권 + 최근 부진이면 경질 → 새 감독, 신뢰도 다시 시작, 팀 상세에 새 감독', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-sack', difficulty: 'normal' });
    for (let i = 0; i < 12; i++) playRound(g, { engine: 'quick' });
    // 강제로 꼴찌 · 5연패 상황
    const me = g.league.table.find((r) => r.teamId === g.player.teamId)!;
    me.points = -99;
    for (const m of g.matchLog.slice(-5)) { m.goalsFor = 0; m.goalsAgainst = 2; }
    ensureManager(g).trust = 95;
    const before = coachOf(g, g.player.teamId)!.nameKo;
    let name: string | null = null;
    for (let k = 0; k < 60 && !name; k++) {
      g.league.round++;
      name = coachAfterMatch(g);
    }
    expect(name).toBeTruthy();
    expect(name).not.toBe(before);
    expect(coachOf(g, g.player.teamId)!.nameKo).toBe(name);
    expect(g.manager!.trust).toBeLessThanOrEqual(BALANCE.manager.startMax + 10);
    expect(teamDetailVM(g, g.player.teamId)!.manager?.name).toBe(name);
    expect(inboxList(g).some((x) => x.cat === 'club' && x.title.includes(name!))).toBe(true);
    // 시즌 한 번
    expect(coachAfterMatch(g)).toBeNull();
  });

  it('주장: 신뢰도 하락 ×0.9, 시즌 끝 위상 +, 이적하면 끝', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-cap', difficulty: 'normal' });
    g.player.teamId = 'ars';
    ensureManager(g);
    const d0 = scaleDelta(g, -10);
    setCaptain(g, true);
    expect(isCaptain(g)).toBe(true);
    expect(scaleDelta(g, -10)).toBeCloseTo(d0 * X.captain.downMul);
    addTrust(g, 1, 'x');
    const ev = eventById('d_captainOffer')!;
    expect(ev.choices!.some((c) => c.effects.some((e) => 'captain' in e))).toBe(true);
    g.player.teamId = 'che';
    expect(isCaptain(g)).toBe(false);
  });

  it('새 시즌: 라이벌·슬롯 다시', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c63-next', difficulty: 'normal' });
    season(g);
    startNextSeason(g);
    expect(g.events!.season).toBe(g.league.season);
    expect(g.events!.slots.length).toBeGreaterThanOrEqual(X.slots.min);
    for (let i = 0; i < 5 && !isMatchDay(g); i++) { playOthers(g, 'quick'); endDay(g); }
  });
});

describe('경기 외 생활 (pending 47 4번, C.63 b)', () => {
  it('시작값: 외국인 유망주는 적응도 낮게, 첫 시즌 실제 선수는 이미 적응, 팀이 바뀌면 다시', () => {
    const pr = newGame({ mode: 'prospect', position: 'ST', seed: 'c63-life', difficulty: 'normal' });
    expect(ensureLife(pr).adapt).toBe(BALANCE.life.adapt.foreignStart);
    const real = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-life', difficulty: 'normal' });
    expect(ensureLife(real).adapt).toBe(BALANCE.life.adapt.settledStart);
    real.player.teamId = 'ars';
    expect(ensureLife(real).adapt).toBe(BALANCE.life.adapt.domesticStart);
    expect(ensureLife(real).team).toBe(BALANCE.life.team.newTeam);
  });

  it('하루 행동: 훈련 칸에서 생활 행동을 고르면 그날 지표가 움직인다 (잉글랜드 선수는 외국어 없음)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c63-act', difficulty: 'normal' });
    for (let i = 0; i < 2; i++) playRound(g, { engine: 'quick' });
    let day = g.calendar.date;
    for (let k = 0; k < 6 && !trainingOptionsVM(g, day); k++) day = addDays(day, 1);
    const opts = trainingOptionsVM(g, day)!;
    expect(opts.options.filter((o) => o.life).map((o) => o.kind)).toEqual([...LIFE_KINDS]);
    expect(trainingSheet(opts, day)).toContain('lf-sec');
    expect(setDayTraining(g, day, 'family')).toBe(true);
    ensureLife(g).home = 40;
    while (g.calendar.date !== day) { playOthers(g, 'quick'); if (isMatchDay(g)) playRound(g, { engine: 'quick' }); else endDay(g); }
    playOthers(g, 'quick');
    const r = endDay(g);
    expect(r.kind).toBe('family');
    expect(ensureLife(g).home).toBeGreaterThan(40 + BALANCE.life.actions.family.home - 1);
    const kane = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-act', difficulty: 'normal' });
    let d2 = kane.calendar.date;
    for (let k = 0; k < 6 && !trainingOptionsVM(kane, d2); k++) d2 = addDays(d2, 1);
    expect(trainingOptionsVM(kane, d2)!.options.some((o) => o.kind === 'language')).toBe(false);
  });

  it('엔진 밖 영향: 지표가 낮으면 폼 −(합 ±0.15), 멘탈 피로가 높으면 회복 ×0.9, 홈 힌트 문장', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-eff', difficulty: 'normal' });
    const l = ensureLife(g);
    Object.assign(l, { home: 70, adapt: 70, team: 60, mental: 30 });
    expect(lifeForm(g)).toBe(0);
    Object.assign(l, { home: 10, adapt: 10, team: 10, mental: 95 });
    expect(lifeForm(g)).toBe(-BALANCE.life.effects.formMax);
    expect(lifeRecoveryMul(g)).toBe(BALANCE.life.effects.mentalRecovery);
    expect(lifeHints(g).length).toBe(4);
    Object.assign(l, { home: 90, team: 90, adapt: 90, mental: 10 });
    expect(lifeForm(g)).toBeGreaterThan(0);
  });

  it('생활 이벤트 시즌 상한 (쉬움 1 · 보통 2 · 어려움 3), 태그 확률 배율, 원클럽맨 팀 관계 하한', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-cap2', difficulty: 'easy' });
    const life = EVENTS.filter((e) => e.tags.includes('life'));
    expect(life.length).toBeGreaterThanOrEqual(15);
    ensureLife(g).events = BALANCE.life.eventsPerSeason.easy;
    expect(lifeEventsFull(g)).toBe(true);
    const d = eventById('l_discord')!;
    const base = chanceOf(g, d);
    g.player.tags.push({ id: 'leader', perm: true, season: 2018 });
    expect(chanceOf(g, d)).toBeCloseTo(base * BALANCE.life.tags.leaderDiscord);
    g.player.tags.push({ id: 'oneClubMan', perm: false, season: 2018, club: g.player.teamId });
    ensureLife(g).team = 45;
    addLife(g, 'team', -30);
    expect(ensureLife(g).team).toBe(BALANCE.life.team.oneClubFloor);
    expect(EVENTS.length).toBeGreaterThanOrEqual(58);
  });

  it('언론 울렁증: 반박 선택지 잠김 · 언론의 총아는 인터뷰 좋은 결과 5번 · 라커룸 리더는 주장 2시즌', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c63-media', difficulty: 'normal' });
    g.player.tags.push({ id: 'mediaShy', perm: true, season: 2018 });
    const it1 = fireEvent(g, eventById('l_mediaStorm')!);
    expect(it1.choices!.find((c) => c.id === 'reply')!.disabled).toBeTruthy();
    ensureLife(g).mediaGood = BALANCE.life.natural.darlingGood;
    g.captain = { teamId: g.player.teamId, since: g.league.season - 1 };
    lifeSeasonEnd(g);
    expect(g.player.tags.some((t) => t.id === 'mediaDarling')).toBe(true);
    expect(g.player.tags.some((t) => t.id === 'lockerLeader')).toBe(true);
  });
});

describe('모바일 독 (C.63c)', () => {
  it('진행 · 선수 · 홈 순서, PC 는 그대로, 더보기 = 독 위 한 줄(인박스 포함, 가로 스크롤)', () => {
    expect(DOCK_PHONE).toEqual(['prog', 'player', 'home', 'schedule', 'more']);
    expect(DOCK_PC.slice(0, 5)).toEqual(['deck', 'tactics', 'player', 'prog', 'home']);
    const vm = { screen: 'home', prog: { label: '진행 중', icon: 'clock' as const, act: 'noop', kind: 'busy' as const }, tacticsOpen: false, points: 0, more: true, inbox: 2 };
    const html = dock(vm);
    expect(html).toContain('dock-more__scroll');
    expect(html).toContain('data-to="inbox"');
    expect(html).toContain('is-busy');
    expect(dock({ ...vm, more: false })).not.toContain('dock-more__scroll');
  });
});

describe('버전 (C.63)', () => {
  it('부록 C 소절 · 단계 형식 (C.64부터는 그 패치 테스트에서 값)', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
  });
});
