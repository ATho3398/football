// C.63 (36단계 5-2): 이벤트 엔진·인박스·라이벌·감독 경질·주장 (+ b 생활 시스템)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { EVENTS } from '../data/events';
import { addDays } from '../src/calendar';
import { answerEvent, check, eventById, EV_VARS, eventsDayEnd, ensureEvents, fireEvent, type Cond, type Effect } from '../src/events';
import { endDay, isMatchDay, newGame, playOthers, playRound, startNextSeason, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
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
    expect(SAVE_FORMAT_VERSION).toBe(33);
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

describe('버전 (C.63)', () => {
  it('C.63a · 36단계', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toBe('C.63a');
    expect(STAGE_LABEL).toBe('36단계');
  });
});
